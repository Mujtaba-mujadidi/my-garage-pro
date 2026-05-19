import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import type { ModuleKey, UserRole } from "@mygaragepro/shared";
import { UserRole as PrismaUserRole } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { GarageRolesService } from "../garage-roles/garage-roles.service";
import type { JwtPayload, RequestUser } from "./auth.types";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly garageRoles: GarageRolesService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>("JWT_SECRET"),
    });
  }

  async validate(payload: JwtPayload): Promise<RequestUser> {
    const user = await this.prisma.user.findFirst({
      where: { id: payload.sub, status: "ACTIVE", deletedAt: null },
      include: { garageRole: true },
    });
    if (!user) throw new UnauthorizedException();

    const isSuperAdmin = user.role === PrismaUserRole.SUPER_ADMIN;
    await this.prisma.setTenantContext(user.garageAccountId, isSuperAdmin);

    let enabledModules: ModuleKey[] = [];
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

    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: sessionRole,
      garageAccountId: user.garageAccountId,
      garageRoleId: user.garageRoleId,
      garageRoleName: user.garageRole?.name ?? null,
      permissions,
      enabledModules,
    };
  }

  private toSessionRole(role: PrismaUserRole): UserRole {
    if (role === PrismaUserRole.SUPER_ADMIN) return "SUPER_ADMIN";
    if (role === PrismaUserRole.OWNER) return "OWNER";
    return "STAFF";
  }
}
