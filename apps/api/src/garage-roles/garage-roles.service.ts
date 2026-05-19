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
  type GaragePermission,
  type GarageRoleDetailDto,
  type GarageRoleDto,
  type GarageRoleListDto,
  PERMISSION_GROUPS,
  type Permission,
  superAdminPermissions,
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

  async seedDefaultRoles(garageAccountId: string) {
    for (let i = 0; i < DEFAULT_GARAGE_ROLES.length; i++) {
      const template = DEFAULT_GARAGE_ROLES[i];
      const role = await this.prisma.garageRole.upsert({
        where: {
          garageAccountId_slug: { garageAccountId, slug: template.slug },
        },
        create: {
          garageAccountId,
          name: template.name,
          slug: template.slug,
          isDefault: true,
          sortOrder: i,
        },
        update: { name: template.name },
      });
      await this.setRolePermissions(role.id, template.permissions);
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

    return {
      roles: roles.map((r) => this.toRoleDto(r)),
      groups: PERMISSION_GROUPS,
    };
  }

  async getOne(user: RequestUser, id: string): Promise<GarageRoleDetailDto> {
    const role = await this.findRoleInGarage(user, id);
    return { ...this.toRoleDto(role), groups: PERMISSION_GROUPS };
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

    await this.setRolePermissions(role.id, permissions);

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

    let slug = existing.slug;
    if (data.name && data.name.trim() !== existing.name) {
      slug = await this.uniqueSlug(existing.garageAccountId, toSlug(data.name), id);
    }

    await this.prisma.garageRole.update({
      where: { id },
      data: {
        ...(data.name ? { name: data.name.trim(), slug } : {}),
      },
    });

    if (data.permissions) {
      await this.setRolePermissions(id, data.permissions);
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

  private async setRolePermissions(garageRoleId: string, granted: GaragePermission[]) {
    for (const permission of GARAGE_PERMISSIONS) {
      await this.prisma.garageRolePermission.upsert({
        where: { garageRoleId_permission: { garageRoleId, permission } },
        create: { garageRoleId, permission, granted: granted.includes(permission) },
        update: { granted: granted.includes(permission) },
      });
    }
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

  private toRoleDto(role: {
    id: string;
    name: string;
    slug: string;
    isDefault: boolean;
    permissions: { permission: string }[];
    _count: { users: number };
  }): GarageRoleDto {
    return {
      id: role.id,
      name: role.name,
      slug: role.slug,
      isDefault: role.isDefault,
      userCount: role._count.users,
      permissions: role.permissions.map((p) => p.permission as GaragePermission),
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
