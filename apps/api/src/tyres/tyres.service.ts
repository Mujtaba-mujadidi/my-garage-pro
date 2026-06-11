import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from "@nestjs/common";
import {
  generateTyreCodeFromSize,
  isRepairJobApprovedForWork,
  previewTyreCode,
  sanitizeTyreCode,
  type RepairJobDto,
} from "@mygaragepro/shared";
import {
  InvoiceStatus,
  JobTyreUsageStatus,
  PaymentMethod,
  Prisma,
  RepairJobStatus,
  TyreMovementType,
  TyreStatus,
} from "@prisma/client";
import { AuditService } from "../audit/audit.service";
import type { RequestUser } from "../auth/auth.types";
import {
  calcLine,
  roundMoney,
  sumLines,
} from "../invoices/invoice-calculations";
import { toInvoiceDto } from "../invoices/invoices.mapper";
import { LedgerService } from "../ledger/ledger.service";
import { JobPartsInvoiceSync } from "../parts/job-parts-invoice-sync";
import { PrismaService } from "../prisma/prisma.service";
import { RepairJobsService } from "../repair-jobs/repair-jobs.service";
import {
  buildStockTyreLineInputs,
  lineCreateData,
} from "../repair-jobs/repair-job-invoice-totals";
import { ConsumeTyreDto } from "./dto/consume-tyre.dto";
import { CreateTyreDto } from "./dto/create-tyre.dto";
import { ReceiveTyreStockDto } from "./dto/receive-stock.dto";
import { SellTyreDto } from "./dto/sell-tyre.dto";
import { UpdateTyreDto } from "./dto/update-tyre.dto";
import { toJobTyreUsageDto } from "./job-tyres.mapper";
import { toTyreDto } from "./tyres.mapper";

@Injectable()
export class TyresService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Inject(forwardRef(() => RepairJobsService))
    private readonly repairJobs: RepairJobsService,
    private readonly invoiceSync: JobPartsInvoiceSync,
    private readonly ledger: LedgerService,
  ) {}

  private garageId(user: RequestUser): string {
    if (!user.garageAccountId) throw new ForbiddenException("No garage context");
    if (!user.enabledModules.includes("tyres")) {
      throw new ForbiddenException("Tyres module is not enabled");
    }
    return user.garageAccountId;
  }

  private tyreInclude = {
    supplier: { select: { name: true } },
  } as const;

  private async resolveUniqueTyreCode(
    garageAccountId: string,
    size: string,
    brand?: string | null,
    excludeId?: string,
  ): Promise<string> {
    const candidates = [
      generateTyreCodeFromSize(size),
      previewTyreCode(size, brand),
    ].filter((code, index, arr) => code && arr.indexOf(code) === index);

    for (const code of candidates) {
      const clash = await this.prisma.tyre.findFirst({
        where: {
          garageAccountId,
          skuCode: code,
          deletedAt: null,
          ...(excludeId ? { id: { not: excludeId } } : {}),
        },
        select: { id: true },
      });
      if (!clash) return code;
    }

    const base = previewTyreCode(size, brand) || generateTyreCodeFromSize(size);
    for (let n = 2; n < 1000; n++) {
      const code = `${base}${n}`;
      const clash = await this.prisma.tyre.findFirst({
        where: {
          garageAccountId,
          skuCode: code,
          deletedAt: null,
          ...(excludeId ? { id: { not: excludeId } } : {}),
        },
        select: { id: true },
      });
      if (!clash) return code;
    }

    throw new BadRequestException("Could not generate a unique tyre code");
  }

  async list(user: RequestUser, q?: string, lowStockOnly = false, size?: string) {
    const garageAccountId = this.garageId(user);
    const search = q?.trim();
    const sizeFilter = size?.trim();

    const where: Prisma.TyreWhereInput = {
      garageAccountId,
      deletedAt: null,
      status: TyreStatus.ACTIVE,
    };

    if (search) {
      where.OR = [
        { skuCode: { contains: search, mode: "insensitive" } },
        { brand: { contains: search, mode: "insensitive" } },
        { model: { contains: search, mode: "insensitive" } },
        { size: { contains: search, mode: "insensitive" } },
      ];
    }
    if (sizeFilter) {
      where.size = { contains: sizeFilter, mode: "insensitive" };
    }

    const rows = await this.prisma.tyre.findMany({
      where,
      include: this.tyreInclude,
      orderBy: [{ brand: "asc" }, { size: "asc" }],
      take: 500,
    });

    let dtos = rows.map(toTyreDto);
    if (lowStockOnly) dtos = dtos.filter((t) => t.isLowStock);
    return dtos;
  }

  async getOne(user: RequestUser, id: string) {
    const garageAccountId = this.garageId(user);
    const row = await this.prisma.tyre.findFirst({
      where: { id, garageAccountId, deletedAt: null },
      include: this.tyreInclude,
    });
    if (!row) throw new NotFoundException("Tyre not found");
    return toTyreDto(row);
  }

  async create(user: RequestUser, dto: CreateTyreDto) {
    const garageAccountId = this.garageId(user);
    const size = dto.size.trim();
    if (!size) throw new BadRequestException("Tyre size is required");

    const brand = dto.brand?.trim() || null;
    const skuCode = dto.skuCode?.trim()
      ? sanitizeTyreCode(dto.skuCode)
      : await this.resolveUniqueTyreCode(garageAccountId, size, brand);
    if (!skuCode) throw new BadRequestException("Tyre code could not be generated from size");

    if (dto.supplierId) {
      const supplier = await this.prisma.supplier.findFirst({
        where: { id: dto.supplierId, garageAccountId, deletedAt: null },
      });
      if (!supplier) throw new BadRequestException("Supplier not found");
    }

    const row = await this.prisma.tyre.create({
      data: {
        garageAccountId,
        skuCode,
        brand,
        model: dto.model?.trim() || null,
        size,
        loadIndex: dto.loadIndex?.trim() || null,
        speedRating: dto.speedRating?.trim().toUpperCase() || null,
        condition: dto.condition,
        quantityOnHand: roundMoney(dto.quantityOnHand ?? 0),
        minQuantity: roundMoney(dto.minQuantity ?? 0),
        costPriceNet: roundMoney(dto.costPriceNet ?? 0),
        sellPriceNet: roundMoney(dto.sellPriceNet ?? 0),
        tradeSellPriceNet: roundMoney(dto.tradeSellPriceNet ?? 0),
        fittingChargeNet: roundMoney(dto.fittingChargeNet ?? 0),
        supplierId: dto.supplierId ?? null,
        location: dto.location?.trim() || null,
        notes: dto.notes?.trim() || null,
      },
      include: this.tyreInclude,
    });

    await this.audit.log({
      action: "tyres.create",
      userId: user.id,
      garageAccountId,
      entityType: "tyre",
      entityId: row.id,
      metadata: { skuCode: row.skuCode },
    });

    return toTyreDto(row);
  }

  async update(user: RequestUser, id: string, dto: UpdateTyreDto) {
    const garageAccountId = this.garageId(user);
    const existing = await this.prisma.tyre.findFirst({
      where: { id, garageAccountId, deletedAt: null },
    });
    if (!existing) throw new NotFoundException("Tyre not found");

    if (dto.supplierId) {
      const supplier = await this.prisma.supplier.findFirst({
        where: { id: dto.supplierId, garageAccountId, deletedAt: null },
      });
      if (!supplier) throw new BadRequestException("Supplier not found");
    }

    const row = await this.prisma.tyre.update({
      where: { id },
      data: {
        skuCode: dto.skuCode !== undefined ? sanitizeTyreCode(dto.skuCode) || undefined : undefined,
        brand: dto.brand !== undefined ? dto.brand?.trim() || null : undefined,
        model: dto.model !== undefined ? dto.model?.trim() || null : undefined,
        size: dto.size?.trim(),
        loadIndex: dto.loadIndex !== undefined ? dto.loadIndex?.trim() || null : undefined,
        speedRating:
          dto.speedRating !== undefined ? dto.speedRating?.trim().toUpperCase() || null : undefined,
        condition: dto.condition,
        minQuantity: dto.minQuantity !== undefined ? roundMoney(dto.minQuantity) : undefined,
        costPriceNet: dto.costPriceNet !== undefined ? roundMoney(dto.costPriceNet) : undefined,
        sellPriceNet: dto.sellPriceNet !== undefined ? roundMoney(dto.sellPriceNet) : undefined,
        tradeSellPriceNet:
          dto.tradeSellPriceNet !== undefined ? roundMoney(dto.tradeSellPriceNet) : undefined,
        fittingChargeNet:
          dto.fittingChargeNet !== undefined ? roundMoney(dto.fittingChargeNet) : undefined,
        supplierId: dto.supplierId !== undefined ? dto.supplierId || null : undefined,
        location: dto.location !== undefined ? dto.location?.trim() || null : undefined,
        notes: dto.notes !== undefined ? dto.notes?.trim() || null : undefined,
      },
      include: this.tyreInclude,
    });

    await this.audit.log({
      action: "tyres.update",
      userId: user.id,
      garageAccountId,
      entityType: "tyre",
      entityId: row.id,
      metadata: { skuCode: row.skuCode },
    });

    return toTyreDto(row);
  }

  async deactivate(user: RequestUser, id: string) {
    const garageAccountId = this.garageId(user);
    const existing = await this.prisma.tyre.findFirst({
      where: { id, garageAccountId, deletedAt: null },
    });
    if (!existing) throw new NotFoundException("Tyre not found");

    const row = await this.prisma.tyre.update({
      where: { id },
      data: { status: TyreStatus.INACTIVE },
      include: this.tyreInclude,
    });

    return toTyreDto(row);
  }

  async activate(user: RequestUser, id: string) {
    const garageAccountId = this.garageId(user);
    const existing = await this.prisma.tyre.findFirst({
      where: { id, garageAccountId, deletedAt: null },
    });
    if (!existing) throw new NotFoundException("Tyre not found");

    const row = await this.prisma.tyre.update({
      where: { id },
      data: { status: TyreStatus.ACTIVE },
      include: this.tyreInclude,
    });

    return toTyreDto(row);
  }

  async receiveStock(user: RequestUser, id: string, dto: ReceiveTyreStockDto) {
    const garageAccountId = this.garageId(user);
    const tyre = await this.prisma.tyre.findFirst({
      where: { id, garageAccountId, deletedAt: null, status: TyreStatus.ACTIVE },
    });
    if (!tyre) throw new NotFoundException("Tyre not found");

    const qty = roundMoney(dto.quantity);
    const before = tyre.quantityOnHand;
    const after = before.add(qty);

    await this.prisma.$transaction(async (tx) => {
      await tx.tyre.update({ where: { id }, data: { quantityOnHand: after } });
      await tx.tyreMovement.create({
        data: {
          garageAccountId,
          tyreId: id,
          type: TyreMovementType.RECEIPT,
          quantity: qty,
          quantityBefore: before,
          quantityAfter: after,
          notes: dto.notes?.trim() || null,
          createdById: user.id,
        },
      });
    });

    return this.getOne(user, id);
  }

  async listJobUsages(user: RequestUser, repairJobId: string) {
    const garageAccountId = this.garageId(user);
    const job = await this.prisma.repairJob.findFirst({
      where: { id: repairJobId, garageAccountId },
    });
    if (!job) throw new NotFoundException("Repair job not found");

    const rows = await this.prisma.jobTyreUsage.findMany({
      where: { repairJobId, garageAccountId },
      include: {
        tyre: { select: { skuCode: true, brand: true, model: true, size: true, loadIndex: true, speedRating: true } },
        repairTask: { select: { title: true } },
      },
      orderBy: { consumedAt: "desc" },
    });

    return rows.map(toJobTyreUsageDto);
  }

  private fittingTotal(tyre: { fittingChargeNet: Prisma.Decimal }, qty: Prisma.Decimal, override?: number) {
    if (override !== undefined) return roundMoney(override);
    return roundMoney(Number(tyre.fittingChargeNet) * Number(qty));
  }

  private async postTyreCogs(
    user: RequestUser,
    params: {
      costTotalNet: number;
      reference: string;
      valueDate: Date;
      repairJobId?: string;
    },
  ) {
    if (!user.enabledModules.includes("ledger")) return;
    if (params.costTotalNet <= 0) return;
    await this.ledger.createPostedTyreCogs(user, params);
  }

  private resolveUnitSellPrice(
    tyre: { sellPriceNet: Prisma.Decimal; tradeSellPriceNet: Prisma.Decimal },
    sellPriceNet?: number,
  ) {
    if (sellPriceNet !== undefined) return roundMoney(sellPriceNet);
    return roundMoney(Number(tyre.sellPriceNet));
  }

  private async consumeTyreOnJob(
    user: RequestUser,
    repairJobId: string,
    dto: ConsumeTyreDto,
    options?: { requireApproval?: boolean },
  ) {
    const garageAccountId = this.garageId(user);
    if (!user.enabledModules.includes("repair")) {
      throw new ForbiddenException("Repair module is not enabled");
    }

    const job = await this.prisma.repairJob.findFirst({
      where: { id: repairJobId, garageAccountId },
      include: { invoice: true },
    });
    if (!job) throw new NotFoundException("Repair job not found");
    if (options?.requireApproval !== false && !isRepairJobApprovedForWork(job.status)) {
      throw new BadRequestException("Approve the repair before fitting stock tyres on this job");
    }
    if (job.status === RepairJobStatus.COMPLETED || job.status === RepairJobStatus.CANCELLED) {
      throw new BadRequestException("Cannot use tyres on a closed job");
    }

    const tyre = await this.prisma.tyre.findFirst({
      where: { id: dto.tyreId, garageAccountId, deletedAt: null, status: TyreStatus.ACTIVE },
    });
    if (!tyre) throw new NotFoundException("Tyre not found");

    if (dto.repairTaskId) {
      const task = await this.prisma.repairTask.findFirst({
        where: { id: dto.repairTaskId, repairJobId },
      });
      if (!task) throw new BadRequestException("Task does not belong to this job");
    }

    const qty = new Prisma.Decimal(dto.quantity);
    if (tyre.quantityOnHand.lessThan(qty)) {
      throw new BadRequestException(
        `Insufficient stock — ${tyre.skuCode} has ${tyre.quantityOnHand} on hand`,
      );
    }

    const before = tyre.quantityOnHand;
    const after = before.sub(qty);
    const fittingChargeNet = roundMoney(0);
    const unitSellPriceNet = this.resolveUnitSellPrice(tyre, dto.sellPriceNet);
    const costTotalNet = Number(tyre.costPriceNet) * Number(qty);

    await this.prisma.$transaction(async (tx) => {
      const usage = await tx.jobTyreUsage.create({
        data: {
          garageAccountId,
          repairJobId,
          repairTaskId: dto.repairTaskId ?? null,
          tyreId: tyre.id,
          quantity: qty,
          costPriceNet: tyre.costPriceNet,
          sellPriceNet: unitSellPriceNet,
          fittingChargeNet,
          status: JobTyreUsageStatus.CONSUMED,
          createdById: user.id,
        },
      });

      await tx.tyre.update({ where: { id: tyre.id }, data: { quantityOnHand: after } });

      await tx.tyreMovement.create({
        data: {
          garageAccountId,
          tyreId: tyre.id,
          type: TyreMovementType.CONSUMPTION,
          quantity: qty,
          quantityBefore: before,
          quantityAfter: after,
          repairJobId,
          jobTyreUsageId: usage.id,
          createdById: user.id,
        },
      });

      if (job.invoice) {
        await this.invoiceSync.syncInvoiceLines(tx, job.id, garageAccountId, user.id);
      }
    });

    await this.postTyreCogs(user, {
      costTotalNet,
      reference: `Tyre COGS — ${tyre.skuCode} × ${qty} on ${job.jobNumber}`,
      valueDate: new Date(),
      repairJobId,
    });

    await this.audit.log({
      action: "tyres.job.consume",
      userId: user.id,
      garageAccountId,
      entityType: "repair_job",
      entityId: repairJobId,
      metadata: { tyreId: tyre.id, skuCode: tyre.skuCode, quantity: qty.toString() },
    });
  }

  async consumeOnJob(
    user: RequestUser,
    repairJobId: string,
    dto: ConsumeTyreDto,
  ): Promise<RepairJobDto> {
    await this.consumeTyreOnJob(user, repairJobId, dto);
    return this.repairJobs.getOne(user, repairJobId);
  }

  /** Consumes stock when a tyre task is created — does not require job approval. */
  async consumeForRepairTask(
    user: RequestUser,
    repairJobId: string,
    repairTaskId: string,
    dto: ConsumeTyreDto,
  ) {
    await this.consumeTyreOnJob(
      user,
      repairJobId,
      { ...dto, repairTaskId },
      { requireApproval: false },
    );
  }

  private async returnSingleUsage(
    user: RequestUser,
    garageAccountId: string,
    repairJobId: string,
    usageId: string,
  ) {
    const usage = await this.prisma.jobTyreUsage.findFirst({
      where: { id: usageId, repairJobId, garageAccountId },
      include: { tyre: true, repairJob: { include: { invoice: true } } },
    });
    if (!usage) throw new NotFoundException("Tyre usage not found");
    if (usage.status === JobTyreUsageStatus.RETURNED) return;

    const tyre = usage.tyre;
    const before = tyre.quantityOnHand;
    const after = before.add(usage.quantity);

    await this.prisma.$transaction(async (tx) => {
      await tx.jobTyreUsage.update({
        where: { id: usageId },
        data: { status: JobTyreUsageStatus.RETURNED, returnedAt: new Date() },
      });

      await tx.tyre.update({ where: { id: tyre.id }, data: { quantityOnHand: after } });

      await tx.tyreMovement.create({
        data: {
          garageAccountId,
          tyreId: tyre.id,
          type: TyreMovementType.RETURN,
          quantity: usage.quantity,
          quantityBefore: before,
          quantityAfter: after,
          repairJobId,
          jobTyreUsageId: usageId,
          createdById: user.id,
        },
      });

      if (usage.repairJob.invoice) {
        await this.invoiceSync.syncInvoiceLines(tx, repairJobId, garageAccountId, user.id);
      }
    });
  }

  async returnUsagesForTask(user: RequestUser, repairJobId: string, repairTaskId: string) {
    const garageAccountId = this.garageId(user);
    const usages = await this.prisma.jobTyreUsage.findMany({
      where: {
        repairJobId,
        repairTaskId,
        garageAccountId,
        status: JobTyreUsageStatus.CONSUMED,
      },
      select: { id: true },
    });
    for (const usage of usages) {
      await this.returnSingleUsage(user, garageAccountId, repairJobId, usage.id);
    }
    if (usages.length > 0) {
      await this.audit.log({
        action: "tyres.job.return",
        userId: user.id,
        garageAccountId,
        entityType: "repair_task",
        entityId: repairTaskId,
        metadata: { repairJobId, count: usages.length },
      });
    }
  }

  async returnFromJob(
    user: RequestUser,
    repairJobId: string,
    usageId: string,
  ): Promise<RepairJobDto> {
    const garageAccountId = this.garageId(user);
    const usage = await this.prisma.jobTyreUsage.findFirst({
      where: { id: usageId, repairJobId, garageAccountId },
    });
    if (!usage) throw new NotFoundException("Tyre usage not found");
    if (usage.status === JobTyreUsageStatus.RETURNED) {
      throw new BadRequestException("This tyre has already been returned to stock");
    }

    await this.returnSingleUsage(user, garageAccountId, repairJobId, usageId);
    return this.repairJobs.getOne(user, repairJobId);
  }

  async sellCounter(user: RequestUser, dto: SellTyreDto) {
    const garageAccountId = this.garageId(user);
    if (!user.enabledModules.includes("invoices")) {
      throw new ForbiddenException("Invoices module is not enabled for counter sales");
    }

    const customer = await this.prisma.customer.findFirst({
      where: { id: dto.customerId, garageAccountId, deletedAt: null },
      include: { accountTerms: true },
    });
    if (!customer) throw new NotFoundException("Customer not found");

    const tyre = await this.prisma.tyre.findFirst({
      where: { id: dto.tyreId, garageAccountId, deletedAt: null, status: TyreStatus.ACTIVE },
    });
    if (!tyre) throw new NotFoundException("Tyre not found");

    const qty = new Prisma.Decimal(dto.quantity);
    if (tyre.quantityOnHand.lessThan(qty)) {
      throw new BadRequestException(`Insufficient stock — only ${tyre.quantityOnHand} available`);
    }

    const garage = await this.prisma.garageAccount.findUnique({
      where: { id: garageAccountId },
      select: { vatNumber: true, invoiceNextSeq: true },
    });
    const canChargeVat = Boolean(garage?.vatNumber?.trim());
    const usageRow = {
      quantity: qty,
      sellPriceNet: tyre.sellPriceNet,
      fittingChargeNet: new Prisma.Decimal(0),
      tyre: {
        skuCode: tyre.skuCode,
        brand: tyre.brand,
        model: tyre.model,
        size: tyre.size,
        loadIndex: tyre.loadIndex,
        speedRating: tyre.speedRating,
      },
    };

    const lineInputs = buildStockTyreLineInputs(
      { vatEnabled: true, vatRatePercent: new Prisma.Decimal(20) },
      [usageRow],
      canChargeVat,
    );
    const lineCalcs = lineInputs.map((l) => calcLine(l));
    const totals = sumLines(lineCalcs);
    const costTotalNet = Number(tyre.costPriceNet) * Number(qty);

    const before = tyre.quantityOnHand;
    const after = before.sub(qty);
    const issueDate = new Date();
    const terms = customer.accountTerms?.paymentTermsDays ?? 30;
    const dueDate = new Date(issueDate.getTime() + terms * 24 * 60 * 60 * 1000);

    const invoiceNumber = await this.nextInvoiceNumber(garageAccountId);
    const valueDate = dto.valueDate ? new Date(dto.valueDate) : issueDate;

    const result = await this.prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.create({
        data: {
          garageAccountId,
          customerId: dto.customerId,
          invoiceNumber,
          status: InvoiceStatus.SENT,
          issueDate,
          dueDate,
          amountNet: totals.amountNet,
          vatAmount: totals.vatAmount,
          amountGross: totals.amountGross,
          vehicleRegistration: dto.vehicleRegistration?.trim().toUpperCase() || null,
          notes: `Tyre sale — ${tyre.skuCode}`,
          createdById: user.id,
          sentAt: new Date(),
          lines: { create: lineCreateData(lineCalcs) },
        },
        include: {
          customer: true,
          lines: { orderBy: { sortOrder: "asc" } },
          allocations: true,
        },
      });

      await tx.tyre.update({ where: { id: tyre.id }, data: { quantityOnHand: after } });

      await tx.tyreMovement.create({
        data: {
          garageAccountId,
          tyreId: tyre.id,
          type: TyreMovementType.SALE,
          quantity: qty,
          quantityBefore: before,
          quantityAfter: after,
          invoiceId: invoice.id,
          createdById: user.id,
        },
      });

      let payment = null;
      if (dto.paymentAccountId) {
        const amount = Number(totals.amountGross);
        payment = await tx.customerPayment.create({
          data: {
            garageAccountId,
            customerId: dto.customerId,
            paymentAccountId: dto.paymentAccountId,
            amount: roundMoney(amount),
            allocatedAmount: roundMoney(amount),
            valueDate,
            method: dto.method ?? PaymentMethod.BANK_TRANSFER,
            reference: `Tyre sale ${invoice.invoiceNumber}`,
            createdById: user.id,
            allocations: {
              create: [{ invoiceId: invoice.id, amount: roundMoney(amount) }],
            },
          },
        });
        await tx.invoice.update({
          where: { id: invoice.id },
          data: { status: InvoiceStatus.PAID },
        });
      }

      return { invoice, payment };
    });

    await this.postTyreCogs(user, {
      costTotalNet,
      reference: `Tyre COGS — counter sale ${tyre.skuCode} × ${qty}`,
      valueDate,
    });

    if (result.payment && dto.paymentAccountId) {
      await this.ledger.createPostedIncomeForPayment(user, {
        paymentAccountId: dto.paymentAccountId,
        customerId: dto.customerId,
        customerPaymentId: result.payment.id,
        valueDate,
        amountGross: Number(result.payment.amount),
        vatAmount: Number(totals.vatAmount),
        reference: `Tyre sale ${result.invoice.invoiceNumber}`,
      });
    }

    await this.audit.log({
      action: "tyres.sale",
      userId: user.id,
      garageAccountId,
      entityType: "tyre",
      entityId: tyre.id,
      metadata: { invoiceId: result.invoice.id, quantity: qty.toString() },
    });

    return {
      invoice: toInvoiceDto(result.invoice),
      tyre: await this.getOne(user, tyre.id),
    };
  }

  private async nextInvoiceNumber(garageAccountId: string): Promise<string> {
    const garage = await this.prisma.garageAccount.update({
      where: { id: garageAccountId },
      data: { invoiceNextSeq: { increment: 1 } },
      select: { invoiceNextSeq: true },
    });
    const year = new Date().getFullYear();
    return `INV-${year}-${String(garage.invoiceNextSeq).padStart(5, "0")}`;
  }
}
