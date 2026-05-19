import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { PrismaService } from "../prisma/prisma.service";
import type { JwtPayload, RequestUser } from "./auth.types";
import { roleHasPermission, type Permission, type ModuleKey } from "@mygaragepro/shared";
import type { UserRole } from "@mygaragepro/shared";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
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
    });
    if (!user) throw new UnauthorizedException();

    const isSuperAdmin = user.role === "SUPER_ADMIN";
    await this.prisma.setTenantContext(user.garageAccountId, isSuperAdmin);

    let enabledModules: ModuleKey[] = [];
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

    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role as UserRole,
      garageAccountId: user.garageAccountId,
      permissions,
      enabledModules,
    };
  }
}
