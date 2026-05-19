import {
  Body,
  Controller,
  Delete,
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
import { CreateSettingDto } from "./dto/create-setting.dto";
import { UpdateSettingDto } from "./dto/update-setting.dto";
import { SettingsService } from "./settings.service";

@Controller("settings")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  @RequirePermissions("settings.read")
  list(@CurrentUser() user: RequestUser, @Query("optionType") optionType?: string) {
    return this.settings.list(user, optionType);
  }

  @Post()
  @RequirePermissions("settings.write")
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateSettingDto) {
    return this.settings.create(user, dto);
  }

  @Patch(":id")
  @RequirePermissions("settings.write")
  update(
    @CurrentUser() user: RequestUser,
    @Param("id") id: string,
    @Body() dto: UpdateSettingDto,
  ) {
    return this.settings.update(user, id, dto);
  }

  @Delete(":id")
  @RequirePermissions("settings.write")
  remove(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.settings.remove(user, id);
  }
}
