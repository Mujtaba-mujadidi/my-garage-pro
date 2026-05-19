import { ForbiddenException, Injectable } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import {
  allGaragePermissionsForOwner,
  CONFIGURABLE_ROLES,
  DEFAULT_ROLE_PERMISSIONS,
  GARAGE_PERMISSIONS,
  type ConfigurableRole,
  type GaragePermission,
  type Permission,
  PERMISSION_GROUPS,
  type RolePermissionMatrixDto,
  superAdminPermissions,
} from "@mygaragepro/shared";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import type { RequestUser } from "../auth/auth.types";

@Injectable()
export class RolePermissionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async resolvePermissions(
    garageAccountId: string | null,
    role: UserRole,
  ): Promise<Permission[]> {
    if (role === UserRole.SUPER_ADMIN) {
      return superAdminPermissions();
    }
    if (!garageAccountId) return [];

    if (role === UserRole.OWNER) {
      return allGaragePermissionsForOwner() as Permission[];
    }

    const rows = await this.prisma.garageRolePermission.findMany({
      where: { garageAccountId, role, granted: true },
    });

    if (rows.length === 0) {
      await this.seedDefaults(garageAccountId);
      return this.resolvePermissions(garageAccountId, role);
    }

    return rows.map((r) => r.permission as Permission);
  }

  async seedDefaults(garageAccountId: string) {
    for (const role of CONFIGURABLE_ROLES) {
      const defaults = DEFAULT_ROLE_PERMISSIONS[role];
      for (const permission of GARAGE_PERMISSIONS) {
        await this.prisma.garageRolePermission.upsert({
          where: {
            garageAccountId_role_permission: {
              garageAccountId,
              role: role as UserRole,
              permission,
            },
          },
          create: {
            garageAccountId,
            role: role as UserRole,
            permission,
            granted: defaults.includes(permission),
          },
          update: {},
        });
      }
    }
  }

  async getMatrix(user: RequestUser): Promise<RolePermissionMatrixDto> {
    const garageAccountId = this.requireGarage(user);
    await this.ensureSeeded(garageAccountId);

    const rows = await this.prisma.garageRolePermission.findMany({
      where: { garageAccountId, role: { in: [...CONFIGURABLE_ROLES] as UserRole[] } },
    });

    const grants = {} as Record<ConfigurableRole, GaragePermission[]>;
    for (const role of CONFIGURABLE_ROLES) {
      grants[role] = rows
        .filter((r) => r.role === role && r.granted)
        .map((r) => r.permission as GaragePermission);
    }

    return {
      roles: [...CONFIGURABLE_ROLES],
      groups: PERMISSION_GROUPS,
      grants,
    };
  }

  async updateMatrix(
    user: RequestUser,
    grants: Record<ConfigurableRole, GaragePermission[]>,
  ) {
    if (user.role !== UserRole.OWNER) {
      throw new ForbiddenException("Only the garage owner can change role permissions");
    }
    const garageAccountId = this.requireGarage(user);

    for (const role of CONFIGURABLE_ROLES) {
      const roleGrants = grants[role] ?? [];
      for (const permission of GARAGE_PERMISSIONS) {
        const granted = roleGrants.includes(permission);
        await this.prisma.garageRolePermission.upsert({
          where: {
            garageAccountId_role_permission: {
              garageAccountId,
              role: role as UserRole,
              permission,
            },
          },
          create: { garageAccountId, role: role as UserRole, permission, granted },
          update: { granted },
        });
      }
    }

    await this.audit.log({
      action: "permissions.matrix_update",
      userId: user.id,
      garageAccountId,
      metadata: { grants },
    });

    return this.getMatrix(user);
  }

  private requireGarage(user: RequestUser): string {
    if (!user.garageAccountId) throw new ForbiddenException("No garage context");
    return user.garageAccountId;
  }

  private async ensureSeeded(garageAccountId: string) {
    const count = await this.prisma.garageRolePermission.count({
      where: { garageAccountId },
    });
    if (count === 0) await this.seedDefaults(garageAccountId);
  }
}
