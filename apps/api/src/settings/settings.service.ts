import {
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
