import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { UserRole } from "@prisma/client";
import {
  allGaragePermissionsForOwner,
  DEFAULT_GARAGE_ROLES,
  GARAGE_PERMISSIONS,
  PERMISSION_MODULE,
  type GaragePermission,
  type GarageRoleDetailDto,
  type GarageRoleDto,
  type GarageRoleListDto,
  type ModuleKey,
  type Permission,
  superAdminPermissions,
} from "@mygaragepro/shared";
import {
  filterGaragePermissions,
  permissionGroupsForGarage,
} from "@mygaragepro/shared";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import type { RequestUser } from "../auth/auth.types";

function toSlug(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || "role";
}

@Injectable()
export class GarageRolesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async resolvePermissions(
    garageAccountId: string | null,
    role: UserRole,
    garageRoleId: string | null,
  ): Promise<Permission[]> {
    if (role === UserRole.SUPER_ADMIN) return superAdminPermissions();
    if (!garageAccountId) return [];
    if (role === UserRole.OWNER) return allGaragePermissionsForOwner() as Permission[];

    if (garageRoleId) {
      const rows = await this.prisma.garageRolePermission.findMany({
        where: { garageRoleId, granted: true },
      });
      return rows.map((r) => r.permission as Permission);
    }

    return [];
  }

  /**
   * Ensures manager / mechanic / staff slots exist. Default roles keep a stable slug so
   * renaming the display label does not spawn a second row on the next list().
   */
  async seedDefaultRoles(garageAccountId: string) {
    const enabledModules = await this.getEnabledModules(garageAccountId);
    await this.dedupeDefaultRoleSlots(garageAccountId);

    for (let i = 0; i < DEFAULT_GARAGE_ROLES.length; i++) {
      const template = DEFAULT_GARAGE_ROLES[i];
      let role = await this.prisma.garageRole.findUnique({
        where: {
          garageAccountId_slug: { garageAccountId, slug: template.slug },
        },
        include: { _count: { select: { users: true } } },
      });

      if (!role) {
        const renamedSlot = await this.prisma.garageRole.findFirst({
          where: { garageAccountId, isDefault: true, sortOrder: i },
          include: { _count: { select: { users: true } } },
        });
        if (renamedSlot) {
          role = await this.prisma.garageRole.update({
            where: { id: renamedSlot.id },
            data: { slug: template.slug },
            include: { _count: { select: { users: true } } },
          });
        }
      }

      if (role) {
        continue;
      }

      role = await this.prisma.garageRole.create({
        data: {
          garageAccountId,
          name: template.name,
          slug: template.slug,
          isDefault: true,
          sortOrder: i,
        },
        include: { _count: { select: { users: true } } },
      });
      const granted = filterGaragePermissions(template.permissions, enabledModules);
      await this.setRolePermissions(role.id, granted, enabledModules);
    }
  }

  /** Removes duplicate default-slot rows left by older slug-rename behaviour. */
  private async dedupeDefaultRoleSlots(garageAccountId: string) {
    for (let i = 0; i < DEFAULT_GARAGE_ROLES.length; i++) {
      const template = DEFAULT_GARAGE_ROLES[i];
      const roles = await this.prisma.garageRole.findMany({
        where: {
          garageAccountId,
          OR: [{ slug: template.slug }, { isDefault: true, sortOrder: i }],
        },
        include: { _count: { select: { users: true } } },
        orderBy: { createdAt: "asc" },
      });
      if (roles.length <= 1) continue;

      const keeper =
        roles.find((r) => r.slug === template.slug) ??
        roles.find((r) => r._count.users > 0) ??
        roles[0];

      for (const dup of roles) {
        if (dup.id === keeper.id) continue;
        if (dup._count.users > 0) {
          await this.prisma.user.updateMany({
            where: { garageRoleId: dup.id, garageAccountId },
            data: { garageRoleId: keeper.id },
          });
        }
        await this.prisma.garageRole.delete({ where: { id: dup.id } });
      }

      if (keeper.slug !== template.slug) {
        await this.prisma.garageRole.update({
          where: { id: keeper.id },
          data: { slug: template.slug },
        });
      }
    }
  }

  async list(user: RequestUser): Promise<GarageRoleListDto> {
    const garageAccountId = this.requireGarage(user);
    await this.seedDefaultRoles(garageAccountId);

    const roles = await this.prisma.garageRole.findMany({
      where: { garageAccountId },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: {
        permissions: { where: { granted: true } },
        _count: { select: { users: true } },
      },
    });

    const enabledModules = await this.getEnabledModules(garageAccountId);
    return {
      roles: roles.map((r) => this.toRoleDto(r, enabledModules)),
      groups: permissionGroupsForGarage(enabledModules),
      enabledModules,
    };
  }

  async getOne(user: RequestUser, id: string): Promise<GarageRoleDetailDto> {
    const role = await this.findRoleInGarage(user, id);
    const enabledModules = await this.getEnabledModules(role.garageAccountId);
    return {
      ...this.toRoleDto(role, enabledModules),
      groups: permissionGroupsForGarage(enabledModules),
    };
  }

  async create(user: RequestUser, name: string, permissions: GaragePermission[] = []) {
    this.assertOwner(user);
    const garageAccountId = this.requireGarage(user);
    await this.seedDefaultRoles(garageAccountId);

    const slug = await this.uniqueSlug(garageAccountId, toSlug(name));
    const maxOrder = await this.prisma.garageRole.aggregate({
      where: { garageAccountId },
      _max: { sortOrder: true },
    });

    const role = await this.prisma.garageRole.create({
      data: {
        garageAccountId,
        name: name.trim(),
        slug,
        isDefault: false,
        sortOrder: (maxOrder._max.sortOrder ?? 0) + 1,
      },
    });

    const enabledModules = await this.getEnabledModules(garageAccountId);
    const granted = filterGaragePermissions(permissions, enabledModules);
    await this.setRolePermissions(role.id, granted, enabledModules);

    await this.audit.log({
      action: "garage_roles.create",
      userId: user.id,
      garageAccountId,
      entityType: "garage_role",
      entityId: role.id,
      metadata: { name, slug },
    });

    return this.getOne(user, role.id);
  }

  async update(
    user: RequestUser,
    id: string,
    data: { name?: string; permissions?: GaragePermission[] },
  ) {
    this.assertOwner(user);
    const existing = await this.findRoleInGarage(user, id);

    const name = data.name?.trim();
    const updateData: { name?: string; slug?: string } = {};

    if (name && name !== existing.name) {
      updateData.name = name;
      if (!existing.isDefault) {
        updateData.slug = await this.uniqueSlug(
          existing.garageAccountId,
          toSlug(name),
          id,
        );
      }
    }

    if (Object.keys(updateData).length > 0) {
      await this.prisma.garageRole.update({
        where: { id },
        data: updateData,
      });
    }

    if (data.permissions) {
      const enabledModules = await this.getEnabledModules(existing.garageAccountId);
      const permissions = filterGaragePermissions(data.permissions, enabledModules);
      await this.setRolePermissions(id, permissions, enabledModules);
    }

    await this.audit.log({
      action: "garage_roles.update",
      userId: user.id,
      garageAccountId: existing.garageAccountId,
      entityType: "garage_role",
      entityId: id,
      metadata: data,
    });

    return this.getOne(user, id);
  }

  async remove(user: RequestUser, id: string) {
    this.assertOwner(user);
    const role = await this.findRoleInGarage(user, id);

    if (role.isDefault) {
      throw new ForbiddenException("Default roles cannot be deleted");
    }
    if (role._count.users > 0) {
      throw new ConflictException("Remove users from this role before deleting it");
    }

    await this.prisma.garageRole.delete({ where: { id } });

    await this.audit.log({
      action: "garage_roles.delete",
      userId: user.id,
      garageAccountId: role.garageAccountId,
      entityType: "garage_role",
      entityId: id,
      metadata: { name: role.name },
    });
  }

  private async setRolePermissions(
    garageRoleId: string,
    granted: GaragePermission[],
    enabledModules: ModuleKey[],
  ) {
    for (const permission of GARAGE_PERMISSIONS) {
      const moduleKey = PERMISSION_MODULE[permission];
      const applicable =
        moduleKey === undefined || enabledModules.includes(moduleKey);
      await this.prisma.garageRolePermission.upsert({
        where: { garageRoleId_permission: { garageRoleId, permission } },
        create: {
          garageRoleId,
          permission,
          granted: applicable && granted.includes(permission),
        },
        update: {
          granted: applicable && granted.includes(permission),
        },
      });
    }
  }

  private async getEnabledModules(garageAccountId: string): Promise<ModuleKey[]> {
    const rows = await this.prisma.garageAccountModule.findMany({
      where: { garageAccountId, enabled: true },
      select: { moduleKey: true },
    });
    return rows.map((r) => r.moduleKey as ModuleKey);
  }

  private async uniqueSlug(garageAccountId: string, base: string, excludeId?: string) {
    let slug = base;
    let n = 1;
    while (true) {
      const clash = await this.prisma.garageRole.findFirst({
        where: { garageAccountId, slug, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
      });
      if (!clash) return slug;
      slug = `${base}-${n++}`;
    }
  }

  private async findRoleInGarage(user: RequestUser, id: string) {
    const garageAccountId = this.requireGarage(user);
    await this.seedDefaultRoles(garageAccountId);

    const role = await this.prisma.garageRole.findFirst({
      where: { id, garageAccountId },
      include: {
        permissions: { where: { granted: true } },
        _count: { select: { users: true } },
      },
    });
    if (!role) throw new NotFoundException("Role not found");
    return role;
  }

  private toRoleDto(
    role: {
      id: string;
      name: string;
      slug: string;
      isDefault: boolean;
      permissions: { permission: string }[];
      _count: { users: number };
    },
    enabledModules: ModuleKey[],
  ): GarageRoleDto {
    const raw = role.permissions.map((p) => p.permission as GaragePermission);
    return {
      id: role.id,
      name: role.name,
      slug: role.slug,
      isDefault: role.isDefault,
      userCount: role._count.users,
      permissions: filterGaragePermissions(raw, enabledModules),
    };
  }

  private requireGarage(user: RequestUser): string {
    if (!user.garageAccountId) throw new ForbiddenException("No garage context");
    return user.garageAccountId;
  }

  private assertOwner(user: RequestUser) {
    if (user.role !== UserRole.OWNER) {
      throw new ForbiddenException("Only the garage owner can manage roles");
    }
  }
}
