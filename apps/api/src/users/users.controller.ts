import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { UserRole, UserStatus } from "@prisma/client";
import * as argon2 from "argon2";
import { RequirePermissions } from "../auth/decorators/permissions.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import type { RequestUser } from "../auth/auth.types";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import { ConflictException } from "@nestjs/common";
import { CreateTeamUserDto } from "./dto/create-team-user.dto";
import { UpdateTeamUserDto } from "./dto/update-team-user.dto";

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
    return rows.map((u) => this.toDto(u));
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
    const existing = await this.prisma.user.findFirst({
      where: { email, deletedAt: null },
    });
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

    return this.toDto(created);
  }

  @Patch(":id")
  @RequirePermissions("users.write")
  async update(
    @CurrentUser() actor: RequestUser,
    @Param("id") id: string,
    @Body() dto: UpdateTeamUserDto,
  ) {
    if (!actor.garageAccountId) throw new ForbiddenException();

    const target = await this.prisma.user.findFirst({
      where: { id, garageAccountId: actor.garageAccountId, deletedAt: null },
      include: { garageRole: { select: { id: true, name: true } } },
    });
    if (!target) throw new NotFoundException("User not found");

    if (target.role === UserRole.OWNER) {
      if (dto.garageRoleId !== undefined || dto.status === UserStatus.DISABLED) {
        throw new ForbiddenException("The garage owner account cannot be disabled or reassigned");
      }
    }

    if (target.role === UserRole.SUPER_ADMIN) {
      throw new ForbiddenException("Cannot edit platform admin accounts");
    }

    if (dto.garageRoleId !== undefined) {
      if (target.role !== UserRole.STAFF) {
        throw new ForbiddenException("Only staff accounts have a garage role");
      }
      const garageRole = await this.prisma.garageRole.findFirst({
        where: { id: dto.garageRoleId, garageAccountId: actor.garageAccountId },
      });
      if (!garageRole) throw new NotFoundException("Role not found");
    }

    if (dto.email !== undefined) {
      const email = dto.email.toLowerCase().trim();
      const existing = await this.prisma.user.findFirst({
        where: { email, deletedAt: null, NOT: { id: target.id } },
      });
      if (existing) throw new ConflictException("Email already registered");
    }

    const updated = await this.prisma.user.update({
      where: { id: target.id },
      data: {
        ...(dto.displayName !== undefined ? { displayName: dto.displayName.trim() } : {}),
        ...(dto.email !== undefined ? { email: dto.email.toLowerCase().trim() } : {}),
        ...(dto.garageRoleId !== undefined ? { garageRoleId: dto.garageRoleId } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.password !== undefined ? { passwordHash: await argon2.hash(dto.password) } : {}),
      },
      include: { garageRole: { select: { id: true, name: true } } },
    });

    await this.audit.log({
      action: "users.update",
      userId: actor.id,
      garageAccountId: actor.garageAccountId,
      entityType: "user",
      entityId: updated.id,
      metadata: {
        email: updated.email,
        changes: { ...dto },
      },
    });

    return this.toDto(updated);
  }

  @Delete(":id")
  @RequirePermissions("users.write")
  async remove(@CurrentUser() actor: RequestUser, @Param("id") id: string) {
    if (!actor.garageAccountId) throw new ForbiddenException();

    if (actor.id === id) {
      throw new ForbiddenException("You cannot delete your own account");
    }

    const target = await this.prisma.user.findFirst({
      where: { id, garageAccountId: actor.garageAccountId, deletedAt: null },
    });
    if (!target) throw new NotFoundException("User not found");

    if (target.role === UserRole.OWNER) {
      throw new ForbiddenException("The garage owner account cannot be deleted");
    }
    if (target.role === UserRole.SUPER_ADMIN) {
      throw new ForbiddenException("Cannot delete platform admin accounts");
    }

    await this.prisma.user.update({
      where: { id: target.id },
      data: { deletedAt: new Date(), deletedBy: actor.id },
    });

    await this.audit.log({
      action: "users.delete",
      userId: actor.id,
      garageAccountId: actor.garageAccountId,
      entityType: "user",
      entityId: target.id,
      metadata: { email: target.email, displayName: target.displayName },
    });

    return { ok: true };
  }

  private toDto(u: {
    id: string;
    email: string;
    displayName: string;
    role: UserRole;
    status: UserStatus;
    garageRoleId: string | null;
    garageRole?: { id: string; name: string } | null;
  }) {
    return {
      id: u.id,
      email: u.email,
      displayName: u.displayName,
      role:
        u.role === UserRole.OWNER
          ? "OWNER"
          : u.role === UserRole.SUPER_ADMIN
            ? "SUPER_ADMIN"
            : "STAFF",
      status: u.status,
      garageRoleId: u.garageRoleId,
      garageRoleName: u.garageRole?.name ?? null,
    };
  }
}
