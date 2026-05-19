import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as argon2 from "argon2";
import { MODULE_KEYS, type AuthSessionDto, type ModuleKey, type UserRole } from "@mygaragepro/shared";
import { UserRole as PrismaUserRole } from "@prisma/client";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import { RolePermissionsService } from "../role-permissions/role-permissions.service";
import type { JwtPayload } from "./auth.types";

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly audit: AuditService,
    private readonly rolePermissions: RolePermissionsService,
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
      include: { garageAccount: true },
    });
    if (!user) throw new UnauthorizedException();
    return this.buildSession(user);
  }

  private async buildSession(user: {
    id: string;
    email: string;
    displayName: string;
    role: PrismaUserRole;
    garageAccountId: string | null;
    garageAccount: { id: string; name: string; slug: string; status: string } | null;
  }): Promise<AuthSessionDto> {
    const isSuperAdmin = user.role === PrismaUserRole.SUPER_ADMIN;
    await this.prisma.setTenantContext(user.garageAccountId, isSuperAdmin);

    let enabledModules: ModuleKey[] = MODULE_KEYS as unknown as ModuleKey[];
    if (user.garageAccountId) {
      const mods = await this.prisma.garageAccountModule.findMany({
        where: { garageAccountId: user.garageAccountId, enabled: true },
      });
      enabledModules = mods.map((m) => m.moduleKey as ModuleKey);
    }

    const permissions = await this.rolePermissions.resolvePermissions(
      user.garageAccountId,
      user.role,
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
