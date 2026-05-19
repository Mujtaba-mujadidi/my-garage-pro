import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { RequirePermissions } from "../auth/decorators/permissions.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import type { RequestUser } from "../auth/auth.types";
import { CreateGarageDto } from "./dto/create-garage.dto";
import { CreateGarageUserDto } from "./dto/create-garage-user.dto";
import { UpdateGarageModulesDto } from "./dto/update-garage-modules.dto";
import { PlatformService } from "./platform.service";

@Controller("platform")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PlatformController {
  constructor(private readonly platform: PlatformService) {}

  @Get("garages")
  @RequirePermissions("platform.garage.manage")
  listGarages() {
    return this.platform.listGarages();
  }

  @Post("garages")
  @RequirePermissions("platform.garage.manage")
  createGarage(@CurrentUser() user: RequestUser, @Body() dto: CreateGarageDto) {
    return this.platform.createGarage(user, dto);
  }

  @Patch("garages/:id/suspend")
  @RequirePermissions("platform.garage.manage")
  suspend(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.platform.setGarageStatus(user, id, "SUSPENDED");
  }

  @Patch("garages/:id/activate")
  @RequirePermissions("platform.garage.manage")
  activate(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.platform.setGarageStatus(user, id, "ACTIVE");
  }

  @Patch("garages/:id/modules")
  @RequirePermissions("platform.garage.manage")
  updateModules(
    @CurrentUser() user: RequestUser,
    @Param("id") id: string,
    @Body() dto: UpdateGarageModulesDto,
  ) {
    return this.platform.updateModules(user, id, dto);
  }

  @Post("garages/:garageId/users")
  @RequirePermissions("platform.garage.manage", "users.write")
  createUser(
    @CurrentUser() user: RequestUser,
    @Param("garageId") garageId: string,
    @Body() dto: CreateGarageUserDto,
  ) {
    return this.platform.createGarageUser(user, garageId, dto);
  }

  @Get("audit")
  @RequirePermissions("platform.audit.read")
  audit(@Query("limit") limit?: string) {
    return this.platform.listAuditLogs(limit ? Number(limit) : 50);
  }
}
