import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { RequirePermissions } from "../auth/decorators/permissions.decorator";
import type { RequestUser } from "../auth/auth.types";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { CreateSupplierDto } from "./dto/create-supplier.dto";
import { UpdateSupplierDto } from "./dto/update-supplier.dto";
import { SupplierCreditService } from "./supplier-credit.service";
import { SuppliersService } from "./suppliers.service";

@Controller("suppliers")
@UseGuards(PermissionsGuard)
export class SuppliersController {
  constructor(
    private readonly suppliers: SuppliersService,
    private readonly supplierCredit: SupplierCreditService,
  ) {}

  @Get()
  @RequirePermissions("suppliers.read")
  list(
    @CurrentUser() user: RequestUser,
    @Query("q") q?: string,
    @Query("includeInactive") includeInactive?: string,
  ) {
    return this.suppliers.list(user, q, includeInactive === "true");
  }

  @Get(":id")
  @RequirePermissions("suppliers.read")
  getOne(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.suppliers.getOne(user, id);
  }

  @Get(":id/credit-transactions")
  @RequirePermissions("suppliers.read")
  listCreditTransactions(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.supplierCredit.listTransactions(user, id);
  }

  @Get(":id/part-orders")
  @RequirePermissions("suppliers.read")
  listPartOrders(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.suppliers.listPartOrders(user, id);
  }

  @Get(":id/purchases")
  @RequirePermissions("suppliers.read")
  listPurchases(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.suppliers.listPurchases(user, id);
  }

  @Post()
  @RequirePermissions("suppliers.write")
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateSupplierDto) {
    return this.suppliers.create(user, dto);
  }

  @Patch(":id")
  @RequirePermissions("suppliers.write")
  update(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: UpdateSupplierDto) {
    return this.suppliers.update(user, id, dto);
  }

  @Patch(":id/deactivate")
  @RequirePermissions("suppliers.write")
  deactivate(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.suppliers.deactivate(user, id);
  }

  @Patch(":id/activate")
  @RequirePermissions("suppliers.write")
  activate(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.suppliers.activate(user, id);
  }
}

