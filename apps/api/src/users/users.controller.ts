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
import { CreateGarageUserDto } from "../platform/dto/create-garage-user.dto";
import { ConflictException, ForbiddenException } from "@nestjs/common";

@Controller("users")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class UsersController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @RequirePermissions("users.read")
  async list(@CurrentUser() user: RequestUser) {
    if (!user.garageAccountId) throw new ForbiddenException();
    return this.prisma.user.findMany({
      where: { garageAccountId: user.garageAccountId, deletedAt: null },
      select: { id: true, email: true, displayName: true, role: true, status: true },
      orderBy: { displayName: "asc" },
    });
  }

  @Post()
  @RequirePermissions("users.write")
  async create(@CurrentUser() user: RequestUser, @Body() dto: CreateGarageUserDto) {
    if (!user.garageAccountId) throw new ForbiddenException();
    if (dto.role === UserRole.SUPER_ADMIN) throw new ForbiddenException();
    if (user.role === "MANAGER" && (dto.role === UserRole.OWNER || dto.role === UserRole.MANAGER)) {
      throw new ForbiddenException("Managers cannot create owners or managers");
    }

    const email = dto.email.toLowerCase().trim();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new ConflictException("Email already registered");

    const created = await this.prisma.user.create({
      data: {
        email,
        displayName: dto.displayName,
        role: dto.role,
        garageAccountId: user.garageAccountId,
        passwordHash: await argon2.hash(dto.password),
      },
      select: { id: true, email: true, displayName: true, role: true },
    });

    await this.audit.log({
      action: "users.create",
      userId: user.id,
      garageAccountId: user.garageAccountId,
      entityType: "user",
      entityId: created.id,
      metadata: { email, role: dto.role },
    });

    return created;
  }
}
