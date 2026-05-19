import { Body, Controller, Get, Put, UseGuards } from "@nestjs/common";
import { RequirePermissions } from "../auth/decorators/permissions.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import type { RequestUser } from "../auth/auth.types";
import { UpdateRolePermissionsDto } from "./dto/update-role-permissions.dto";
import { RolePermissionsService } from "./role-permissions.service";

@Controller("settings/role-permissions")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class RolePermissionsController {
  constructor(private readonly rolePermissions: RolePermissionsService) {}

  @Get()
  @RequirePermissions("permissions.manage")
  getMatrix(@CurrentUser() user: RequestUser) {
    return this.rolePermissions.getMatrix(user);
  }

  @Put()
  @RequirePermissions("permissions.manage")
  updateMatrix(@CurrentUser() user: RequestUser, @Body() dto: UpdateRolePermissionsDto) {
    return this.rolePermissions.updateMatrix(user, dto.grants);
  }
}
