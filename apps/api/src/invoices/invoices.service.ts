import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  StreamableFile,
} from "@nestjs/common";
import { invoiceBalanceDue } from "@mygaragepro/shared";
import { InvoiceStatus, Prisma, UserRole } from "@prisma/client";
import { AuditService } from "../audit/audit.service";
import type { RequestUser } from "../auth/auth.types";
import { LedgerService } from "../ledger/ledger.service";
import { PrismaService } from "../prisma/prisma.service";
import { CreateInvoiceDto } from "./dto/create-invoice.dto";
import { CreatePaymentDto } from "./dto/create-payment.dto";
import { UpdateInvoiceDto } from "./dto/update-invoice.dto";
import {
  allocatedTotal,
  calcLine,
  roundMoney,
  sumLines,
  type LineCalcInput,
} from "./invoice-calculations";
import { customerDisplayName, toInvoiceDto, toPaymentDto } from "./invoices.mapper";
import { InvoicePdfService } from "./invoice-pdf.service";

@Injectable()
export class InvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly ledger: LedgerService,
    private readonly pdf: InvoicePdfService,
  ) {}

  private garageId(user: RequestUser): string {
    if (!user.garageAccountId) throw new ForbiddenException("No garage context");
    if (!user.enabledModules.includes("invoices")) {
      throw new ForbiddenException("Invoices module is not enabled");
    }
    return user.garageAccountId;
  }

  private invoiceInclude = {
    customer: true,
    lines: { orderBy: { sortOrder: "asc" as const } },
    allocations: true,
  };

  private paymentInclude = {
    customer: true,
    paymentAccount: true,
    allocations: { include: { invoice: true } },
  };

  private async nextInvoiceNumber(garageAccountId: string): Promise<string> {
    const garage = await this.prisma.garageAccount.update({
      where: { id: garageAccountId },
      data: { invoiceNextSeq: { increment: 1 } },
      select: { invoiceNextSeq: true },
    });
    const year = new Date().getFullYear();
    return `INV-${year}-${String(garage.invoiceNextSeq).padStart(5, "0")}`;
  }

  private parseDate(value: string): Date {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) throw new BadRequestException("Invalid date");
    return d;
  }

  private normalizeVehicleReg(value?: string): string | null {
    const v = value?.trim().replace(/\s+/g, " ").toUpperCase();
    return v || null;
  }

  private calcLines(
    lines: { lineType: LineCalcInput["lineType"]; description: string; quantity: number; unitPriceNet: number; vatRatePercent?: number }[],
  ) {
    return lines.map((l) => calcLine(l));
  }

  private lineCreateData(lineCalcs: ReturnType<typeof calcLine>[], startOrder = 0) {
    return lineCalcs.map((l, i) => ({
      lineType: l.lineType,
      description: l.description,
      quantity: l.quantity,
      unitPriceNet: l.unitPriceNet,
      vatRatePercent: l.vatRatePercent,
      amountNet: l.amountNet,
      vatAmount: l.vatAmount,
      amountGross: l.amountGross,
      sortOrder: startOrder + i,
    }));
  }

  async list(user: RequestUser, customerId?: string, status?: InvoiceStatus) {
    const garageAccountId = this.garageId(user);
    const rows = await this.prisma.invoice.findMany({
      where: {
        garageAccountId,
        ...(customerId ? { customerId } : {}),
        ...(status ? { status } : {}),
      },
      include: this.invoiceInclude,
      orderBy: [{ createdAt: "desc" }],
      take: 200,
    });
    return rows.map(toInvoiceDto);
  }

  async getOne(user: RequestUser, id: string) {
    const garageAccountId = this.garageId(user);
    const row = await this.prisma.invoice.findFirst({
      where: { id, garageAccountId },
      include: this.invoiceInclude,
    });
    if (!row) throw new NotFoundException("Invoice not found");
    return toInvoiceDto(row);
  }

  async getCustomerBalance(user: RequestUser, customerId: string) {
    const garageAccountId = this.garageId(user);
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, garageAccountId, deletedAt: null },
    });
    if (!customer) throw new NotFoundException("Customer not found");

    const invoices = await this.prisma.invoice.findMany({
      where: {
        garageAccountId,
        customerId,
        status: { in: [InvoiceStatus.SENT, InvoiceStatus.PART_PAID] },
      },
      include: { allocations: true },
    });

    let balanceDue = 0;
    let totalInvoiced = 0;
    for (const inv of invoices) {
      const gross = Number(inv.amountGross);
      const paid = allocatedTotal(inv.allocations);
      totalInvoiced += gross;
      balanceDue += invoiceBalanceDue(gross, Number(inv.depositAmount), paid);
    }

    const payments = await this.prisma.customerPayment.findMany({
      where: { garageAccountId, customerId },
      include: { allocations: true },
    });
    let creditUnallocated = 0;
    for (const p of payments) {
      const amt = Number(p.amount);
      const alloc = p.allocations
        .filter((a) => !a.deletedAt)
        .reduce((s, a) => s + Number(a.amount), 0);
      creditUnallocated += Math.max(0, amt - alloc);
    }

    const paidInvoices = await this.prisma.invoice.findMany({
      where: { garageAccountId, customerId, status: InvoiceStatus.PAID },
      include: { allocations: true },
    });
    const totalPaidOnInvoices = paidInvoices.reduce(
      (s, inv) => s + allocatedTotal(inv.allocations),
      0,
    );

    return {
      customerId,
      customerName: customerDisplayName(customer),
      totalInvoiced: totalInvoiced.toFixed(2),
      totalPaid: totalPaidOnInvoices.toFixed(2),
      balanceDue: balanceDue.toFixed(2),
      creditUnallocated: creditUnallocated.toFixed(2),
    };
  }

  async listOpenForCustomer(user: RequestUser, customerId: string) {
    const garageAccountId = this.garageId(user);
    const rows = await this.prisma.invoice.findMany({
      where: {
        garageAccountId,
        customerId,
        status: { in: [InvoiceStatus.SENT, InvoiceStatus.PART_PAID] },
      },
      include: this.invoiceInclude,
      orderBy: [{ issueDate: "asc" }, { createdAt: "asc" }],
    });
    return rows.map(toInvoiceDto);
  }

  async create(user: RequestUser, dto: CreateInvoiceDto) {
    const garageAccountId = this.garageId(user);
    const customer = await this.prisma.customer.findFirst({
      where: { id: dto.customerId, garageAccountId, deletedAt: null },
      include: { accountTerms: true },
    });
    if (!customer) throw new NotFoundException("Customer not found");

    const lineCalcs = this.calcLines(dto.lines);
    const totals = sumLines(lineCalcs);
    const deposit = dto.depositAmount ?? 0;
    if (deposit < 0) throw new BadRequestException("Deposit cannot be negative");
    if (deposit > Number(totals.amountGross) + 0.009) {
      throw new BadRequestException("Deposit cannot exceed invoice total");
    }
    const invoiceNumber = await this.nextInvoiceNumber(garageAccountId);
    const send = dto.sendImmediately ?? false;

    const row = await this.prisma.$transaction(async (tx) => {
      const issueDate = send ? new Date() : null;
      const terms = customer.accountTerms?.paymentTermsDays ?? 30;
      const dueDate =
        send && issueDate
          ? new Date(issueDate.getTime() + terms * 24 * 60 * 60 * 1000)
          : null;

      const invoice = await tx.invoice.create({
        data: {
          garageAccountId,
          customerId: dto.customerId,
          invoiceNumber,
          status: send ? InvoiceStatus.SENT : InvoiceStatus.DRAFT,
          issueDate,
          dueDate,
          amountNet: totals.amountNet,
          vatAmount: totals.vatAmount,
          amountGross: totals.amountGross,
          vehicleRegistration: this.normalizeVehicleReg(dto.vehicleRegistration),
          depositAmount: roundMoney(deposit),
          notes: dto.notes?.trim() || null,
          createdById: user.id,
          sentAt: send ? new Date() : null,
          lines: {
            create: this.lineCreateData(lineCalcs),
          },
        },
        include: this.invoiceInclude,
      });
      return invoice;
    });

    await this.audit.log({
      action: "invoices.create",
      userId: user.id,
      garageAccountId,
      entityType: "invoice",
      entityId: row.id,
      metadata: { invoiceNumber: row.invoiceNumber, status: row.status },
    });

    return toInvoiceDto(row);
  }

  async update(user: RequestUser, id: string, dto: UpdateInvoiceDto) {
    const garageAccountId = this.garageId(user);
    const existing = await this.prisma.invoice.findFirst({
      where: { id, garageAccountId },
    });
    if (!existing) throw new NotFoundException("Invoice not found");
    if (existing.status !== InvoiceStatus.DRAFT) {
      throw new BadRequestException("Only draft invoices can be edited");
    }

    const lineCalcs = dto.lines ? this.calcLines(dto.lines) : null;
    const totals = lineCalcs ? sumLines(lineCalcs) : null;
    const gross = totals ? Number(totals.amountGross) : Number(existing.amountGross);
    const deposit =
      dto.depositAmount !== undefined ? dto.depositAmount : Number(existing.depositAmount);
    if (deposit < 0) throw new BadRequestException("Deposit cannot be negative");
    if (deposit > gross + 0.009) {
      throw new BadRequestException("Deposit cannot exceed invoice total");
    }

    const row = await this.prisma.$transaction(async (tx) => {
      if (lineCalcs) {
        await tx.invoiceLine.deleteMany({ where: { invoiceId: id } });
        await tx.invoiceLine.createMany({
          data: this.lineCreateData(lineCalcs).map((l) => ({
            invoiceId: id,
            ...l,
          })),
        });
      }
      return tx.invoice.update({
        where: { id },
        data: {
          ...(totals
            ? {
                amountNet: totals.amountNet,
                vatAmount: totals.vatAmount,
                amountGross: totals.amountGross,
              }
            : {}),
          ...(dto.vehicleRegistration !== undefined
            ? { vehicleRegistration: this.normalizeVehicleReg(dto.vehicleRegistration) }
            : {}),
          ...(dto.depositAmount !== undefined
            ? { depositAmount: roundMoney(dto.depositAmount) }
            : {}),
          ...(dto.notes !== undefined ? { notes: dto.notes?.trim() || null } : {}),
        },
        include: this.invoiceInclude,
      });
    });

    await this.audit.log({
      action: "invoices.update",
      userId: user.id,
      garageAccountId,
      entityType: "invoice",
      entityId: row.id,
    });

    return toInvoiceDto(row);
  }

  async send(user: RequestUser, id: string) {
    const garageAccountId = this.garageId(user);
    const existing = await this.prisma.invoice.findFirst({
      where: { id, garageAccountId },
      include: { customer: { include: { accountTerms: true } } },
    });
    if (!existing) throw new NotFoundException("Invoice not found");
    if (existing.status !== InvoiceStatus.DRAFT) {
      throw new BadRequestException("Only draft invoices can be sent");
    }

    const issueDate = new Date();
    const terms = existing.customer.accountTerms?.paymentTermsDays ?? 30;
    const dueDate = new Date(issueDate.getTime() + terms * 24 * 60 * 60 * 1000);

    const row = await this.prisma.invoice.update({
      where: { id },
      data: {
        status: InvoiceStatus.SENT,
        issueDate,
        dueDate,
        sentAt: new Date(),
      },
      include: this.invoiceInclude,
    });

    await this.audit.log({
      action: "invoices.send",
      userId: user.id,
      garageAccountId,
      entityType: "invoice",
      entityId: row.id,
    });

    return toInvoiceDto(row);
  }

  async cancel(user: RequestUser, id: string) {
    const garageAccountId = this.garageId(user);
    const existing = await this.prisma.invoice.findFirst({
      where: { id, garageAccountId },
      include: { allocations: true },
    });
    if (!existing) throw new NotFoundException("Invoice not found");
    if (existing.status === InvoiceStatus.PAID || existing.status === InvoiceStatus.CANCELLED) {
      throw new BadRequestException("Cannot cancel this invoice");
    }
    if (allocatedTotal(existing.allocations) > 0.009) {
      throw new BadRequestException("Cannot cancel an invoice with payments allocated");
    }

    const row = await this.prisma.invoice.update({
      where: { id },
      data: { status: InvoiceStatus.CANCELLED },
      include: this.invoiceInclude,
    });

    await this.audit.log({
      action: "invoices.cancel",
      userId: user.id,
      garageAccountId,
      entityType: "invoice",
      entityId: row.id,
    });

    return toInvoiceDto(row);
  }

  async recordPayment(user: RequestUser, dto: CreatePaymentDto) {
    const garageAccountId = this.garageId(user);
    const customer = await this.prisma.customer.findFirst({
      where: { id: dto.customerId, garageAccountId, deletedAt: null },
    });
    if (!customer) throw new NotFoundException("Customer not found");

    const account = await this.prisma.paymentAccount.findFirst({
      where: {
        id: dto.paymentAccountId,
        garageAccountId,
        deletedAt: null,
        isActive: true,
      },
    });
    if (!account) throw new NotFoundException("Payment account not found");

    const allocSum = dto.allocations.reduce((s, a) => s + a.amount, 0);
    if (allocSum > dto.amount + 0.009) {
      throw new BadRequestException("Allocations exceed payment amount");
    }

    const valueDate = this.parseDate(dto.valueDate);

    const result = await this.prisma.$transaction(async (tx) => {
      for (const alloc of dto.allocations) {
        const invoice = await tx.invoice.findFirst({
          where: {
            id: alloc.invoiceId,
            garageAccountId,
            customerId: dto.customerId,
            status: { in: [InvoiceStatus.SENT, InvoiceStatus.PART_PAID] },
          },
          include: { allocations: true },
        });
        if (!invoice) {
          throw new BadRequestException(`Invoice ${alloc.invoiceId} is not open for payment`);
        }
        const due =
          Number(invoice.amountGross) -
          Number(invoice.depositAmount) -
          allocatedTotal(invoice.allocations);
        if (alloc.amount > due + 0.009) {
          throw new BadRequestException(
            `Allocation exceeds balance due on invoice ${invoice.invoiceNumber}`,
          );
        }
      }

      const payment = await tx.customerPayment.create({
        data: {
          garageAccountId,
          customerId: dto.customerId,
          paymentAccountId: dto.paymentAccountId,
          amount: roundMoney(dto.amount),
          allocatedAmount: roundMoney(allocSum),
          valueDate,
          method: dto.method ?? "BANK_TRANSFER",
          reference: dto.reference?.trim() || null,
          notes: dto.notes?.trim() || null,
          createdById: user.id,
          allocations: {
            create: dto.allocations.map((a) => ({
              invoiceId: a.invoiceId,
              amount: roundMoney(a.amount),
            })),
          },
        },
        include: this.paymentInclude,
      });

      for (const alloc of dto.allocations) {
        await this.recomputeInvoiceStatusInTx(tx, alloc.invoiceId);
      }

      return payment;
    });

    await this.ledger.createPostedIncomeForPayment(user, {
      paymentAccountId: dto.paymentAccountId,
      customerId: dto.customerId,
      customerPaymentId: result.id,
      valueDate,
      amountGross: dto.amount,
      vatAmount: 0,
      reference: dto.reference?.trim() || `Payment ${result.id.slice(0, 8)}`,
    });

    await this.audit.log({
      action: "invoices.payment.create",
      userId: user.id,
      garageAccountId,
      entityType: "customer_payment",
      entityId: result.id,
      metadata: { amount: dto.amount, allocations: dto.allocations.length },
    });

    return toPaymentDto(result);
  }

  private async recomputeInvoiceStatusInTx(
    tx: Prisma.TransactionClient,
    invoiceId: string,
  ) {
    const invoice = await tx.invoice.findUniqueOrThrow({
      where: { id: invoiceId },
      include: { allocations: true },
    });
    if (invoice.status === InvoiceStatus.CANCELLED || invoice.status === InvoiceStatus.DRAFT) {
      return;
    }
    const paid = allocatedTotal(invoice.allocations);
    const gross = Number(invoice.amountGross);
    const deposit = Number(invoice.depositAmount);
    const amountDue = Math.max(0, gross - deposit);
    let status: InvoiceStatus = InvoiceStatus.SENT;
    if (paid > 0.009 && paid < amountDue - 0.009) status = InvoiceStatus.PART_PAID;
    else if (paid >= amountDue - 0.009) status = InvoiceStatus.PAID;
    await tx.invoice.update({ where: { id: invoiceId }, data: { status } });
  }

  async undoAllocation(user: RequestUser, allocationId: string) {
    if (user.role !== UserRole.OWNER && user.role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException("Only the garage owner can undo payment allocations");
    }

    const garageAccountId = this.garageId(user);
    const allocation = await this.prisma.paymentAllocation.findFirst({
      where: {
        id: allocationId,
        payment: { garageAccountId },
        deletedAt: null,
      },
      include: { payment: true, invoice: true },
    });
    if (!allocation) throw new NotFoundException("Allocation not found");

    await this.prisma.$transaction(async (tx) => {
      await tx.paymentAllocation.update({
        where: { id: allocationId },
        data: { deletedAt: new Date(), deletedById: user.id },
      });

      const payment = allocation.payment;
      const newAllocated =
        Number(payment.allocatedAmount) - Number(allocation.amount);
      await tx.customerPayment.update({
        where: { id: payment.id },
        data: { allocatedAmount: roundMoney(Math.max(0, newAllocated)) },
      });

      await this.recomputeInvoiceStatusInTx(tx, allocation.invoiceId);
    });

    await this.audit.log({
      action: "invoices.allocation.undo",
      userId: user.id,
      garageAccountId,
      entityType: "payment_allocation",
      entityId: allocationId,
      metadata: {
        invoiceId: allocation.invoiceId,
        amount: allocation.amount.toString(),
      },
    });

    return { ok: true };
  }

  async listPayments(user: RequestUser, customerId?: string) {
    const garageAccountId = this.garageId(user);
    const rows = await this.prisma.customerPayment.findMany({
      where: {
        garageAccountId,
        ...(customerId ? { customerId } : {}),
      },
      include: this.paymentInclude,
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return rows.map(toPaymentDto);
  }

  async renderPdf(user: RequestUser, id: string): Promise<StreamableFile> {
    const garageAccountId = this.garageId(user);
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, garageAccountId },
      include: {
        customer: true,
        lines: { orderBy: { sortOrder: "asc" } },
        garageAccount: true,
        allocations: true,
      },
    });
    if (!invoice) throw new NotFoundException("Invoice not found");

    const buffer = await this.pdf.build(invoice);
    return new StreamableFile(buffer, {
      type: "application/pdf",
      disposition: `attachment; filename="${invoice.invoiceNumber}.pdf"`,
    });
  }
}
