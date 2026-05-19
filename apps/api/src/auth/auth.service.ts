import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as argon2 from "argon2";
import {
  MODULE_KEYS,
  roleHasPermission,
  type AuthSessionDto,
  type ModuleKey,
  type Permission,
} from "@mygaragepro/shared";
import { UserRole } from "@prisma/client";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import type { JwtPayload } from "./auth.types";

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly audit: AuditService,
  ) {}

  async login(email: string, password: string): Promise<AuthSessionDto> {
    const user = await this.prisma.user.findFirst({
      where: { email: email.toLowerCase().trim(), status: "ACTIVE", deletedAt: null },
      include: { garageAccount: true },
    });
    if (!user) throw new UnauthorizedException("Invalid email or password");

    const valid = await argon2.verify(user.passwordHash, password);
    if (!valid) throw new UnauthorizedException("Invalid email or password");

    if (user.garageAccount?.status === "SUSPENDED") {
      throw new UnauthorizedException("Garage account is suspended");
    }

    const isSuperAdmin = user.role === UserRole.SUPER_ADMIN;
    await this.prisma.setTenantContext(user.garageAccountId, isSuperAdmin);

    let enabledModules: ModuleKey[] = MODULE_KEYS as unknown as ModuleKey[];
    if (user.garageAccountId) {
      const mods = await this.prisma.garageAccountModule.findMany({
        where: { garageAccountId: user.garageAccountId, enabled: true },
      });
      enabledModules = mods.map((m) => m.moduleKey as ModuleKey);
    }

    const allPermissions: Permission[] = [
      "platform.garage.manage",
      "platform.audit.read",
      "settings.read",
      "settings.write",
      "users.read",
      "users.write",
      "ledger.read",
      "ledger.write",
      "partners.read",
      "partners.write",
    ];
    const permissions = allPermissions.filter((p) =>
      roleHasPermission(user.role as UserRole, p),
    );

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role as UserRole,
      garageAccountId: user.garageAccountId,
    };

    const accessToken = await this.jwt.signAsync(payload);

    await this.audit.log({
      action: "auth.login",
      userId: user.id,
      garageAccountId: user.garageAccountId,
      metadata: { email: user.email },
    });

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: user.role as UserRole,
        garageAccountId: user.garageAccountId,
      },
      garage: user.garageAccount
        ? { id: user.garageAccount.id, name: user.garageAccount.name, slug: user.garageAccount.slug }
        : null,
      enabledModules,
      permissions,
    };
  }

  async getSession(userId: string): Promise<AuthSessionDto> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, status: "ACTIVE", deletedAt: null },
      include: { garageAccount: true },
    });
    if (!user) throw new UnauthorizedException();

    const isSuperAdmin = user.role === UserRole.SUPER_ADMIN;
    await this.prisma.setTenantContext(user.garageAccountId, isSuperAdmin);

    let enabledModules: ModuleKey[] = MODULE_KEYS as unknown as ModuleKey[];
    if (user.garageAccountId) {
      const mods = await this.prisma.garageAccountModule.findMany({
        where: { garageAccountId: user.garageAccountId, enabled: true },
      });
      enabledModules = mods.map((m) => m.moduleKey as ModuleKey);
    }

    const allPermissions: Permission[] = [
      "platform.garage.manage",
      "platform.audit.read",
      "settings.read",
      "settings.write",
      "users.read",
      "users.write",
      "ledger.read",
      "ledger.write",
      "partners.read",
      "partners.write",
    ];
    const permissions = allPermissions.filter((p) =>
      roleHasPermission(user.role as UserRole, p),
    );

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role as UserRole,
      garageAccountId: user.garageAccountId,
    };

    return {
      accessToken: await this.jwt.signAsync(payload),
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: user.role as UserRole,
        garageAccountId: user.garageAccountId,
      },
      garage: user.garageAccount
        ? { id: user.garageAccount.id, name: user.garageAccount.name, slug: user.garageAccount.slug }
        : null,
      enabledModules,
      permissions,
    };
  }
}
