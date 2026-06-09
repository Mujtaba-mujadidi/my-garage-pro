import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Query,
  StreamableFile,
  UseGuards,
} from "@nestjs/common";
import { InvoiceStatus } from "@prisma/client";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { RequirePermissions } from "../auth/decorators/permissions.decorator";
import type { RequestUser } from "../auth/auth.types";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { CreateInvoiceDto } from "./dto/create-invoice.dto";
import { CreatePaymentDto } from "./dto/create-payment.dto";
import { UpdateInvoiceDto } from "./dto/update-invoice.dto";
import { InvoicesService } from "./invoices.service";

@Controller("invoices")
@UseGuards(PermissionsGuard)
export class InvoicesController {
  constructor(private readonly invoices: InvoicesService) {}

  @Get()
  @RequirePermissions("invoices.read")
  list(
    @CurrentUser() user: RequestUser,
    @Query("customerId") customerId?: string,
    @Query("status") status?: InvoiceStatus,
  ) {
    return this.invoices.list(user, customerId, status);
  }

  @Get("payments")
  @RequirePermissions("invoices.read")
  listPayments(
    @CurrentUser() user: RequestUser,
    @Query("customerId") customerId?: string,
  ) {
    return this.invoices.listPayments(user, customerId);
  }

  @Get("customers/:customerId/balance")
  @RequirePermissions("invoices.read")
  customerBalance(
    @CurrentUser() user: RequestUser,
    @Param("customerId") customerId: string,
  ) {
    return this.invoices.getCustomerBalance(user, customerId);
  }

  @Get("customers/:customerId/open")
  @RequirePermissions("invoices.read")
  openInvoices(
    @CurrentUser() user: RequestUser,
    @Param("customerId") customerId: string,
  ) {
    return this.invoices.listOpenForCustomer(user, customerId);
  }

  @Get(":id")
  @RequirePermissions("invoices.read")
  getOne(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.invoices.getOne(user, id);
  }

  @Get(":id/pdf")
  @RequirePermissions("invoices.read")
  @Header("Content-Type", "application/pdf")
  pdf(@CurrentUser() user: RequestUser, @Param("id") id: string): Promise<StreamableFile> {
    return this.invoices.renderPdf(user, id);
  }

  @Post()
  @RequirePermissions("invoices.write")
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateInvoiceDto) {
    return this.invoices.create(user, dto);
  }

  @Patch(":id")
  @RequirePermissions("invoices.write")
  update(
    @CurrentUser() user: RequestUser,
    @Param("id") id: string,
    @Body() dto: UpdateInvoiceDto,
  ) {
    return this.invoices.update(user, id, dto);
  }

  @Post(":id/send")
  @RequirePermissions("invoices.write")
  send(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.invoices.send(user, id);
  }

  @Post(":id/cancel")
  @RequirePermissions("invoices.write")
  cancel(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.invoices.cancel(user, id);
  }

  @Post("payments")
  @RequirePermissions("invoices.write")
  recordPayment(@CurrentUser() user: RequestUser, @Body() dto: CreatePaymentDto) {
    return this.invoices.recordPayment(user, dto);
  }

  @Delete("allocations/:allocationId")
  @RequirePermissions("invoices.write")
  undoAllocation(
    @CurrentUser() user: RequestUser,
    @Param("allocationId") allocationId: string,
  ) {
    return this.invoices.undoAllocation(user, allocationId);
  }
}
