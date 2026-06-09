import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import type { RequestUser } from "../auth/auth.types";
import { ensureDefaultGarageSettings } from "./default-garage-settings";
import { CreateSettingDto } from "./dto/create-setting.dto";
import { UpdateSettingDto } from "./dto/update-setting.dto";

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private garageId(user: RequestUser): string {
    if (!user.garageAccountId) throw new ForbiddenException("No garage context");
    return user.garageAccountId;
  }

  async list(user: RequestUser, optionType?: string) {
    const garageAccountId = this.garageId(user);
    await ensureDefaultGarageSettings(this.prisma, garageAccountId);
    return this.prisma.settingOption.findMany({
      where: {
        garageAccountId,
        deletedAt: null,
        ...(optionType ? { optionType } : {}),
      },
      orderBy: [{ optionType: "asc" }, { sortOrder: "asc" }],
    });
  }

  /** Idempotent create for ledger expense categories (label is the stored value on entries). */
  async createExpenseCategory(user: RequestUser, label: string) {
    const garageAccountId = this.garageId(user);
    const trimmed = label.trim();
    if (!trimmed) throw new BadRequestException("Category name is required");

    await ensureDefaultGarageSettings(this.prisma, garageAccountId);

    const existing = await this.prisma.settingOption.findFirst({
      where: {
        garageAccountId,
        optionType: "expense_category",
        deletedAt: null,
        label: { equals: trimmed, mode: "insensitive" },
      },
    });
    if (existing) return existing;

    const agg = await this.prisma.settingOption.aggregate({
      where: { garageAccountId, optionType: "expense_category", deletedAt: null },
      _max: { sortOrder: true },
    });
    const sortOrder = (agg._max.sortOrder ?? -1) + 1;

    const row = await this.prisma.settingOption.create({
      data: {
        garageAccountId,
        optionType: "expense_category",
        label: trimmed,
        value: trimmed.toLowerCase().replace(/\s+/g, "_"),
        sortOrder,
      },
    });
    await this.audit.log({
      action: "settings.expense_category.create",
      userId: user.id,
      garageAccountId,
      entityType: "setting_option",
      entityId: row.id,
      metadata: { label: trimmed },
    });
    return row;
  }

  async create(user: RequestUser, dto: CreateSettingDto) {
    const garageAccountId = this.garageId(user);
    const row = await this.prisma.settingOption.create({
      data: {
        garageAccountId,
        optionType: dto.optionType,
        label: dto.label,
        value: dto.value,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
    await this.audit.log({
      action: "settings.create",
      userId: user.id,
      garageAccountId,
      entityType: "setting_option",
      entityId: row.id,
      metadata: { optionType: dto.optionType, label: dto.label },
    });
    return row;
  }

  async update(user: RequestUser, id: string, dto: UpdateSettingDto) {
    const garageAccountId = this.garageId(user);
    const existing = await this.prisma.settingOption.findFirst({
      where: { id, garageAccountId, deletedAt: null },
    });
    if (!existing) throw new NotFoundException();

    const row = await this.prisma.settingOption.update({
      where: { id },
      data: {
        label: dto.label,
        value: dto.value,
        sortOrder: dto.sortOrder,
      },
    });
    await this.audit.log({
      action: "settings.update",
      userId: user.id,
      garageAccountId,
      entityType: "setting_option",
      entityId: row.id,
      metadata: {
        before: { label: existing.label, value: existing.value },
        after: { label: dto.label, value: dto.value, sortOrder: dto.sortOrder },
      },
    });
    return row;
  }

  async remove(user: RequestUser, id: string) {
    const garageAccountId = this.garageId(user);
    const existing = await this.prisma.settingOption.findFirst({
      where: { id, garageAccountId, deletedAt: null },
    });
    if (!existing) throw new NotFoundException();

    const row = await this.prisma.settingOption.update({
      where: { id },
      data: { deletedAt: new Date(), deletedBy: user.id },
    });
    await this.audit.log({
      action: "settings.delete",
      userId: user.id,
      garageAccountId,
      entityType: "setting_option",
      entityId: row.id,
    });
    return { ok: true };
  }
}
