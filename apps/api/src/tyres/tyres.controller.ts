import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { RequirePermissions } from "../auth/decorators/permissions.decorator";
import type { RequestUser } from "../auth/auth.types";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { ConsumeTyreDto } from "./dto/consume-tyre.dto";
import { CreateTyreDto } from "./dto/create-tyre.dto";
import { ReceiveTyreStockDto } from "./dto/receive-stock.dto";
import { SellTyreDto } from "./dto/sell-tyre.dto";
import { UpdateTyreDto } from "./dto/update-tyre.dto";
import { TyresService } from "./tyres.service";

@Controller("tyres")
@UseGuards(PermissionsGuard)
export class TyresController {
  constructor(private readonly tyres: TyresService) {}

  @Get()
  @RequirePermissions("tyres.read")
  list(
    @CurrentUser() user: RequestUser,
    @Query("q") q?: string,
    @Query("lowStock") lowStock?: string,
    @Query("size") size?: string,
  ) {
    return this.tyres.list(user, q, lowStock === "true", size);
  }

  @Post("sale")
  @RequirePermissions("tyres.write", "invoices.write")
  sellCounter(@CurrentUser() user: RequestUser, @Body() dto: SellTyreDto) {
    return this.tyres.sellCounter(user, dto);
  }

  @Post()
  @RequirePermissions("tyres.write")
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateTyreDto) {
    return this.tyres.create(user, dto);
  }

  @Get(":id")
  @RequirePermissions("tyres.read")
  getOne(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.tyres.getOne(user, id);
  }

  @Patch(":id")
  @RequirePermissions("tyres.write")
  update(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: UpdateTyreDto) {
    return this.tyres.update(user, id, dto);
  }

  @Patch(":id/deactivate")
  @RequirePermissions("tyres.write")
  deactivate(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.tyres.deactivate(user, id);
  }

  @Patch(":id/activate")
  @RequirePermissions("tyres.write")
  activate(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.tyres.activate(user, id);
  }

  @Post(":id/receive")
  @RequirePermissions("tyres.write")
  receiveStock(
    @CurrentUser() user: RequestUser,
    @Param("id") id: string,
    @Body() dto: ReceiveTyreStockDto,
  ) {
    return this.tyres.receiveStock(user, id, dto);
  }
}

@Controller("repair-jobs")
@UseGuards(PermissionsGuard)
export class RepairJobTyresController {
  constructor(private readonly tyres: TyresService) {}

  @Get(":id/stock-tyres")
  @RequirePermissions("tyres.read", "repair.read")
  listUsages(@CurrentUser() user: RequestUser, @Param("id") repairJobId: string) {
    return this.tyres.listJobUsages(user, repairJobId);
  }

  @Post(":id/stock-tyres")
  @RequirePermissions("tyres.write", "repair.write")
  consume(
    @CurrentUser() user: RequestUser,
    @Param("id") repairJobId: string,
    @Body() dto: ConsumeTyreDto,
  ) {
    return this.tyres.consumeOnJob(user, repairJobId, dto);
  }

  @Post(":id/stock-tyres/:usageId/return")
  @RequirePermissions("tyres.write", "repair.write")
  returnTyre(
    @CurrentUser() user: RequestUser,
    @Param("id") repairJobId: string,
    @Param("usageId") usageId: string,
  ) {
    return this.tyres.returnFromJob(user, repairJobId, usageId);
  }
}
