import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import * as argon2 from "argon2";
import { RequirePermissions } from "../auth/decorators/permissions.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import type { RequestUser } from "../auth/auth.types";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import { ConflictException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { CreateTeamUserDto } from "./dto/create-team-user.dto";

@Controller("users")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class UsersController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @Get("roles")
  @RequirePermissions("users.read")
  async listRoles(@CurrentUser() user: RequestUser) {
    if (!user.garageAccountId) throw new ForbiddenException();
    return this.prisma.garageRole.findMany({
      where: { garageAccountId: user.garageAccountId },
      select: { id: true, name: true, slug: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
  }

  @Get()
  @RequirePermissions("users.read")
  async list(@CurrentUser() user: RequestUser) {
    if (!user.garageAccountId) throw new ForbiddenException();
    const rows = await this.prisma.user.findMany({
      where: { garageAccountId: user.garageAccountId, deletedAt: null },
      include: { garageRole: { select: { id: true, name: true } } },
      orderBy: { displayName: "asc" },
    });
    return rows.map((u) => ({
      id: u.id,
      email: u.email,
      displayName: u.displayName,
      role: u.role === UserRole.OWNER ? "OWNER" : u.role === UserRole.SUPER_ADMIN ? "SUPER_ADMIN" : "STAFF",
      status: u.status,
      garageRoleId: u.garageRoleId,
      garageRoleName: u.garageRole?.name ?? null,
    }));
  }

  @Post()
  @RequirePermissions("users.write")
  async create(@CurrentUser() user: RequestUser, @Body() dto: CreateTeamUserDto) {
    if (!user.garageAccountId) throw new ForbiddenException();

    const garageRole = await this.prisma.garageRole.findFirst({
      where: { id: dto.garageRoleId, garageAccountId: user.garageAccountId },
    });
    if (!garageRole) throw new NotFoundException("Role not found");

    const email = dto.email.toLowerCase().trim();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new ConflictException("Email already registered");

    const created = await this.prisma.user.create({
      data: {
        email,
        displayName: dto.displayName,
        role: UserRole.STAFF,
        garageRoleId: dto.garageRoleId,
        garageAccountId: user.garageAccountId,
        passwordHash: await argon2.hash(dto.password),
      },
      include: { garageRole: { select: { id: true, name: true } } },
    });

    await this.audit.log({
      action: "users.create",
      userId: user.id,
      garageAccountId: user.garageAccountId,
      entityType: "user",
      entityId: created.id,
      metadata: { email, garageRoleId: dto.garageRoleId, garageRoleName: garageRole.name },
    });

    return {
      id: created.id,
      email: created.email,
      displayName: created.displayName,
      role: "STAFF",
      garageRoleId: created.garageRoleId,
      garageRoleName: created.garageRole?.name ?? null,
    };
  }
}
