import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { RequirePermissions } from "../auth/decorators/permissions.decorator";
import type { RequestUser } from "../auth/auth.types";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { ConsumePartDto } from "./dto/consume-part.dto";
import { CreatePartDto } from "./dto/create-part.dto";
import { OrderPartDto } from "./dto/order-part.dto";
import { ReceiveAndConsumePartDto } from "./dto/receive-and-consume-part.dto";
import { ReceiveOrderedPartDto } from "./dto/receive-ordered-part.dto";
import { ReturnJobPartDto } from "./dto/return-job-part.dto";
import { ReceiveStockDto } from "./dto/receive-stock.dto";
import { SellPartDto } from "./dto/sell-part.dto";
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

  @Post("sale")
  @RequirePermissions("parts.write", "invoices.write")
  sellCounter(@CurrentUser() user: RequestUser, @Body() dto: SellPartDto) {
    return this.parts.sellCounter(user, dto);
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

  @Post(":id/stock-parts/order")
  @RequirePermissions("parts.write", "repair.write")
  orderPart(
    @CurrentUser() user: RequestUser,
    @Param("id") repairJobId: string,
    @Body() dto: OrderPartDto,
  ) {
    return this.parts.orderPartOnRepairJob(user, repairJobId, dto);
  }

  @Post(":id/stock-parts/:usageId/receive")
  @RequirePermissions("parts.write", "repair.write")
  receiveOrdered(
    @CurrentUser() user: RequestUser,
    @Param("id") repairJobId: string,
    @Param("usageId") usageId: string,
    @Body() dto: ReceiveOrderedPartDto,
  ) {
    return this.parts.receiveOrderedPartOnRepairJob(user, repairJobId, usageId, dto);
  }

  @Post(":id/stock-parts/:usageId/cancel")
  @RequirePermissions("parts.write", "repair.write")
  cancelOrdered(
    @CurrentUser() user: RequestUser,
    @Param("id") repairJobId: string,
    @Param("usageId") usageId: string,
  ) {
    return this.parts.cancelOrderedPartOnRepairJob(user, repairJobId, usageId);
  }

  @Post(":id/stock-parts/receive-and-consume")
  @RequirePermissions("parts.write", "repair.write")
  receiveAndConsume(
    @CurrentUser() user: RequestUser,
    @Param("id") repairJobId: string,
    @Body() dto: ReceiveAndConsumePartDto,
  ) {
    return this.parts.receiveAndConsumeOnRepairJob(user, repairJobId, dto);
  }

  @Post(":id/stock-parts/:usageId/return")
  @RequirePermissions("parts.write", "repair.write")
  returnPart(
    @CurrentUser() user: RequestUser,
    @Param("id") repairJobId: string,
    @Param("usageId") usageId: string,
    @Body() dto?: ReturnJobPartDto,
  ) {
    return this.parts.returnFromJob(user, repairJobId, usageId, dto);
  }
}

@Controller("bodywork-jobs")
@UseGuards(PermissionsGuard)
export class BodyworkJobPartsController {
  constructor(private readonly parts: PartsService) {}

  @Get(":id/stock-parts")
  @RequirePermissions("parts.read", "bodywork.read")
  listUsages(@CurrentUser() user: RequestUser, @Param("id") bodyworkJobId: string) {
    return this.parts.listBodyworkJobUsages(user, bodyworkJobId);
  }

  @Post(":id/stock-parts")
  @RequirePermissions("parts.write", "bodywork.write")
  consume(
    @CurrentUser() user: RequestUser,
    @Param("id") bodyworkJobId: string,
    @Body() dto: ConsumePartDto,
  ) {
    return this.parts.consumeOnBodyworkJob(user, bodyworkJobId, dto);
  }

  @Post(":id/stock-parts/receive-and-consume")
  @RequirePermissions("parts.write", "bodywork.write")
  receiveAndConsume(
    @CurrentUser() user: RequestUser,
    @Param("id") bodyworkJobId: string,
    @Body() dto: ReceiveAndConsumePartDto,
  ) {
    return this.parts.receiveAndConsumeOnBodyworkJob(user, bodyworkJobId, dto);
  }

  @Post(":id/stock-parts/:usageId/return")
  @RequirePermissions("parts.write", "bodywork.write")
  returnPart(
    @CurrentUser() user: RequestUser,
    @Param("id") bodyworkJobId: string,
    @Param("usageId") usageId: string,
  ) {
    return this.parts.returnFromBodyworkJob(user, bodyworkJobId, usageId);
  }
}
