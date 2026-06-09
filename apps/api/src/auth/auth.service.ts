import { BadRequestException, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as argon2 from "argon2";
import { MODULE_KEYS, type AuthSessionDto, type ModuleKey, type UserRole } from "@mygaragepro/shared";
import { UserRole as PrismaUserRole, UserStatus } from "@prisma/client";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import { GarageRolesService } from "../garage-roles/garage-roles.service";
import type { JwtPayload } from "./auth.types";

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly audit: AuditService,
    private readonly garageRoles: GarageRolesService,
  ) {}

  async login(email: string, password: string): Promise<AuthSessionDto> {
    const normalizedEmail = email.toLowerCase().trim();
    const user = await this.prisma.user.findFirst({
      where: { email: normalizedEmail, deletedAt: null },
      include: { garageAccount: true, garageRole: true },
    });
    if (!user) throw new UnauthorizedException("Invalid email or password");

    if (user.status === UserStatus.DISABLED) {
      const message =
        user.role === PrismaUserRole.SUPER_ADMIN
          ? "This account has been deactivated. Contact platform support to restore access."
          : "This account has been deactivated. Contact your garage administrator to restore access.";
      throw new UnauthorizedException(message);
    }

    const valid = await argon2.verify(user.passwordHash, password);
    if (!valid) throw new UnauthorizedException("Invalid email or password");

    if (user.garageAccount?.status === "SUSPENDED") {
      throw new UnauthorizedException("Garage account is suspended");
    }

    await this.audit.log({
      action: "auth.login",
      userId: user.id,
      garageAccountId: user.garageAccountId,
      metadata: { email: user.email },
    });

    return this.buildSession(user);
  }

  async getSession(userId: string): Promise<AuthSessionDto> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, status: "ACTIVE", deletedAt: null },
      include: { garageAccount: true, garageRole: true },
    });
    if (!user) throw new UnauthorizedException();
    return this.buildSession(user);
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<AuthSessionDto> {
    if (currentPassword === newPassword) {
      throw new BadRequestException("New password must be different from the current password");
    }

    const user = await this.prisma.user.findFirst({
      where: { id: userId, status: "ACTIVE", deletedAt: null },
      include: { garageAccount: true, garageRole: true },
    });
    if (!user) throw new UnauthorizedException();

    const valid = await argon2.verify(user.passwordHash, currentPassword);
    if (!valid) throw new UnauthorizedException("Current password is incorrect");

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: await argon2.hash(newPassword),
        mustChangePassword: false,
      },
    });

    await this.audit.log({
      action: "auth.password_changed",
      userId: user.id,
      garageAccountId: user.garageAccountId,
    });

    const refreshed = await this.prisma.user.findFirst({
      where: { id: userId },
      include: { garageAccount: true, garageRole: true },
    });
    if (!refreshed) throw new UnauthorizedException();
    return this.buildSession(refreshed);
  }

  private async buildSession(user: {
    id: string;
    email: string;
    displayName: string;
    role: PrismaUserRole;
    garageAccountId: string | null;
    garageRoleId: string | null;
    mustChangePassword: boolean;
    garageAccount: {
      id: string;
      name: string;
      slug: string;
      status: string;
      vatNumber: string | null;
    } | null;
    garageRole: { id: string; name: string } | null;
  }): Promise<AuthSessionDto> {
    const isSuperAdmin = user.role === PrismaUserRole.SUPER_ADMIN;
    await this.prisma.setTenantContext(user.garageAccountId, isSuperAdmin);

    if (user.garageAccountId && user.role === PrismaUserRole.STAFF) {
      await this.garageRoles.seedDefaultRoles(user.garageAccountId);
    }

    let enabledModules: ModuleKey[] = MODULE_KEYS as unknown as ModuleKey[];
    if (user.garageAccountId) {
      const mods = await this.prisma.garageAccountModule.findMany({
        where: { garageAccountId: user.garageAccountId, enabled: true },
      });
      enabledModules = mods.map((m) => m.moduleKey as ModuleKey);
    }

    const sessionRole = this.toSessionRole(user.role);
    const permissions = await this.garageRoles.resolvePermissions(
      user.garageAccountId,
      user.role,
      user.garageRoleId,
    );

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: sessionRole,
      garageAccountId: user.garageAccountId,
    };

    return {
      accessToken: await this.jwt.signAsync(payload),
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: sessionRole,
        garageAccountId: user.garageAccountId,
        garageRoleId: user.garageRoleId,
        garageRoleName: user.garageRole?.name ?? null,
        mustChangePassword: user.mustChangePassword,
      },
      garage: user.garageAccount
        ? {
            id: user.garageAccount.id,
            name: user.garageAccount.name,
            slug: user.garageAccount.slug,
            vatNumber: user.garageAccount.vatNumber,
          }
        : null,
      enabledModules,
      permissions,
    };
  }

  private toSessionRole(role: PrismaUserRole): UserRole {
    if (role === PrismaUserRole.SUPER_ADMIN) return "SUPER_ADMIN";
    if (role === PrismaUserRole.OWNER) return "OWNER";
    return "STAFF";
  }
}
