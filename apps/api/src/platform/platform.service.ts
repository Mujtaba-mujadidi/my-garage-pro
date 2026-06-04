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
import { GarageRolesService } from "../garage-roles/garage-roles.service";
import type { RequestUser } from "../auth/auth.types";
import { CreateGarageDto } from "./dto/create-garage.dto";
import { CreateGarageUserDto } from "./dto/create-garage-user.dto";
import { ResetGarageOwnerPasswordDto } from "./dto/reset-garage-owner-password.dto";
import { ensureDefaultGarageSettings } from "../settings/default-garage-settings";
import { UpdateGarageDto } from "./dto/update-garage.dto";
import { UpdateGarageModulesDto } from "./dto/update-garage-modules.dto";

function mapGarage(
  g: {
    id: string;
    name: string;
    slug: string;
    directorOwnerName: string;
    address: string;
    contactNumber: string;
    phoneNumber: string;
    vatNumber: string | null;
    status: string;
    createdAt: Date;
    modules: { moduleKey: string; enabled: boolean }[];
  },
  ownerEmail: string | null,
) {
  return {
    id: g.id,
    name: g.name,
    slug: g.slug,
    directorOwnerName: g.directorOwnerName,
    address: g.address,
    contactNumber: g.contactNumber,
    phoneNumber: g.phoneNumber,
    vatNumber: g.vatNumber,
    status: g.status,
    createdAt: g.createdAt.toISOString(),
    enabledModules: g.modules.filter((m) => m.enabled).map((m) => m.moduleKey as ModuleKey),
    ownerEmail,
  };
}

@Injectable()
export class PlatformService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly garageRoles: GarageRolesService,
  ) {}

  async listGarages() {
    const garages = await this.prisma.garageAccount.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: "desc" },
      include: {
        modules: true,
        users: {
          where: { role: UserRole.OWNER, deletedAt: null },
          take: 1,
          select: { email: true },
        },
      },
    });
    return garages.map((g) =>
      mapGarage(g, g.users[0]?.email ?? null),
    );
  }

  async createGarage(actor: RequestUser, dto: CreateGarageDto) {
    const slug = dto.slug.toLowerCase().trim();
    const ownerEmail = dto.ownerEmail.toLowerCase().trim();

    const slugExists = await this.prisma.garageAccount.findUnique({ where: { slug } });
    if (slugExists) throw new ConflictException("Slug already in use");

    const emailExists = await this.prisma.user.findUnique({ where: { email: ownerEmail } });
    if (emailExists) throw new ConflictException("Owner email already registered");

    const enabled = dto.enabledModules ?? DEFAULT_ENABLED_MODULES;
    const vat =
      dto.vatNumber?.trim() ? dto.vatNumber.trim() : null;

    const garage = await this.prisma.$transaction(async (tx) => {
      const created = await tx.garageAccount.create({
        data: {
          name: dto.name.trim(),
          slug,
          directorOwnerName: dto.directorOwnerName.trim(),
          address: dto.address.trim(),
          contactNumber: dto.contactNumber.trim(),
          phoneNumber: dto.phoneNumber.trim(),
          vatNumber: vat,
        },
      });

      for (const moduleKey of MODULE_KEYS) {
        await tx.garageAccountModule.create({
          data: {
            garageAccountId: created.id,
            moduleKey,
            enabled: enabled.includes(moduleKey as ModuleKey),
          },
        });
      }

      await tx.user.create({
        data: {
          email: ownerEmail,
          displayName: dto.directorOwnerName.trim(),
          role: UserRole.OWNER,
          garageAccountId: created.id,
          passwordHash: await argon2.hash(dto.tempPassword),
          mustChangePassword: true,
        },
      });

      return created;
    });

    await this.garageRoles.seedDefaultRoles(garage.id);
    await ensureDefaultGarageSettings(this.prisma, garage.id);

    await this.audit.log({
      action: "platform.garage.create",
      userId: actor.id,
      garageAccountId: garage.id,
      entityType: "garage_account",
      entityId: garage.id,
      metadata: {
        name: dto.name,
        slug,
        ownerEmail,
        directorOwnerName: dto.directorOwnerName,
      },
    });

    const list = await this.listGarages();
    return list.find((g) => g.id === garage.id);
  }

  async updateGarage(actor: RequestUser, id: string, dto: UpdateGarageDto) {
    const garage = await this.prisma.garageAccount.findFirst({
      where: { id, deletedAt: null },
    });
    if (!garage) throw new NotFoundException("Garage not found");

    const slug = dto.slug.toLowerCase().trim();
    if (slug !== garage.slug) {
      const slugExists = await this.prisma.garageAccount.findUnique({ where: { slug } });
      if (slugExists) throw new ConflictException("Slug already in use");
    }

    const vat = dto.vatNumber?.trim() ? dto.vatNumber.trim() : null;
    const directorName = dto.directorOwnerName.trim();

    const owner = await this.prisma.user.findFirst({
      where: {
        garageAccountId: id,
        role: UserRole.OWNER,
        deletedAt: null,
      },
    });

    const ownerEmail = dto.ownerEmail?.toLowerCase().trim();
    if (owner && ownerEmail) {
      if (ownerEmail !== owner.email) {
        const emailExists = await this.prisma.user.findUnique({ where: { email: ownerEmail } });
        if (emailExists) throw new ConflictException("Owner email already registered");
        await this.prisma.user.update({
          where: { id: owner.id },
          data: { email: ownerEmail, displayName: directorName },
        });
      } else {
        await this.prisma.user.update({
          where: { id: owner.id },
          data: { displayName: directorName },
        });
      }
    } else if (owner) {
      await this.prisma.user.update({
        where: { id: owner.id },
        data: { displayName: directorName },
      });
    }

    await this.prisma.garageAccount.update({
      where: { id },
      data: {
        name: dto.name.trim(),
        slug,
        directorOwnerName: directorName,
        address: dto.address.trim(),
        contactNumber: dto.contactNumber.trim(),
        phoneNumber: dto.phoneNumber.trim(),
        vatNumber: vat,
      },
    });

    await this.audit.log({
      action: "platform.garage.update",
      userId: actor.id,
      garageAccountId: id,
      entityType: "garage_account",
      entityId: id,
      metadata: { name: dto.name, slug },
    });

    const list = await this.listGarages();
    return list.find((g) => g.id === id);
  }

  async resetOwnerPassword(actor: RequestUser, garageId: string, dto: ResetGarageOwnerPasswordDto) {
    const garage = await this.prisma.garageAccount.findFirst({
      where: { id: garageId, deletedAt: null },
    });
    if (!garage) throw new NotFoundException("Garage not found");

    const owner = await this.prisma.user.findFirst({
      where: {
        garageAccountId: garageId,
        role: UserRole.OWNER,
        deletedAt: null,
      },
    });
    if (!owner) {
      throw new NotFoundException("No owner account found for this garage");
    }

    await this.prisma.user.update({
      where: { id: owner.id },
      data: {
        passwordHash: await argon2.hash(dto.tempPassword),
        mustChangePassword: true,
        status: "ACTIVE",
      },
    });

    await this.audit.log({
      action: "platform.garage.owner_password_reset",
      userId: actor.id,
      garageAccountId: garageId,
      entityType: "user",
      entityId: owner.id,
      metadata: { ownerEmail: owner.email },
    });

    return { ok: true as const, ownerEmail: owner.email };
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
