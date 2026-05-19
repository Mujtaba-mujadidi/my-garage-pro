import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from "@nestjs/common";
import { RequirePermissions } from "../auth/decorators/permissions.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import type { RequestUser } from "../auth/auth.types";
import { CreateGarageRoleDto } from "./dto/create-garage-role.dto";
import { UpdateGarageRoleDto } from "./dto/update-garage-role.dto";
import { GarageRolesService } from "./garage-roles.service";

@Controller("settings/garage-roles")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class GarageRolesController {
  constructor(private readonly garageRoles: GarageRolesService) {}

  @Get()
  @RequirePermissions("permissions.manage")
  list(@CurrentUser() user: RequestUser) {
    return this.garageRoles.list(user);
  }

  @Get(":id")
  @RequirePermissions("permissions.manage")
  getOne(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.garageRoles.getOne(user, id);
  }

  @Post()
  @RequirePermissions("permissions.manage")
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateGarageRoleDto) {
    return this.garageRoles.create(user, dto.name, dto.permissions ?? []);
  }

  @Put(":id")
  @RequirePermissions("permissions.manage")
  update(
    @CurrentUser() user: RequestUser,
    @Param("id") id: string,
    @Body() dto: UpdateGarageRoleDto,
  ) {
    return this.garageRoles.update(user, id, {
      name: dto.name,
      permissions: dto.permissions,
    });
  }

  @Delete(":id")
  @RequirePermissions("permissions.manage")
  remove(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.garageRoles.remove(user, id);
  }
}
