import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { LedgerEntryStatus } from "@prisma/client";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { RequireAnyPermissions } from "../auth/decorators/any-permissions.decorator";
import { RequirePermissions } from "../auth/decorators/permissions.decorator";
import type { RequestUser } from "../auth/auth.types";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { CreateExpenseCategoryDto } from "./dto/create-expense-category.dto";
import { CreateLedgerEntryDto } from "./dto/create-ledger-entry.dto";
import { CreatePaymentAccountDto } from "./dto/create-payment-account.dto";
import { UpdateLedgerEntryDto } from "./dto/update-ledger-entry.dto";
import { UpdatePaymentAccountDto } from "./dto/update-payment-account.dto";
import { LedgerService } from "./ledger.service";

@Controller("ledger")
@UseGuards(PermissionsGuard)
export class LedgerController {
  constructor(private readonly ledger: LedgerService) {}

  @Get("accounts")
  @RequireAnyPermissions("ledger.read", "invoices.read")
  listAccounts(
    @CurrentUser() user: RequestUser,
    @Query("includeInactive") includeInactive?: string,
  ) {
    return this.ledger.listAccounts(user, includeInactive === "true");
  }

  @Post("accounts")
  @RequirePermissions("ledger.write")
  createAccount(@CurrentUser() user: RequestUser, @Body() dto: CreatePaymentAccountDto) {
    return this.ledger.createAccount(user, dto);
  }

  @Patch("accounts/:id")
  @RequirePermissions("ledger.write")
  updateAccount(
    @CurrentUser() user: RequestUser,
    @Param("id") id: string,
    @Body() dto: UpdatePaymentAccountDto,
  ) {
    return this.ledger.updateAccount(user, id, dto);
  }

  @Post("categories")
  @RequirePermissions("ledger.write")
  createExpenseCategory(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateExpenseCategoryDto,
  ) {
    return this.ledger.createExpenseCategory(user, dto.label);
  }

  @Get("entries")
  @RequirePermissions("ledger.read")
  listEntries(
    @CurrentUser() user: RequestUser,
    @Query("status") status?: LedgerEntryStatus,
    @Query("paymentAccountId") paymentAccountId?: string,
    @Query("q") q?: string,
  ) {
    return this.ledger.listEntries(user, { status, paymentAccountId, q });
  }

  @Post("entries")
  @RequirePermissions("ledger.write")
  createEntry(@CurrentUser() user: RequestUser, @Body() dto: CreateLedgerEntryDto) {
    return this.ledger.createEntry(user, dto);
  }

  @Patch("entries/:id")
  @RequirePermissions("ledger.write")
  updateEntry(
    @CurrentUser() user: RequestUser,
    @Param("id") id: string,
    @Body() dto: UpdateLedgerEntryDto,
  ) {
    return this.ledger.updateEntry(user, id, dto);
  }

  @Post("entries/:id/check")
  @RequirePermissions("ledger.write")
  checkEntry(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.ledger.checkEntry(user, id);
  }

  @Post("entries/:id/approve")
  @RequirePermissions("ledger.write")
  approveEntry(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.ledger.approveEntry(user, id);
  }

  @Post("entries/:id/void")
  @RequirePermissions("ledger.write")
  voidEntry(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.ledger.voidEntry(user, id);
  }

  @Post("entries/:id/reverse")
  @RequirePermissions("ledger.write")
  reverseEntry(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.ledger.reverseEntry(user, id);
  }
}
