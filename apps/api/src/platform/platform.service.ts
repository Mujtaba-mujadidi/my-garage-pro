import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import * as argon2 from "argon2";
import {
  DEFAULT_ENABLED_MODULES,
  MODULE_KEYS,
  type ModuleKey,
} from "@mygaragepro/shared";
import { UserRole } from "@prisma/client";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import type { RequestUser } from "../auth/auth.types";
import { CreateGarageDto } from "./dto/create-garage.dto";
import { CreateGarageUserDto } from "./dto/create-garage-user.dto";
import { UpdateGarageModulesDto } from "./dto/update-garage-modules.dto";

@Injectable()
export class PlatformService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async listGarages() {
    const garages = await this.prisma.garageAccount.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: "desc" },
      include: { modules: true },
    });
    return garages.map((g) => ({
      id: g.id,
      name: g.name,
      slug: g.slug,
      status: g.status,
      createdAt: g.createdAt.toISOString(),
      enabledModules: g.modules.filter((m) => m.enabled).map((m) => m.moduleKey as ModuleKey),
    }));
  }

  async createGarage(actor: RequestUser, dto: CreateGarageDto) {
    const exists = await this.prisma.garageAccount.findUnique({ where: { slug: dto.slug } });
    if (exists) throw new ConflictException("Slug already in use");

    const enabled = dto.enabledModules ?? DEFAULT_ENABLED_MODULES;
    const garage = await this.prisma.garageAccount.create({
      data: { name: dto.name, slug: dto.slug },
    });

    for (const moduleKey of MODULE_KEYS) {
      await this.prisma.garageAccountModule.create({
        data: {
          garageAccountId: garage.id,
          moduleKey,
          enabled: enabled.includes(moduleKey as ModuleKey),
        },
      });
    }

    await this.audit.log({
      action: "platform.garage.create",
      userId: actor.id,
      garageAccountId: garage.id,
      entityType: "garage_account",
      entityId: garage.id,
      metadata: { name: dto.name, slug: dto.slug },
    });

    return this.listGarages().then((list) => list.find((g) => g.id === garage.id));
  }

  async setGarageStatus(actor: RequestUser, id: string, status: "ACTIVE" | "SUSPENDED") {
    const garage = await this.prisma.garageAccount.findFirst({ where: { id, deletedAt: null } });
    if (!garage) throw new NotFoundException();

    await this.prisma.garageAccount.update({ where: { id }, data: { status } });
    await this.audit.log({
      action: status === "SUSPENDED" ? "platform.garage.suspend" : "platform.garage.activate",
      userId: actor.id,
      garageAccountId: id,
      entityType: "garage_account",
      entityId: id,
    });
    return { ok: true };
  }

  async updateModules(actor: RequestUser, id: string, dto: UpdateGarageModulesDto) {
    const garage = await this.prisma.garageAccount.findFirst({ where: { id, deletedAt: null } });
    if (!garage) throw new NotFoundException();

    for (const moduleKey of MODULE_KEYS) {
      await this.prisma.garageAccountModule.upsert({
        where: { garageAccountId_moduleKey: { garageAccountId: id, moduleKey } },
        create: {
          garageAccountId: id,
          moduleKey,
          enabled: dto.enabledModules.includes(moduleKey as ModuleKey),
        },
        update: { enabled: dto.enabledModules.includes(moduleKey as ModuleKey) },
      });
    }

    await this.audit.log({
      action: "platform.garage.modules_update",
      userId: actor.id,
      garageAccountId: id,
      metadata: { enabledModules: dto.enabledModules },
    });

    return { ok: true, enabledModules: dto.enabledModules };
  }

  async createGarageUser(actor: RequestUser, garageId: string, dto: CreateGarageUserDto) {
    if (dto.role === UserRole.SUPER_ADMIN) {
      throw new ConflictException("Cannot create SUPER_ADMIN via garage endpoint");
    }
    const garage = await this.prisma.garageAccount.findFirst({ where: { id: garageId, deletedAt: null } });
    if (!garage) throw new NotFoundException();

    const email = dto.email.toLowerCase().trim();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new ConflictException("Email already registered");

    const user = await this.prisma.user.create({
      data: {
        email,
        displayName: dto.displayName,
        role: dto.role,
        garageAccountId: garageId,
        passwordHash: await argon2.hash(dto.password),
      },
    });

    await this.audit.log({
      action: "users.create",
      userId: actor.id,
      garageAccountId: garageId,
      entityType: "user",
      entityId: user.id,
      metadata: { email, role: dto.role },
    });

    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
    };
  }

  async listAuditLogs(limit = 50) {
    const rows = await this.prisma.auditLog.findMany({
      take: limit,
      orderBy: { createdAt: "desc" },
      include: { user: true, garageAccount: true },
    });
    return rows.map((r) => ({
      id: r.id,
      action: r.action,
      entityType: r.entityType,
      entityId: r.entityId,
      metadata: r.metadata as Record<string, unknown> | null,
      userEmail: r.user?.email ?? null,
      garageName: r.garageAccount?.name ?? null,
      createdAt: r.createdAt.toISOString(),
    }));
  }
}
