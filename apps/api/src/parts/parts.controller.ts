import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { RequirePermissions } from "../auth/decorators/permissions.decorator";
import type { RequestUser } from "../auth/auth.types";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { ConsumePartDto } from "./dto/consume-part.dto";
import { CreatePartDto } from "./dto/create-part.dto";
import { ReceiveStockDto } from "./dto/receive-stock.dto";
import { UpdatePartDto } from "./dto/update-part.dto";
import { PartsService } from "./parts.service";

@Controller("parts")
@UseGuards(PermissionsGuard)
export class PartsController {
  constructor(private readonly parts: PartsService) {}

  @Get()
  @RequirePermissions("parts.read")
  list(
    @CurrentUser() user: RequestUser,
    @Query("q") q?: string,
    @Query("lowStock") lowStock?: string,
    @Query("vehicleMake") vehicleMake?: string,
    @Query("vehicleModel") vehicleModel?: string,
    @Query("vehicleYear") vehicleYear?: string,
  ) {
    const year = vehicleYear ? Number(vehicleYear) : undefined;
    return this.parts.list(user, q, lowStock === "true", {
      make: vehicleMake,
      model: vehicleModel,
      year: Number.isFinite(year) ? year : undefined,
    });
  }

  @Get(":id")
  @RequirePermissions("parts.read")
  getOne(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.parts.getOne(user, id);
  }

  @Post()
  @RequirePermissions("parts.write")
  create(@CurrentUser() user: RequestUser, @Body() dto: CreatePartDto) {
    return this.parts.create(user, dto);
  }

  @Patch(":id")
  @RequirePermissions("parts.write")
  update(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: UpdatePartDto) {
    return this.parts.update(user, id, dto);
  }

  @Patch(":id/deactivate")
  @RequirePermissions("parts.write")
  deactivate(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.parts.deactivate(user, id);
  }

  @Patch(":id/activate")
  @RequirePermissions("parts.write")
  activate(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.parts.activate(user, id);
  }

  @Post(":id/receive")
  @RequirePermissions("parts.write")
  receiveStock(
    @CurrentUser() user: RequestUser,
    @Param("id") id: string,
    @Body() dto: ReceiveStockDto,
  ) {
    return this.parts.receiveStock(user, id, dto);
  }
}

@Controller("repair-jobs")
@UseGuards(PermissionsGuard)
export class RepairJobPartsController {
  constructor(private readonly parts: PartsService) {}

  @Get(":id/stock-parts")
  @RequirePermissions("parts.read", "repair.read")
  listUsages(@CurrentUser() user: RequestUser, @Param("id") repairJobId: string) {
    return this.parts.listJobUsages(user, repairJobId);
  }

  @Post(":id/stock-parts")
  @RequirePermissions("parts.write", "repair.write")
  consume(
    @CurrentUser() user: RequestUser,
    @Param("id") repairJobId: string,
    @Body() dto: ConsumePartDto,
  ) {
    return this.parts.consumeOnJob(user, repairJobId, dto);
  }

  @Post(":id/stock-parts/:usageId/return")
  @RequirePermissions("parts.write", "repair.write")
  returnPart(
    @CurrentUser() user: RequestUser,
    @Param("id") repairJobId: string,
    @Param("usageId") usageId: string,
  ) {
    return this.parts.returnFromJob(user, repairJobId, usageId);
  }
}
