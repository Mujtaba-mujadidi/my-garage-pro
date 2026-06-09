import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  LedgerEntryDirection,
  LedgerEntryStatus,
  LedgerSourceModule,
  Prisma,
  UserRole,
} from "@prisma/client";
import { AuditService } from "../audit/audit.service";
import type { RequestUser } from "../auth/auth.types";
import { PrismaService } from "../prisma/prisma.service";
import { SettingsService } from "../settings/settings.service";
import { CreateLedgerEntryDto } from "./dto/create-ledger-entry.dto";
import { CreatePaymentAccountDto } from "./dto/create-payment-account.dto";
import { UpdateLedgerEntryDto } from "./dto/update-ledger-entry.dto";
import { UpdatePaymentAccountDto } from "./dto/update-payment-account.dto";
import { decimalToString, toLedgerEntryDto, toPaymentAccountDto } from "./ledger.mapper";

@Injectable()
export class LedgerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly settings: SettingsService,
  ) {}

  async createExpenseCategory(user: RequestUser, label: string) {
    this.garageId(user);
    return this.settings.createExpenseCategory(user, label);
  }

  private garageId(user: RequestUser): string {
    if (!user.garageAccountId) throw new ForbiddenException("No garage context");
    if (!user.enabledModules.includes("ledger")) {
      throw new ForbiddenException("Ledger module is not enabled");
    }
    return user.garageAccountId;
  }

  private parseAmounts(gross: number, vat = 0) {
    if (gross <= 0) throw new BadRequestException("Amount must be greater than zero");
    if (vat < 0 || vat > gross) throw new BadRequestException("Invalid VAT amount");
    const amountGross = new Prisma.Decimal(gross.toFixed(2));
    const vatAmount = new Prisma.Decimal(vat.toFixed(2));
    const amountNet = new Prisma.Decimal((gross - vat).toFixed(2));
    return { amountGross, vatAmount, amountNet };
  }

  private parseValueDate(value: string): Date {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) throw new BadRequestException("Invalid value date");
    return d;
  }

  async computeBalance(garageAccountId: string, paymentAccountId: string) {
    const account = await this.prisma.paymentAccount.findFirst({
      where: { id: paymentAccountId, garageAccountId, deletedAt: null },
    });
    if (!account) throw new NotFoundException("Payment account not found");

    const entries = await this.prisma.ledgerEntry.findMany({
      where: {
        garageAccountId,
        paymentAccountId,
        status: LedgerEntryStatus.POSTED,
      },
      select: { direction: true, amountNet: true },
    });

    let movement = new Prisma.Decimal(0);
    for (const e of entries) {
      if (e.direction === LedgerEntryDirection.INCOME) {
        movement = movement.add(e.amountNet);
      } else {
        movement = movement.sub(e.amountNet);
      }
    }
    return account.openingBalance.add(movement);
  }

  async listAccounts(user: RequestUser, includeInactive = false) {
    const garageAccountId = this.garageId(user);
    const rows = await this.prisma.paymentAccount.findMany({
      where: {
        garageAccountId,
        deletedAt: null,
        ...(includeInactive ? {} : { isActive: true }),
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });

    const result = [];
    for (const row of rows) {
      const balance = await this.computeBalance(garageAccountId, row.id);
      result.push(toPaymentAccountDto(row, balance));
    }
    return result;
  }

  async createAccount(user: RequestUser, dto: CreatePaymentAccountDto) {
    const garageAccountId = this.garageId(user);
    const row = await this.prisma.paymentAccount.create({
      data: {
        garageAccountId,
        name: dto.name.trim(),
        type: dto.type,
        openingBalance: new Prisma.Decimal((dto.openingBalance ?? 0).toFixed(2)),
        isActive: dto.isActive ?? true,
      },
    });

    await this.audit.log({
      action: "ledger.account.create",
      userId: user.id,
      garageAccountId,
      entityType: "payment_account",
      entityId: row.id,
      metadata: { name: row.name, type: row.type },
    });

    const balance = await this.computeBalance(garageAccountId, row.id);
    return toPaymentAccountDto(row, balance);
  }

  async updateAccount(user: RequestUser, id: string, dto: UpdatePaymentAccountDto) {
    const garageAccountId = this.garageId(user);
    const existing = await this.prisma.paymentAccount.findFirst({
      where: { id, garageAccountId, deletedAt: null },
    });
    if (!existing) throw new NotFoundException("Payment account not found");

    const row = await this.prisma.paymentAccount.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.openingBalance !== undefined
          ? { openingBalance: new Prisma.Decimal(dto.openingBalance.toFixed(2)) }
          : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });

    await this.audit.log({
      action: "ledger.account.update",
      userId: user.id,
      garageAccountId,
      entityType: "payment_account",
      entityId: row.id,
      metadata: { ...dto },
    });

    const balance = await this.computeBalance(garageAccountId, row.id);
    return toPaymentAccountDto(row, balance);
  }

  private entryInclude = {
    paymentAccount: { select: { name: true } },
    createdBy: { select: { displayName: true } },
  } as const;

  async listEntries(
    user: RequestUser,
    opts?: { status?: LedgerEntryStatus; paymentAccountId?: string; q?: string },
  ) {
    const garageAccountId = this.garageId(user);
    const search = opts?.q?.trim();

    const where: Prisma.LedgerEntryWhereInput = {
      garageAccountId,
      ...(opts?.status ? { status: opts.status } : {}),
      ...(opts?.paymentAccountId ? { paymentAccountId: opts.paymentAccountId } : {}),
    };

    if (search) {
      where.OR = [
        { category: { contains: search, mode: "insensitive" } },
        { notes: { contains: search, mode: "insensitive" } },
        { paymentAccount: { name: { contains: search, mode: "insensitive" } } },
      ];
    }

    const rows = await this.prisma.ledgerEntry.findMany({
      where,
      include: this.entryInclude,
      orderBy: [{ valueDate: "desc" }, { createdAt: "desc" }],
      take: 200,
    });

    return rows.map(toLedgerEntryDto);
  }

  private async getEntryOrThrow(garageAccountId: string, id: string) {
    const row = await this.prisma.ledgerEntry.findFirst({
      where: { id, garageAccountId },
      include: this.entryInclude,
    });
    if (!row) throw new NotFoundException("Ledger entry not found");
    return row;
  }

  async createEntry(user: RequestUser, dto: CreateLedgerEntryDto) {
    const garageAccountId = this.garageId(user);
    const account = await this.prisma.paymentAccount.findFirst({
      where: {
        id: dto.paymentAccountId,
        garageAccountId,
        deletedAt: null,
        isActive: true,
      },
    });
    if (!account) throw new NotFoundException("Payment account not found");

    const amounts = this.parseAmounts(dto.amountGross, dto.vatAmount ?? 0);

    const row = await this.prisma.ledgerEntry.create({
      data: {
        garageAccountId,
        paymentAccountId: dto.paymentAccountId,
        direction: dto.direction,
        status: LedgerEntryStatus.PENDING,
        valueDate: this.parseValueDate(dto.valueDate),
        amountGross: amounts.amountGross,
        vatAmount: amounts.vatAmount,
        amountNet: amounts.amountNet,
        category: dto.category?.trim() || null,
        supplierId: dto.supplierId ?? null,
        notes: dto.notes?.trim() || null,
        createdById: user.id,
      },
      include: this.entryInclude,
    });

    await this.audit.log({
      action: "ledger.entry.create",
      userId: user.id,
      garageAccountId,
      entityType: "ledger_entry",
      entityId: row.id,
      metadata: { direction: row.direction, amountGross: decimalToString(row.amountGross) },
    });

    return toLedgerEntryDto(row);
  }

  async updateEntry(user: RequestUser, id: string, dto: UpdateLedgerEntryDto) {
    const garageAccountId = this.garageId(user);
    const existing = await this.getEntryOrThrow(garageAccountId, id);
    if (existing.status !== LedgerEntryStatus.PENDING) {
      throw new BadRequestException("Only pending entries can be edited");
    }

    let amounts = {
      amountGross: existing.amountGross,
      vatAmount: existing.vatAmount,
      amountNet: existing.amountNet,
    };
    if (dto.amountGross !== undefined || dto.vatAmount !== undefined) {
      amounts = this.parseAmounts(
        dto.amountGross ?? Number(existing.amountGross),
        dto.vatAmount ?? Number(existing.vatAmount),
      );
    }

    if (dto.paymentAccountId) {
      const account = await this.prisma.paymentAccount.findFirst({
        where: { id: dto.paymentAccountId, garageAccountId, deletedAt: null, isActive: true },
      });
      if (!account) throw new NotFoundException("Payment account not found");
    }

    const row = await this.prisma.ledgerEntry.update({
      where: { id },
      data: {
        ...(dto.paymentAccountId !== undefined ? { paymentAccountId: dto.paymentAccountId } : {}),
        ...(dto.valueDate !== undefined ? { valueDate: this.parseValueDate(dto.valueDate) } : {}),
        ...(dto.amountGross !== undefined || dto.vatAmount !== undefined
          ? {
              amountGross: amounts.amountGross,
              vatAmount: amounts.vatAmount,
              amountNet: amounts.amountNet,
            }
          : {}),
        ...(dto.category !== undefined ? { category: dto.category?.trim() || null } : {}),
        ...(dto.supplierId !== undefined ? { supplierId: dto.supplierId ?? null } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes?.trim() || null } : {}),
      },
      include: this.entryInclude,
    });

    await this.audit.log({
      action: "ledger.entry.update",
      userId: user.id,
      garageAccountId,
      entityType: "ledger_entry",
      entityId: row.id,
    });

    return toLedgerEntryDto(row);
  }

  async checkEntry(user: RequestUser, id: string) {
    const garageAccountId = this.garageId(user);
    const existing = await this.getEntryOrThrow(garageAccountId, id);
    if (existing.status !== LedgerEntryStatus.PENDING) {
      throw new BadRequestException("Only pending entries can be checked");
    }

    const row = await this.prisma.ledgerEntry.update({
      where: { id },
      data: {
        status: LedgerEntryStatus.CHECKED,
        checkedById: user.id,
        checkedAt: new Date(),
      },
      include: this.entryInclude,
    });

    await this.audit.log({
      action: "ledger.entry.check",
      userId: user.id,
      garageAccountId,
      entityType: "ledger_entry",
      entityId: row.id,
    });

    return toLedgerEntryDto(row);
  }

  async approveEntry(user: RequestUser, id: string) {
    const garageAccountId = this.garageId(user);
    const existing = await this.getEntryOrThrow(garageAccountId, id);
    if (existing.status !== LedgerEntryStatus.CHECKED) {
      throw new BadRequestException("Only checked entries can be posted");
    }

    if (user.role !== UserRole.OWNER && user.role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException("Only the garage owner can post ledger entries");
    }

    const now = new Date();
    const row = await this.prisma.ledgerEntry.update({
      where: { id },
      data: {
        status: LedgerEntryStatus.POSTED,
        approvedById: user.id,
        postedAt: now,
      },
      include: this.entryInclude,
    });

    await this.audit.log({
      action: "ledger.entry.post",
      userId: user.id,
      garageAccountId,
      entityType: "ledger_entry",
      entityId: row.id,
    });

    return toLedgerEntryDto(row);
  }

  async voidEntry(user: RequestUser, id: string) {
    const garageAccountId = this.garageId(user);
    const existing = await this.getEntryOrThrow(garageAccountId, id);
    if (
      existing.status !== LedgerEntryStatus.PENDING &&
      existing.status !== LedgerEntryStatus.CHECKED
    ) {
      throw new BadRequestException("Posted entries cannot be voided — use reverse");
    }

    const row = await this.prisma.ledgerEntry.update({
      where: { id },
      data: {
        status: LedgerEntryStatus.VOID,
        voidedById: user.id,
        voidedAt: new Date(),
      },
      include: this.entryInclude,
    });

    await this.audit.log({
      action: "ledger.entry.void",
      userId: user.id,
      garageAccountId,
      entityType: "ledger_entry",
      entityId: row.id,
    });

    return toLedgerEntryDto(row);
  }

  async reverseEntry(user: RequestUser, id: string) {
    const garageAccountId = this.garageId(user);
    const original = await this.getEntryOrThrow(garageAccountId, id);
    if (original.status !== LedgerEntryStatus.POSTED) {
      throw new BadRequestException("Only posted entries can be reversed");
    }
    if (original.reversesEntryId) {
      throw new BadRequestException("This entry is already a reversal");
    }

    const existingReversal = await this.prisma.ledgerEntry.findFirst({
      where: { reversesEntryId: original.id },
    });
    if (existingReversal) {
      throw new BadRequestException("This entry has already been reversed");
    }

    if (user.role !== UserRole.OWNER && user.role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException("Only the garage owner can reverse posted entries");
    }

    const opposite =
      original.direction === LedgerEntryDirection.INCOME
        ? LedgerEntryDirection.EXPENSE
        : LedgerEntryDirection.INCOME;

    const now = new Date();
    const row = await this.prisma.ledgerEntry.create({
      data: {
        garageAccountId,
        paymentAccountId: original.paymentAccountId,
        direction: opposite,
        status: LedgerEntryStatus.POSTED,
        valueDate: original.valueDate,
        postedAt: now,
        amountGross: original.amountGross,
        vatAmount: original.vatAmount,
        amountNet: original.amountNet,
        category: original.category,
        supplierId: original.supplierId,
        notes: `Reversal of entry ${original.id.slice(0, 8)}`,
        reversesEntryId: original.id,
        createdById: user.id,
        checkedById: user.id,
        checkedAt: now,
        approvedById: user.id,
      },
      include: this.entryInclude,
    });

    await this.audit.log({
      action: "ledger.entry.reverse",
      userId: user.id,
      garageAccountId,
      entityType: "ledger_entry",
      entityId: row.id,
      metadata: { reversesEntryId: original.id },
    });

    return toLedgerEntryDto(row);
  }

  /** Posted income from a customer payment (Phase 5 invoices). */
  async createPostedIncomeForPayment(
    user: RequestUser,
    params: {
      paymentAccountId: string;
      customerId: string;
      customerPaymentId: string;
      valueDate: Date;
      amountGross: number;
      vatAmount: number;
      reference: string;
    },
  ) {
    const garageAccountId = this.garageId(user);
    const amounts = this.parseAmounts(params.amountGross, params.vatAmount);
    const now = new Date();

    const row = await this.prisma.ledgerEntry.create({
      data: {
        garageAccountId,
        paymentAccountId: params.paymentAccountId,
        customerId: params.customerId,
        customerPaymentId: params.customerPaymentId,
        direction: LedgerEntryDirection.INCOME,
        status: LedgerEntryStatus.POSTED,
        sourceModule: LedgerSourceModule.INVOICES,
        valueDate: params.valueDate,
        postedAt: now,
        amountGross: amounts.amountGross,
        vatAmount: amounts.vatAmount,
        amountNet: amounts.amountNet,
        category: "Customer payment",
        notes: params.reference,
        createdById: user.id,
        checkedById: user.id,
        checkedAt: now,
        approvedById: user.id,
      },
      include: this.entryInclude,
    });

    await this.audit.log({
      action: "ledger.entry.post",
      userId: user.id,
      garageAccountId,
      entityType: "ledger_entry",
      entityId: row.id,
      metadata: { source: "customer_payment", customerPaymentId: params.customerPaymentId },
    });

    return row;
  }

  /** Posted income when a repair job invoice is generated (Phase 6). */
  async createPostedIncomeForRepairJob(
    user: RequestUser,
    params: {
      repairJobId: string;
      customerId: string;
      paymentAccountId: string;
      valueDate: Date;
      amountGross: number;
      vatAmount: number;
      reference: string;
    },
  ) {
    const garageAccountId = this.garageId(user);
    const amounts = this.parseAmounts(params.amountGross, params.vatAmount);
    const now = new Date();

    const row = await this.prisma.ledgerEntry.create({
      data: {
        garageAccountId,
        paymentAccountId: params.paymentAccountId,
        customerId: params.customerId,
        repairJobId: params.repairJobId,
        direction: LedgerEntryDirection.INCOME,
        status: LedgerEntryStatus.POSTED,
        sourceModule: LedgerSourceModule.REPAIR,
        valueDate: params.valueDate,
        postedAt: now,
        amountGross: amounts.amountGross,
        vatAmount: amounts.vatAmount,
        amountNet: amounts.amountNet,
        category: "Repair — labour & parts",
        notes: params.reference,
        createdById: user.id,
        checkedById: user.id,
        checkedAt: now,
        approvedById: user.id,
      },
      include: this.entryInclude,
    });

    await this.audit.log({
      action: "ledger.entry.post",
      userId: user.id,
      garageAccountId,
      entityType: "ledger_entry",
      entityId: row.id,
      metadata: { source: "repair_job", repairJobId: params.repairJobId },
    });

    return row;
  }
}
