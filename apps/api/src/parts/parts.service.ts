import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  isRepairJobApprovedForWork,
  type RepairJobDto,
} from "@mygaragepro/shared";
import {
  JobPartUsageStatus,
  PartFitmentType,
  PartMovementType,
  PartStatus,
  Prisma,
  RepairJobStatus,
} from "@prisma/client";
import { AuditService } from "../audit/audit.service";
import type { RequestUser } from "../auth/auth.types";
import { roundMoney } from "../invoices/invoice-calculations";
import { PrismaService } from "../prisma/prisma.service";
import { RepairJobsService } from "../repair-jobs/repair-jobs.service";
import { ConsumePartDto } from "./dto/consume-part.dto";
import { CreatePartDto } from "./dto/create-part.dto";
import { ReceiveStockDto } from "./dto/receive-stock.dto";
import { UpdatePartDto } from "./dto/update-part.dto";
import { toJobPartUsageDto } from "./job-parts.mapper";
import {
  assertPartFitsJobVehicle,
  filterPartsForVehicle,
  validateAndNormalizeFitments,
} from "./part-fitment.util";
import { toPartDto } from "./parts.mapper";
import { JobPartsInvoiceSync } from "./job-parts-invoice-sync";
import type { PartVehicleContext } from "@mygaragepro/shared";

@Injectable()
export class PartsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly repairJobs: RepairJobsService,
    private readonly invoiceSync: JobPartsInvoiceSync,
  ) {}

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

    const row = await this.prisma.$transaction(async (tx) => {
      const part = await tx.part.create({
        data: {
          garageAccountId,
          partNumber,
          description: dto.description.trim(),
          category: dto.category?.trim() || null,
          fitmentType,
          quantityOnHand: roundMoney(dto.quantityOnHand ?? 0),
          minQuantity: roundMoney(dto.minQuantity ?? 0),
          costPriceNet: roundMoney(dto.costPriceNet ?? 0),
          sellPriceNet: roundMoney(dto.sellPriceNet ?? 0),
          supplierId: dto.supplierId ?? null,
          location: dto.location?.trim() || null,
          notes: dto.notes?.trim() || null,
        },
      });
      await this.replaceFitments(tx, part.id, fitmentType, fitmentRows);
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

    await this.prisma.$transaction(async (tx) => {
      await tx.part.update({
        where: { id },
        data: { quantityOnHand: after },
      });
      await tx.partMovement.create({
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

  async consumeOnJob(
    user: RequestUser,
    repairJobId: string,
    dto: ConsumePartDto,
  ): Promise<RepairJobDto> {
    const garageAccountId = this.garageId(user);
    if (!user.enabledModules.includes("repair")) {
      throw new ForbiddenException("Repair module is not enabled");
    }

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

    const part = await this.prisma.part.findFirst({
      where: {
        id: dto.partId,
        garageAccountId,
        deletedAt: null,
        status: PartStatus.ACTIVE,
      },
      include: { fitments: { orderBy: { sortOrder: "asc" } } },
    });
    if (!part) throw new NotFoundException("Part not found");

    // Vehicle-specific parts must match the job's make/model before stock is consumed.
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

    await this.prisma.$transaction(async (tx) => {
      const usage = await tx.jobPartUsage.create({
        data: {
          garageAccountId,
          repairJobId,
          repairTaskId: dto.repairTaskId ?? null,
          partId: part.id,
          quantity: qty,
          costPriceNet: part.costPriceNet,
          sellPriceNet: part.sellPriceNet,
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

      if (job.invoice) {
        await this.invoiceSync.syncInvoiceLines(tx, job.id, garageAccountId, user.id);
      }
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

    return this.repairJobs.getOne(user, repairJobId);
  }

  async returnFromJob(
    user: RequestUser,
    repairJobId: string,
    usageId: string,
  ): Promise<RepairJobDto> {
    const garageAccountId = this.garageId(user);

    const usage = await this.prisma.jobPartUsage.findFirst({
      where: { id: usageId, repairJobId, garageAccountId },
      include: { part: true, repairJob: { include: { invoice: true } } },
    });
    if (!usage) throw new NotFoundException("Part usage not found");
    if (usage.status === JobPartUsageStatus.RETURNED) {
      throw new BadRequestException("This part has already been returned to stock");
    }

    const part = usage.part;
    const before = part.quantityOnHand;
    const after = before.add(usage.quantity);

    await this.prisma.$transaction(async (tx) => {
      await tx.jobPartUsage.update({
        where: { id: usageId },
        data: { status: JobPartUsageStatus.RETURNED, returnedAt: new Date() },
      });

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
          repairJobId,
          jobPartUsageId: usageId,
          createdById: user.id,
        },
      });

      if (usage.repairJob.invoice) {
        await this.invoiceSync.syncInvoiceLines(tx, repairJobId, garageAccountId, user.id);
      }
    });

    await this.audit.log({
      action: "parts.job.return",
      userId: user.id,
      garageAccountId,
      entityType: "repair_job",
      entityId: repairJobId,
      metadata: { usageId, partNumber: part.partNumber },
    });

    return this.repairJobs.getOne(user, repairJobId);
  }
}
