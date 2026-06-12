import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from "@nestjs/common";
import {
  isBodyworkJobApprovedForWork,
  isRepairJobApprovedForWork,
  type BodyworkJobDto,
  type RepairJobDto,
} from "@mygaragepro/shared";
import {
  InvoiceLineType,
  InvoiceStatus,
  JobPartSource,
  JobPartUsageStatus,
  LedgerSourceModule,
  SupplierRefundType,
  PartFitmentType,
  PartMovementType,
  PartStatus,
  PaymentMethod,
  Prisma,
  RepairJobStatus,
} from "@prisma/client";
import { AuditService } from "../audit/audit.service";
import type { RequestUser } from "../auth/auth.types";
import { BodyworkJobsService } from "../bodywork-jobs/bodywork-jobs.service";
import { BodyworkJobPartsInvoiceSync } from "../bodywork-jobs/bodywork-job-parts-invoice-sync";
import {
  normalizeStockPurchase,
  type StockPurchaseInput,
} from "../common/dto/stock-purchase-fields.dto";
import {
  assertStockPurchaseForLedger,
  unitCostNetFromPurchase,
} from "../common/stock-purchase.util";
import {
  calcLine,
  roundMoney,
  sumLines,
} from "../invoices/invoice-calculations";
import { toInvoiceDto } from "../invoices/invoices.mapper";
import { LedgerService } from "../ledger/ledger.service";
import { PrismaService } from "../prisma/prisma.service";
import { lineCreateData } from "../repair-jobs/repair-job-invoice-totals";
import { RepairJobsService } from "../repair-jobs/repair-jobs.service";
import { ConsumePartDto } from "./dto/consume-part.dto";
import { CreatePartDto } from "./dto/create-part.dto";
import { OrderPartDto } from "./dto/order-part.dto";
import { ReceiveAndConsumePartDto } from "./dto/receive-and-consume-part.dto";
import { ReceiveOrderedPartDto } from "./dto/receive-ordered-part.dto";
import { ReceiveStockDto } from "./dto/receive-stock.dto";
import { ReturnJobPartDto } from "./dto/return-job-part.dto";
import { SellPartDto } from "./dto/sell-part.dto";
import { UpdatePartDto } from "./dto/update-part.dto";
import { toJobPartUsageDto } from "./job-parts.mapper";
import {
  assertPartFitsJobVehicle,
  filterPartsForVehicle,
  validateAndNormalizeFitments,
} from "./part-fitment.util";
import { toPartDto } from "./parts.mapper";
import { JobPartsInvoiceSync } from "./job-parts-invoice-sync";
import { SupplierCreditService } from "../suppliers/supplier-credit.service";
import type { PartVehicleContext } from "@mygaragepro/shared";

@Injectable()
export class PartsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Inject(forwardRef(() => RepairJobsService))
    private readonly repairJobs: RepairJobsService,
    @Inject(forwardRef(() => BodyworkJobsService))
    private readonly bodyworkJobs: BodyworkJobsService,
    private readonly invoiceSync: JobPartsInvoiceSync,
    private readonly bodyworkInvoiceSync: BodyworkJobPartsInvoiceSync,
    private readonly ledger: LedgerService,
    private readonly supplierCredit: SupplierCreditService,
  ) {}

  private ledgerEnabled(user: RequestUser) {
    return user.enabledModules.includes("ledger");
  }

  private splitPurchasePayment(purchase: StockPurchaseInput, creditApplied: number) {
    const gross = purchase.amountGross;
    const credit = Math.min(Math.max(creditApplied, 0), gross);
    const cashGross = Number(roundMoney(gross - credit));
    const ratio = gross > 0 ? cashGross / gross : 0;
    const cashVat = Number(roundMoney(purchase.vatAmount * ratio));
    return { credit, cashGross, cashVat };
  }

  private async postPartStockPurchase(
    user: RequestUser,
    purchase: StockPurchaseInput,
    partNumber: string,
    movementId: string,
    opts?: {
      repairJobId?: string;
      bodyworkJobId?: string;
      jobPartUsageId?: string;
      deferRepairJobLedger?: boolean;
      tx?: Prisma.TransactionClient;
    },
  ) {
    assertStockPurchaseForLedger(purchase, this.ledgerEnabled(user));
    if (!this.ledgerEnabled(user) || purchase.amountGross <= 0) return;

    let creditApplied = 0;
    if (purchase.supplierId && (purchase.creditAmountApplied ?? 0) > 0) {
      creditApplied = Math.min(purchase.creditAmountApplied!, purchase.amountGross);
      await this.supplierCredit.applyCredit(
        user,
        {
          supplierId: purchase.supplierId,
          amountGross: creditApplied,
          jobPartUsageId: opts?.jobPartUsageId,
          notes: purchase.reference ?? `Credit applied — ${partNumber}`,
        },
        opts?.tx,
      );
    }

    const { cashGross, cashVat } = this.splitPurchasePayment(purchase, creditApplied);
    if (cashGross <= 0) return;

    if (opts?.repairJobId && opts.deferRepairJobLedger && opts.jobPartUsageId) {
      await this.ledger.createPendingJobPartExpense(
        user,
        {
          amountGross: cashGross,
          vatAmount: cashVat,
          paymentAccountId: purchase.paymentAccountId!,
          paymentMethod: purchase.paymentMethod,
          reference: purchase.reference ?? `Job parts — ${partNumber}`,
          valueDate: purchase.valueDate ?? new Date(),
          supplierId: purchase.supplierId,
          repairJobId: opts.repairJobId,
          partMovementId: movementId,
          jobPartUsageId: opts.jobPartUsageId,
        },
        opts?.tx,
      );
      return;
    }

    await this.ledger.createPostedStockPurchase(
      user,
      {
        sourceModule: LedgerSourceModule.PARTS,
        category: "Parts stock purchase",
        amountGross: cashGross,
        vatAmount: cashVat,
        paymentAccountId: purchase.paymentAccountId!,
        paymentMethod: purchase.paymentMethod,
        reference: purchase.reference ?? `Parts purchase — ${partNumber}`,
        valueDate: purchase.valueDate ?? new Date(),
        supplierId: purchase.supplierId,
        partMovementId: movementId,
        repairJobId: opts?.repairJobId,
        bodyworkJobId: opts?.bodyworkJobId,
      },
      opts?.tx,
    );
  }

  async postPendingJobExpensesOnRepairComplete(user: RequestUser, repairJobId: string) {
    if (!this.ledgerEnabled(user)) return;
    await this.ledger.postPendingExpensesForRepairJob(user, repairJobId);
  }

  private resolveUnitSellPrice(
    part: { sellPriceNet: Prisma.Decimal },
    sellPriceNet?: number,
  ) {
    if (sellPriceNet !== undefined) return roundMoney(sellPriceNet);
    return roundMoney(Number(part.sellPriceNet));
  }

  private garageId(user: RequestUser): string {
    if (!user.garageAccountId) throw new ForbiddenException("No garage context");
    if (!user.enabledModules.includes("parts")) {
      throw new ForbiddenException("Parts module is not enabled");
    }
    return user.garageAccountId;
  }

  private partInclude = {
    supplier: { select: { name: true } },
    fitments: { orderBy: { sortOrder: "asc" as const } },
  } as const;

  /** Replace all fitment rows — simpler than diffing and matches form submit behaviour. */
  private async replaceFitments(
    tx: Prisma.TransactionClient,
    partId: string,
    fitmentType: PartFitmentType,
    rows: ReturnType<typeof validateAndNormalizeFitments>,
  ) {
    await tx.partFitment.deleteMany({ where: { partId } });
    if (fitmentType === PartFitmentType.VEHICLE_SPECIFIC && rows.length > 0) {
      await tx.partFitment.createMany({
        data: rows.map((row, index) => ({
          partId,
          make: row.make,
          model: row.model,
          yearFrom: row.yearFrom,
          yearTo: row.yearTo,
          notes: row.notes,
          sortOrder: index,
        })),
      });
    }
  }

  async list(
    user: RequestUser,
    q?: string,
    lowStockOnly = false,
    vehicle?: PartVehicleContext,
  ) {
    const garageAccountId = this.garageId(user);
    const search = q?.trim();

    const where: Prisma.PartWhereInput = {
      garageAccountId,
      deletedAt: null,
      status: PartStatus.ACTIVE,
    };

    if (search) {
      where.OR = [
        { partNumber: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
        { category: { contains: search, mode: "insensitive" } },
      ];
    }

    const rows = await this.prisma.part.findMany({
      where,
      include: this.partInclude,
      orderBy: [{ partNumber: "asc" }],
      take: 500,
    });

    let dtos = rows.map(toPartDto);
    // When a repair job passes make/model, narrow to universal + matching fitments.
    if (vehicle?.make?.trim() || vehicle?.model?.trim()) {
      dtos = filterPartsForVehicle(dtos, vehicle);
    }
    if (lowStockOnly) dtos = dtos.filter((p) => p.isLowStock);
    return dtos;
  }

  async getOne(user: RequestUser, id: string) {
    const garageAccountId = this.garageId(user);
    const row = await this.prisma.part.findFirst({
      where: { id, garageAccountId, deletedAt: null },
      include: this.partInclude,
    });
    if (!row) throw new NotFoundException("Part not found");
    return toPartDto(row);
  }

  async create(user: RequestUser, dto: CreatePartDto) {
    const garageAccountId = this.garageId(user);
    const partNumber = dto.partNumber.trim().toUpperCase();

    if (dto.supplierId) {
      const supplier = await this.prisma.supplier.findFirst({
        where: { id: dto.supplierId, garageAccountId, deletedAt: null },
      });
      if (!supplier) throw new BadRequestException("Supplier not found");
    }

    const fitmentType = dto.fitmentType ?? PartFitmentType.UNIVERSAL;
    const fitmentRows = validateAndNormalizeFitments(fitmentType, dto.fitments);

    const initialQty = roundMoney(dto.quantityOnHand ?? 0);
    const purchase = normalizeStockPurchase(dto, `Initial stock — ${partNumber}`);
    assertStockPurchaseForLedger(purchase, this.ledgerEnabled(user));
    const unitCost =
      purchase.amountGross > 0
        ? unitCostNetFromPurchase(purchase, initialQty)
        : roundMoney(dto.costPriceNet ?? 0);

    const row = await this.prisma.$transaction(async (tx) => {
      const part = await tx.part.create({
        data: {
          garageAccountId,
          partNumber,
          description: dto.description.trim(),
          category: dto.category?.trim() || null,
          fitmentType,
          quantityOnHand: initialQty,
          minQuantity: roundMoney(dto.minQuantity ?? 0),
          costPriceNet: unitCost,
          sellPriceNet: roundMoney(dto.sellPriceNet ?? 0),
          supplierId: dto.supplierId ?? purchase.supplierId ?? null,
          location: dto.location?.trim() || null,
          notes: dto.notes?.trim() || null,
        },
      });
      await this.replaceFitments(tx, part.id, fitmentType, fitmentRows);

      if (Number(initialQty) > 0) {
        const movement = await tx.partMovement.create({
          data: {
            garageAccountId,
            partId: part.id,
            type: PartMovementType.RECEIPT,
            quantity: initialQty,
            quantityBefore: new Prisma.Decimal(0),
            quantityAfter: initialQty,
            notes: dto.notes?.trim() || null,
            createdById: user.id,
          },
        });
        await this.postPartStockPurchase(user, purchase, partNumber, movement.id, { tx });
      }

      return tx.part.findFirstOrThrow({
        where: { id: part.id },
        include: this.partInclude,
      });
    });

    await this.audit.log({
      action: "parts.create",
      userId: user.id,
      garageAccountId,
      entityType: "part",
      entityId: row.id,
      metadata: { partNumber: row.partNumber },
    });

    return toPartDto(row);
  }

  async update(user: RequestUser, id: string, dto: UpdatePartDto) {
    const garageAccountId = this.garageId(user);
    const existing = await this.prisma.part.findFirst({
      where: { id, garageAccountId, deletedAt: null },
    });
    if (!existing) throw new NotFoundException("Part not found");

    if (dto.supplierId) {
      const supplier = await this.prisma.supplier.findFirst({
        where: { id: dto.supplierId, garageAccountId, deletedAt: null },
      });
      if (!supplier) throw new BadRequestException("Supplier not found");
    }

    const fitmentType =
      dto.fitmentType !== undefined ? dto.fitmentType : existing.fitmentType;
    const fitmentRows =
      dto.fitmentType !== undefined || dto.fitments !== undefined
        ? validateAndNormalizeFitments(fitmentType, dto.fitments ?? [])
        : null;

    const row = await this.prisma.$transaction(async (tx) => {
      await tx.part.update({
        where: { id },
        data: {
          partNumber: dto.partNumber?.trim().toUpperCase(),
          description: dto.description?.trim(),
          category: dto.category !== undefined ? dto.category?.trim() || null : undefined,
          fitmentType: dto.fitmentType !== undefined ? dto.fitmentType : undefined,
          minQuantity: dto.minQuantity !== undefined ? roundMoney(dto.minQuantity) : undefined,
          costPriceNet: dto.costPriceNet !== undefined ? roundMoney(dto.costPriceNet) : undefined,
          sellPriceNet: dto.sellPriceNet !== undefined ? roundMoney(dto.sellPriceNet) : undefined,
          supplierId: dto.supplierId !== undefined ? dto.supplierId || null : undefined,
          location: dto.location !== undefined ? dto.location?.trim() || null : undefined,
          notes: dto.notes !== undefined ? dto.notes?.trim() || null : undefined,
        },
      });
      if (fitmentRows !== null) {
        await this.replaceFitments(tx, id, fitmentType, fitmentRows);
      }
      return tx.part.findFirstOrThrow({
        where: { id },
        include: this.partInclude,
      });
    });

    await this.audit.log({
      action: "parts.update",
      userId: user.id,
      garageAccountId,
      entityType: "part",
      entityId: row.id,
      metadata: { partNumber: row.partNumber },
    });

    return toPartDto(row);
  }

  async deactivate(user: RequestUser, id: string) {
    const garageAccountId = this.garageId(user);
    const existing = await this.prisma.part.findFirst({
      where: { id, garageAccountId, deletedAt: null },
    });
    if (!existing) throw new NotFoundException("Part not found");

    const row = await this.prisma.part.update({
      where: { id },
      data: { status: PartStatus.INACTIVE },
      include: this.partInclude,
    });

    await this.audit.log({
      action: "parts.deactivate",
      userId: user.id,
      garageAccountId,
      entityType: "part",
      entityId: row.id,
    });

    return toPartDto(row);
  }

  async activate(user: RequestUser, id: string) {
    const garageAccountId = this.garageId(user);
    const existing = await this.prisma.part.findFirst({
      where: { id, garageAccountId, deletedAt: null },
    });
    if (!existing) throw new NotFoundException("Part not found");

    const row = await this.prisma.part.update({
      where: { id },
      data: { status: PartStatus.ACTIVE },
      include: this.partInclude,
    });

    return toPartDto(row);
  }

  async receiveStock(user: RequestUser, id: string, dto: ReceiveStockDto) {
    const garageAccountId = this.garageId(user);
    const part = await this.prisma.part.findFirst({
      where: { id, garageAccountId, deletedAt: null, status: PartStatus.ACTIVE },
    });
    if (!part) throw new NotFoundException("Part not found");

    const qty = roundMoney(dto.quantity);
    const before = part.quantityOnHand;
    const after = before.add(qty);
    const purchase = normalizeStockPurchase(dto, `Stock receipt — ${part.partNumber}`);
    assertStockPurchaseForLedger(purchase, this.ledgerEnabled(user));
    const unitCost =
      purchase.amountGross > 0 ? unitCostNetFromPurchase(purchase, qty) : part.costPriceNet;

    await this.prisma.$transaction(async (tx) => {
      await tx.part.update({
        where: { id },
        data: {
          quantityOnHand: after,
          ...(purchase.amountGross > 0 ? { costPriceNet: unitCost } : {}),
        },
      });
      const movement = await tx.partMovement.create({
        data: {
          garageAccountId,
          partId: id,
          type: PartMovementType.RECEIPT,
          quantity: qty,
          quantityBefore: before,
          quantityAfter: after,
          notes: dto.notes?.trim() || null,
          createdById: user.id,
        },
      });
      await this.postPartStockPurchase(user, purchase, part.partNumber, movement.id, { tx });
    });

    await this.audit.log({
      action: "parts.stock.receive",
      userId: user.id,
      garageAccountId,
      entityType: "part",
      entityId: id,
      metadata: { quantity: qty.toString() },
    });

    return this.getOne(user, id);
  }

  async listJobUsages(user: RequestUser, repairJobId: string) {
    const garageAccountId = this.garageId(user);
    const job = await this.prisma.repairJob.findFirst({
      where: { id: repairJobId, garageAccountId },
    });
    if (!job) throw new NotFoundException("Repair job not found");

    const rows = await this.prisma.jobPartUsage.findMany({
      where: { repairJobId, garageAccountId },
      include: {
        part: { select: { partNumber: true, description: true } },
        repairTask: { select: { title: true } },
      },
      orderBy: { consumedAt: "desc" },
    });

    return rows.map(toJobPartUsageDto);
  }

  async listBodyworkJobUsages(user: RequestUser, bodyworkJobId: string) {
    const garageAccountId = this.garageId(user);
    const job = await this.prisma.bodyworkJob.findFirst({
      where: { id: bodyworkJobId, garageAccountId },
    });
    if (!job) throw new NotFoundException("Bodywork job not found");

    const rows = await this.prisma.jobPartUsage.findMany({
      where: { bodyworkJobId, garageAccountId },
      include: {
        part: { select: { partNumber: true, description: true } },
        bodyworkTask: { select: { title: true } },
      },
      orderBy: { consumedAt: "desc" },
    });

    return rows.map(toJobPartUsageDto);
  }

  private async consumePartOnRepairJob(
    user: RequestUser,
    garageAccountId: string,
    repairJobId: string,
    dto: ConsumePartDto,
  ) {
    const job = await this.prisma.repairJob.findFirst({
      where: { id: repairJobId, garageAccountId },
      include: { invoice: true },
    });
    if (!job) throw new NotFoundException("Repair job not found");
    if (!isRepairJobApprovedForWork(job.status)) {
      throw new BadRequestException("Approve the repair before using stock parts on this job");
    }
    if (job.status === RepairJobStatus.COMPLETED || job.status === RepairJobStatus.CANCELLED) {
      throw new BadRequestException("Cannot use parts on a closed job");
    }

    const part = await this.loadActivePart(garageAccountId, dto.partId);
    assertPartFitsJobVehicle(toPartDto(part), {
      make: job.vehicleMake,
      model: job.vehicleModel,
    });

    if (dto.repairTaskId) {
      const task = await this.prisma.repairTask.findFirst({
        where: { id: dto.repairTaskId, repairJobId },
      });
      if (!task) throw new BadRequestException("Task does not belong to this job");
    }

    const qty = new Prisma.Decimal(dto.quantity);
    if (part.quantityOnHand.lessThan(qty)) {
      throw new BadRequestException(
        `Insufficient stock — ${part.partNumber} has ${part.quantityOnHand} on hand`,
      );
    }

    const before = part.quantityOnHand;
    const after = before.sub(qty);
    const unitCost = part.costPriceNet;
    const lineNet = roundMoney(Number(qty) * Number(unitCost));

    await this.prisma.$transaction(async (tx) => {
      const usage = await tx.jobPartUsage.create({
        data: {
          garageAccountId,
          repairJobId,
          repairTaskId: dto.repairTaskId ?? null,
          partId: part.id,
          quantity: qty,
          costPriceNet: unitCost,
          costVatAmount: roundMoney(0),
          costAmountGross: lineNet,
          sellPriceNet: roundMoney(0),
          source: JobPartSource.STOCK,
          status: JobPartUsageStatus.CONSUMED,
          createdById: user.id,
        },
      });

      await tx.part.update({
        where: { id: part.id },
        data: { quantityOnHand: after },
      });

      await tx.partMovement.create({
        data: {
          garageAccountId,
          partId: part.id,
          type: PartMovementType.CONSUMPTION,
          quantity: qty,
          quantityBefore: before,
          quantityAfter: after,
          repairJobId,
          jobPartUsageId: usage.id,
          createdById: user.id,
        },
      });
    });

    await this.audit.log({
      action: "parts.job.consume",
      userId: user.id,
      garageAccountId,
      entityType: "repair_job",
      entityId: repairJobId,
      metadata: {
        partId: part.id,
        partNumber: part.partNumber,
        quantity: qty.toString(),
      },
    });
  }

  private async consumePartOnBodyworkJob(
    user: RequestUser,
    garageAccountId: string,
    bodyworkJobId: string,
    dto: ConsumePartDto,
  ) {
    if (!user.enabledModules.includes("bodywork")) {
      throw new ForbiddenException("Bodywork module is not enabled");
    }

    const job = await this.prisma.bodyworkJob.findFirst({
      where: { id: bodyworkJobId, garageAccountId },
      include: { invoice: true },
    });
    if (!job) throw new NotFoundException("Bodywork job not found");
    if (!isBodyworkJobApprovedForWork(job.status)) {
      throw new BadRequestException("Approve the bodywork job before using stock parts");
    }

    const part = await this.loadActivePart(garageAccountId, dto.partId);
    assertPartFitsJobVehicle(toPartDto(part), {
      make: job.vehicleMake,
      model: job.vehicleModel,
    });

    if (dto.bodyworkTaskId) {
      const task = await this.prisma.bodyworkTask.findFirst({
        where: { id: dto.bodyworkTaskId, bodyworkJobId },
      });
      if (!task) throw new BadRequestException("Task does not belong to this job");
    }

    const qty = new Prisma.Decimal(dto.quantity);
    if (part.quantityOnHand.lessThan(qty)) {
      throw new BadRequestException(
        `Insufficient stock — ${part.partNumber} has ${part.quantityOnHand} on hand`,
      );
    }

    const before = part.quantityOnHand;
    const after = before.sub(qty);
    const unitSell = this.resolveUnitSellPrice(part, dto.sellPriceNet);

    await this.prisma.$transaction(async (tx) => {
      const usage = await tx.jobPartUsage.create({
        data: {
          garageAccountId,
          bodyworkJobId,
          bodyworkTaskId: dto.bodyworkTaskId ?? null,
          partId: part.id,
          quantity: qty,
          costPriceNet: part.costPriceNet,
          sellPriceNet: unitSell,
          status: JobPartUsageStatus.CONSUMED,
          createdById: user.id,
        },
      });

      await tx.part.update({
        where: { id: part.id },
        data: { quantityOnHand: after },
      });

      await tx.partMovement.create({
        data: {
          garageAccountId,
          partId: part.id,
          type: PartMovementType.CONSUMPTION,
          quantity: qty,
          quantityBefore: before,
          quantityAfter: after,
          bodyworkJobId,
          jobPartUsageId: usage.id,
          createdById: user.id,
        },
      });

      if (job.invoice) {
        await this.bodyworkInvoiceSync.syncInvoiceLines(tx, bodyworkJobId, garageAccountId, user.id);
      }
    });

    await this.audit.log({
      action: "parts.bodywork.consume",
      userId: user.id,
      garageAccountId,
      entityType: "bodywork_job",
      entityId: bodyworkJobId,
      metadata: {
        partId: part.id,
        partNumber: part.partNumber,
        quantity: qty.toString(),
      },
    });
  }

  private async loadActivePart(garageAccountId: string, partId: string) {
    const part = await this.prisma.part.findFirst({
      where: {
        id: partId,
        garageAccountId,
        deletedAt: null,
        status: PartStatus.ACTIVE,
      },
      include: { fitments: { orderBy: { sortOrder: "asc" } } },
    });
    if (!part) throw new NotFoundException("Part not found");
    return part;
  }

  async consumeOnJob(
    user: RequestUser,
    repairJobId: string,
    dto: ConsumePartDto,
  ): Promise<RepairJobDto> {
    const garageAccountId = this.garageId(user);
    if (!user.enabledModules.includes("repair")) {
      throw new ForbiddenException("Repair module is not enabled");
    }
    await this.consumePartOnRepairJob(user, garageAccountId, repairJobId, dto);
    return this.repairJobs.getOne(user, repairJobId);
  }

  async consumeOnBodyworkJob(
    user: RequestUser,
    bodyworkJobId: string,
    dto: ConsumePartDto,
  ): Promise<BodyworkJobDto> {
    const garageAccountId = this.garageId(user);
    await this.consumePartOnBodyworkJob(user, garageAccountId, bodyworkJobId, dto);
    return this.bodyworkJobs.getOne(user, bodyworkJobId);
  }

  async orderPartOnRepairJob(
    user: RequestUser,
    repairJobId: string,
    dto: OrderPartDto,
  ): Promise<RepairJobDto> {
    const garageAccountId = this.garageId(user);
    if (!user.enabledModules.includes("repair")) {
      throw new ForbiddenException("Repair module is not enabled");
    }

    const job = await this.prisma.repairJob.findFirst({
      where: { id: repairJobId, garageAccountId },
    });
    if (!job) throw new NotFoundException("Repair job not found");
    if (!isRepairJobApprovedForWork(job.status)) {
      throw new BadRequestException("Approve the repair before ordering parts for this job");
    }
    if (job.status === RepairJobStatus.COMPLETED || job.status === RepairJobStatus.CANCELLED) {
      throw new BadRequestException("Cannot order parts on a closed job");
    }

    if (dto.repairTaskId) {
      const task = await this.prisma.repairTask.findFirst({
        where: { id: dto.repairTaskId, repairJobId },
      });
      if (!task) throw new BadRequestException("Task does not belong to this job");
    }

    const description = dto.description.trim();
    const partNumber =
      dto.partNumber?.trim().toUpperCase().slice(0, 80) ||
      `${job.jobNumber}-ORDER-${Date.now()}`.slice(0, 80);
    const qty = new Prisma.Decimal(dto.quantity);

    const part = await this.prisma.part.create({
      data: {
        garageAccountId,
        partNumber,
        description,
        quantityOnHand: 0,
        minQuantity: 0,
        costPriceNet: 0,
        sellPriceNet: 0,
        fitmentType: PartFitmentType.UNIVERSAL,
        status: PartStatus.ACTIVE,
      },
    });

    await this.prisma.jobPartUsage.create({
      data: {
        garageAccountId,
        repairJobId,
        repairTaskId: dto.repairTaskId ?? null,
        partId: part.id,
        quantity: qty,
        costPriceNet: 0,
        sellPriceNet: 0,
        source: JobPartSource.ORDERED,
        supplierRef: dto.supplierRef?.trim() || null,
        status: JobPartUsageStatus.ORDERED,
        createdById: user.id,
      },
    });

    await this.audit.log({
      action: "parts.job.order",
      userId: user.id,
      garageAccountId,
      entityType: "repair_job",
      entityId: repairJobId,
      metadata: { partId: part.id, partNumber, quantity: qty.toString() },
    });

    return this.repairJobs.getOne(user, repairJobId);
  }

  async receiveOrderedPartOnRepairJob(
    user: RequestUser,
    repairJobId: string,
    usageId: string,
    dto: ReceiveOrderedPartDto,
  ): Promise<RepairJobDto> {
    const garageAccountId = this.garageId(user);
    if (!user.enabledModules.includes("repair")) {
      throw new ForbiddenException("Repair module is not enabled");
    }

    const usage = await this.prisma.jobPartUsage.findFirst({
      where: { id: usageId, repairJobId, garageAccountId },
      include: { part: true, repairJob: true },
    });
    if (!usage) throw new NotFoundException("Part usage not found");
    if (usage.status !== JobPartUsageStatus.ORDERED) {
      throw new BadRequestException("Only ordered parts awaiting delivery can be received");
    }
    if (
      usage.repairJob?.status === RepairJobStatus.COMPLETED ||
      usage.repairJob?.status === RepairJobStatus.CANCELLED
    ) {
      throw new BadRequestException("Cannot receive parts on a closed job");
    }

    const part = usage.part;
    const qty = usage.quantity;
    const purchase = normalizeStockPurchase(dto, `Job receive — ${part.partNumber}`);
    assertStockPurchaseForLedger(purchase, this.ledgerEnabled(user));
    const unitCost =
      purchase.amountGross > 0 ? unitCostNetFromPurchase(purchase, qty) : part.costPriceNet;
    const before = part.quantityOnHand;
    const mid = before.add(qty);

    await this.prisma.$transaction(async (tx) => {
      const receipt = await tx.partMovement.create({
        data: {
          garageAccountId,
          partId: part.id,
          type: PartMovementType.RECEIPT,
          quantity: qty,
          quantityBefore: before,
          quantityAfter: mid,
          repairJobId,
          createdById: user.id,
        },
      });

      await tx.jobPartUsage.update({
        where: { id: usageId },
        data: {
          status: JobPartUsageStatus.CONSUMED,
          costPriceNet: unitCost,
          costVatAmount: roundMoney(purchase.vatAmount),
          costAmountGross: roundMoney(purchase.amountGross),
          sellPriceNet: roundMoney(0),
          supplierId: purchase.supplierId ?? null,
          consumedAt: new Date(),
        },
      });

      await tx.partMovement.create({
        data: {
          garageAccountId,
          partId: part.id,
          type: PartMovementType.CONSUMPTION,
          quantity: qty,
          quantityBefore: mid,
          quantityAfter: before,
          repairJobId,
          jobPartUsageId: usageId,
          createdById: user.id,
        },
      });

      if (purchase.amountGross > 0) {
        await tx.part.update({
          where: { id: part.id },
          data: { costPriceNet: unitCost },
        });
      }

      await this.postPartStockPurchase(user, purchase, part.partNumber, receipt.id, {
        repairJobId,
        jobPartUsageId: usageId,
        deferRepairJobLedger: true,
        tx,
      });
    });

    await this.audit.log({
      action: "parts.job.receive_ordered",
      userId: user.id,
      garageAccountId,
      entityType: "repair_job",
      entityId: repairJobId,
      metadata: { usageId, partNumber: part.partNumber },
    });

    return this.repairJobs.getOne(user, repairJobId);
  }

  async cancelOrderedPartOnRepairJob(
    user: RequestUser,
    repairJobId: string,
    usageId: string,
  ): Promise<RepairJobDto> {
    const garageAccountId = this.garageId(user);
    const usage = await this.prisma.jobPartUsage.findFirst({
      where: { id: usageId, repairJobId, garageAccountId },
    });
    if (!usage) throw new NotFoundException("Part usage not found");
    if (usage.status !== JobPartUsageStatus.ORDERED) {
      throw new BadRequestException("Only pending orders can be cancelled");
    }

    await this.prisma.jobPartUsage.update({
      where: { id: usageId },
      data: { status: JobPartUsageStatus.CANCELLED },
    });

    await this.audit.log({
      action: "parts.job.order_cancel",
      userId: user.id,
      garageAccountId,
      entityType: "repair_job",
      entityId: repairJobId,
      metadata: { usageId },
    });

    return this.repairJobs.getOne(user, repairJobId);
  }

  async receiveAndConsumeOnRepairJob(
    _user: RequestUser,
    _repairJobId: string,
    _dto: ReceiveAndConsumePartDto,
  ): Promise<RepairJobDto> {
    throw new BadRequestException(
      "Use order part then mark received — repair jobs no longer receive and consume in one step",
    );
  }

  async receiveAndConsumeOnBodyworkJob(
    user: RequestUser,
    bodyworkJobId: string,
    dto: ReceiveAndConsumePartDto,
  ): Promise<BodyworkJobDto> {
    const garageAccountId = this.garageId(user);
    await this.receiveAndConsumePart(user, garageAccountId, {
      ...dto,
      bodyworkJobId,
      repairJobId: undefined,
    });
    return this.bodyworkJobs.getOne(user, bodyworkJobId);
  }

  private async receiveAndConsumePart(
    user: RequestUser,
    garageAccountId: string,
    dto: ReceiveAndConsumePartDto & {
      repairJobId?: string;
      bodyworkJobId?: string;
    },
  ) {
    if (!dto.repairJobId && !dto.bodyworkJobId) {
      throw new BadRequestException("Job context is required");
    }

    const part = await this.loadActivePart(garageAccountId, dto.partId);
    const qty = new Prisma.Decimal(dto.quantity);
    const purchase = normalizeStockPurchase(dto, `Job order — ${part.partNumber}`);
    assertStockPurchaseForLedger(purchase, this.ledgerEnabled(user));
    const unitCost =
      purchase.amountGross > 0 ? unitCostNetFromPurchase(purchase, qty) : part.costPriceNet;
    const unitSell = this.resolveUnitSellPrice(part, dto.sellPriceNet);

    let repairJob: { jobNumber: string; invoice: { id: string } | null } | null = null;
    let bodyworkJob: { jobNumber: string; invoice: { id: string } | null } | null = null;

    if (dto.repairJobId) {
      const job = await this.prisma.repairJob.findFirst({
        where: { id: dto.repairJobId, garageAccountId },
        include: { invoice: true },
      });
      if (!job) throw new NotFoundException("Repair job not found");
      if (!isRepairJobApprovedForWork(job.status)) {
        throw new BadRequestException("Approve the repair before ordering parts for this job");
      }
      assertPartFitsJobVehicle(toPartDto(part), {
        make: job.vehicleMake,
        model: job.vehicleModel,
      });
      repairJob = job;
    } else if (dto.bodyworkJobId) {
      const job = await this.prisma.bodyworkJob.findFirst({
        where: { id: dto.bodyworkJobId, garageAccountId },
        include: { invoice: true },
      });
      if (!job) throw new NotFoundException("Bodywork job not found");
      if (!isBodyworkJobApprovedForWork(job.status)) {
        throw new BadRequestException("Approve the bodywork job before ordering parts");
      }
      assertPartFitsJobVehicle(toPartDto(part), {
        make: job.vehicleMake,
        model: job.vehicleModel,
      });
      bodyworkJob = job;
    }

    const before = part.quantityOnHand;
    const mid = before.add(qty);

    await this.prisma.$transaction(async (tx) => {
      await tx.part.update({
        where: { id: part.id },
        data: {
          quantityOnHand: before,
          ...(purchase.amountGross > 0 ? { costPriceNet: unitCost } : {}),
        },
      });

      const receipt = await tx.partMovement.create({
        data: {
          garageAccountId,
          partId: part.id,
          type: PartMovementType.RECEIPT,
          quantity: qty,
          quantityBefore: before,
          quantityAfter: mid,
          repairJobId: dto.repairJobId ?? null,
          bodyworkJobId: dto.bodyworkJobId ?? null,
          createdById: user.id,
        },
      });

      const usage = await tx.jobPartUsage.create({
        data: {
          garageAccountId,
          repairJobId: dto.repairJobId ?? null,
          bodyworkJobId: dto.bodyworkJobId ?? null,
          repairTaskId: dto.repairTaskId ?? null,
          bodyworkTaskId: dto.bodyworkTaskId ?? null,
          partId: part.id,
          quantity: qty,
          costPriceNet: unitCost,
          sellPriceNet: unitSell,
          status: JobPartUsageStatus.CONSUMED,
          createdById: user.id,
        },
      });

      await tx.partMovement.create({
        data: {
          garageAccountId,
          partId: part.id,
          type: PartMovementType.CONSUMPTION,
          quantity: qty,
          quantityBefore: mid,
          quantityAfter: before,
          repairJobId: dto.repairJobId ?? null,
          bodyworkJobId: dto.bodyworkJobId ?? null,
          jobPartUsageId: usage.id,
          createdById: user.id,
        },
      });

      if (repairJob?.invoice) {
        await this.invoiceSync.syncInvoiceLines(tx, dto.repairJobId!, garageAccountId, user.id);
      }
      if (bodyworkJob?.invoice) {
        await this.bodyworkInvoiceSync.syncInvoiceLines(
          tx,
          dto.bodyworkJobId!,
          garageAccountId,
          user.id,
        );
      }

      await this.postPartStockPurchase(user, purchase, part.partNumber, receipt.id, {
        repairJobId: dto.repairJobId,
        bodyworkJobId: dto.bodyworkJobId,
        tx,
      });
    });

    await this.audit.log({
      action: "parts.job.receive_consume",
      userId: user.id,
      garageAccountId,
      entityType: dto.repairJobId ? "repair_job" : "bodywork_job",
      entityId: dto.repairJobId ?? dto.bodyworkJobId!,
      metadata: { partId: part.id, partNumber: part.partNumber, quantity: qty.toString() },
    });
  }

  async sellCounter(user: RequestUser, dto: SellPartDto) {
    const garageAccountId = this.garageId(user);
    if (!user.enabledModules.includes("invoices")) {
      throw new ForbiddenException("Invoices module is not enabled for counter sales");
    }

    const customer = await this.prisma.customer.findFirst({
      where: { id: dto.customerId, garageAccountId, deletedAt: null },
      include: { accountTerms: true },
    });
    if (!customer) throw new NotFoundException("Customer not found");

    const part = await this.loadActivePart(garageAccountId, dto.partId);
    const qty = new Prisma.Decimal(dto.quantity);
    if (part.quantityOnHand.lessThan(qty)) {
      throw new BadRequestException(`Insufficient stock — only ${part.quantityOnHand} available`);
    }

    const garage = await this.prisma.garageAccount.findUnique({
      where: { id: garageAccountId },
      select: { vatNumber: true, invoiceNextSeq: true },
    });
    const canChargeVat = Boolean(garage?.vatNumber?.trim());
    const unitSell = this.resolveUnitSellPrice(part, dto.sellPriceNet);
    const lineCalc = calcLine({
      lineType: InvoiceLineType.PARTS,
      description: `${part.partNumber} — ${part.description}`,
      quantity: Number(qty),
      unitPriceNet: Number(unitSell),
      vatRatePercent: canChargeVat ? 20 : 0,
    });
    const totals = sumLines([lineCalc]);

    const before = part.quantityOnHand;
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
          notes: `Part sale — ${part.partNumber}`,
          createdById: user.id,
          sentAt: new Date(),
          lines: { create: lineCreateData([lineCalc]) },
        },
        include: {
          customer: true,
          lines: { orderBy: { sortOrder: "asc" } },
          allocations: true,
        },
      });

      await tx.part.update({ where: { id: part.id }, data: { quantityOnHand: after } });

      await tx.partMovement.create({
        data: {
          garageAccountId,
          partId: part.id,
          type: PartMovementType.SALE,
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
            reference: `Part sale ${invoice.invoiceNumber}`,
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

    if (result.payment && dto.paymentAccountId) {
      await this.ledger.createPostedIncomeForPayment(user, {
        paymentAccountId: dto.paymentAccountId,
        customerId: dto.customerId,
        customerPaymentId: result.payment.id,
        valueDate,
        amountGross: Number(result.payment.amount),
        vatAmount: Number(totals.vatAmount),
        reference: `Part sale ${result.invoice.invoiceNumber}`,
      });
    }

    await this.audit.log({
      action: "parts.sale",
      userId: user.id,
      garageAccountId,
      entityType: "part",
      entityId: part.id,
      metadata: { invoiceId: result.invoice.id, quantity: qty.toString() },
    });

    return {
      invoice: toInvoiceDto(result.invoice),
      part: await this.getOne(user, part.id),
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

  private async returnSingleUsage(
    user: RequestUser,
    garageAccountId: string,
    usageId: string,
    jobFilter: { repairJobId: string } | { bodyworkJobId: string },
    opts?: {
      returnTo?: "STOCK" | "SUPPLIER";
      refundType?: SupplierRefundType;
      supplierId?: string;
      refundMethod?: PaymentMethod;
      paymentAccountId?: string;
      notes?: string;
    },
  ) {
    const usage = await this.prisma.jobPartUsage.findFirst({
      where: { id: usageId, garageAccountId, ...jobFilter },
      include: {
        part: true,
        repairJob: { include: { invoice: true } },
        bodyworkJob: { include: { invoice: true } },
      },
    });
    if (!usage) throw new NotFoundException("Part usage not found");
    if (usage.status === JobPartUsageStatus.RETURNED) return;
    if (usage.status === JobPartUsageStatus.CANCELLED) {
      throw new BadRequestException("This order was already cancelled");
    }
    if (usage.status === JobPartUsageStatus.ORDERED) {
      throw new BadRequestException("Cancel the order instead of returning it");
    }

    const returnTo =
      opts?.returnTo ??
      (usage.source === JobPartSource.ORDERED ? "SUPPLIER" : "STOCK");

    if (returnTo === "SUPPLIER" || usage.source === JobPartSource.ORDERED) {
      if (!opts?.refundType) {
        throw new BadRequestException(
          "Choose how the supplier refund is handled — credit on account or payment received",
        );
      }
      if (opts.refundType === SupplierRefundType.CREDIT) {
        const supplierId = opts.supplierId ?? usage.supplierId;
        if (!supplierId) {
          throw new BadRequestException("Select the supplier to credit");
        }
      }
      if (opts.refundType === SupplierRefundType.PAYMENT) {
        if (!opts.paymentAccountId || !opts.refundMethod) {
          throw new BadRequestException(
            "Payment account and refund method are required when recording a cash refund",
          );
        }
      }
    }

    const part = usage.part;
    const refundGross =
      Number(usage.costAmountGross) > 0
        ? Number(usage.costAmountGross)
        : Number(usage.quantity) * Number(usage.costPriceNet);
    const refundVat = Number(usage.costVatAmount) || 0;

    await this.prisma.$transaction(async (tx) => {
      await tx.jobPartUsage.update({
        where: { id: usageId },
        data: {
          status: JobPartUsageStatus.RETURNED,
          returnedAt: new Date(),
          returnRefundType: opts?.refundType ?? null,
          returnPaymentMethod: opts?.refundMethod ?? null,
          returnPaymentAccountId: opts?.paymentAccountId ?? null,
          returnNotes: opts?.notes?.trim() || null,
        },
      });

      if (returnTo === "STOCK" && usage.source === JobPartSource.STOCK) {
        const before = part.quantityOnHand;
        const after = before.add(usage.quantity);
        await tx.part.update({
          where: { id: part.id },
          data: { quantityOnHand: after },
        });
        await tx.partMovement.create({
          data: {
            garageAccountId,
            partId: part.id,
            type: PartMovementType.RETURN,
            quantity: usage.quantity,
            quantityBefore: before,
            quantityAfter: after,
            repairJobId: usage.repairJobId,
            bodyworkJobId: usage.bodyworkJobId,
            jobPartUsageId: usageId,
            createdById: user.id,
          },
        });
      }

      if (usage.repairJobId) {
        await this.ledger.voidPendingForJobPartUsage(garageAccountId, usageId, tx);
        await this.ledger.reverseJobPartExpenseIfPosted(
          user,
          garageAccountId,
          usageId,
          tx,
        );
      }

      if (
        (returnTo === "SUPPLIER" || usage.source === JobPartSource.ORDERED) &&
        opts?.refundType &&
        refundGross > 0
      ) {
        const supplierId = opts.supplierId ?? usage.supplierId;
        if (opts.refundType === SupplierRefundType.CREDIT && supplierId) {
          await this.supplierCredit.addRefundCredit(
            user,
            {
              supplierId,
              amountGross: refundGross,
              jobPartUsageId: usageId,
              notes: opts.notes ?? `Return to supplier — ${part.partNumber}`,
            },
            tx,
          );
        }
        if (
          opts.refundType === SupplierRefundType.PAYMENT &&
          opts.paymentAccountId &&
          this.ledgerEnabled(user)
        ) {
          await this.ledger.createPostedSupplierRefund(
            user,
            {
              amountGross: refundGross,
              vatAmount: refundVat,
              paymentAccountId: opts.paymentAccountId,
              paymentMethod: opts.refundMethod,
              supplierId: supplierId ?? undefined,
              jobPartUsageId: usageId,
              reference: opts.notes?.trim() || `Supplier refund — ${part.partNumber}`,
              valueDate: new Date(),
            },
            tx,
          );
        }
      }

      if (usage.bodyworkJob?.invoice && usage.bodyworkJobId) {
        await this.bodyworkInvoiceSync.syncInvoiceLines(
          tx,
          usage.bodyworkJobId,
          garageAccountId,
          user.id,
        );
      }
    });
  }

  async returnUsagesForTask(user: RequestUser, repairJobId: string, repairTaskId: string) {
    const garageAccountId = this.garageId(user);
    const usages = await this.prisma.jobPartUsage.findMany({
      where: {
        repairJobId,
        repairTaskId,
        garageAccountId,
        status: JobPartUsageStatus.CONSUMED,
      },
      select: { id: true },
    });
    for (const usage of usages) {
      await this.returnSingleUsage(user, garageAccountId, usage.id, { repairJobId });
    }
    if (usages.length > 0) {
      await this.audit.log({
        action: "parts.job.return",
        userId: user.id,
        garageAccountId,
        entityType: "repair_task",
        entityId: repairTaskId,
        metadata: { repairJobId, count: usages.length },
      });
    }
  }

  async returnUsagesForJob(user: RequestUser, repairJobId: string) {
    const garageAccountId = this.garageId(user);
    await this.prisma.jobPartUsage.updateMany({
      where: {
        repairJobId,
        garageAccountId,
        status: JobPartUsageStatus.ORDERED,
      },
      data: { status: JobPartUsageStatus.CANCELLED },
    });
    const usages = await this.prisma.jobPartUsage.findMany({
      where: {
        repairJobId,
        garageAccountId,
        status: JobPartUsageStatus.CONSUMED,
      },
      select: { id: true, source: true },
    });
    for (const usage of usages) {
      await this.returnSingleUsage(user, garageAccountId, usage.id, { repairJobId }, {
        returnTo: usage.source === JobPartSource.ORDERED ? "SUPPLIER" : "STOCK",
      });
    }
    if (usages.length > 0) {
      await this.audit.log({
        action: "parts.job.return",
        userId: user.id,
        garageAccountId,
        entityType: "repair_job",
        entityId: repairJobId,
        metadata: { count: usages.length, reason: "job_cancelled" },
      });
    }
  }

  async returnFromJob(
    user: RequestUser,
    repairJobId: string,
    usageId: string,
    dto?: ReturnJobPartDto,
  ): Promise<RepairJobDto> {
    const garageAccountId = this.garageId(user);
    const usage = await this.prisma.jobPartUsage.findFirst({
      where: { id: usageId, repairJobId, garageAccountId },
      include: { part: { select: { partNumber: true } } },
    });
    if (!usage) throw new NotFoundException("Part usage not found");
    if (usage.status === JobPartUsageStatus.RETURNED) {
      throw new BadRequestException("This part has already been returned");
    }

    await this.returnSingleUsage(user, garageAccountId, usageId, { repairJobId }, {
      returnTo: dto?.returnTo,
      refundType: dto?.refundType,
      supplierId: dto?.supplierId,
      refundMethod: dto?.refundMethod,
      paymentAccountId: dto?.paymentAccountId,
      notes: dto?.notes,
    });

    await this.audit.log({
      action: "parts.job.return",
      userId: user.id,
      garageAccountId,
      entityType: "repair_job",
      entityId: repairJobId,
      metadata: { usageId, partNumber: usage.part.partNumber },
    });

    return this.repairJobs.getOne(user, repairJobId);
  }

  async returnFromBodyworkJob(
    user: RequestUser,
    bodyworkJobId: string,
    usageId: string,
  ): Promise<BodyworkJobDto> {
    const garageAccountId = this.garageId(user);
    const usage = await this.prisma.jobPartUsage.findFirst({
      where: { id: usageId, bodyworkJobId, garageAccountId },
      include: { part: { select: { partNumber: true } } },
    });
    if (!usage) throw new NotFoundException("Part usage not found");
    if (usage.status === JobPartUsageStatus.RETURNED) {
      throw new BadRequestException("This part has already been returned to stock");
    }

    await this.returnSingleUsage(user, garageAccountId, usageId, { bodyworkJobId });

    await this.audit.log({
      action: "parts.bodywork.return",
      userId: user.id,
      garageAccountId,
      entityType: "bodywork_job",
      entityId: bodyworkJobId,
      metadata: { usageId, partNumber: usage.part.partNumber },
    });

    return this.bodyworkJobs.getOne(user, bodyworkJobId);
  }
}
