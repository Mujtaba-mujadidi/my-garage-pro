import {
  allRepairTasksComplete,
  canTransitionRepairJob,
  canTransitionRepairTaskMechanic,
  isRepairJobApprovedForWork,
  jobStatusRequiresTasks,
  JOB_QUOTE_APPROVE_TASKS_MESSAGE,
  REPAIR_CLAIMABLE_JOB_STATUSES,
} from "@mygaragepro/shared";
import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from "@nestjs/common";
import {
  InvoiceStatus,
  JobPartUsageStatus,
  JobTyreUsageStatus,
  Prisma,
  RepairJobStatus,
  RepairTaskStatus,
  UserStatus,
} from "@prisma/client";
import { AuditService } from "../audit/audit.service";
import type { RequestUser } from "../auth/auth.types";
import { CustomersService } from "../customers/customers.service";
import { normalizeRegistration } from "../customers/customers.mapper";
import { allocatedTotal } from "../invoices/invoice-calculations";
import { roundMoney, sumLines } from "../invoices/invoice-calculations";
import {
  computeJobInvoiceTotals,
  invoiceAmountsMatch,
  lineCreateData,
} from "./repair-job-invoice-totals";
import { toInvoiceDto } from "../invoices/invoices.mapper";
import { PrismaService } from "../prisma/prisma.service";
import { PartsService } from "../parts/parts.service";
import { TyresService } from "../tyres/tyres.service";
import {
  assertWorkshopStaffActor,
  isWorkshopStaffView,
  workshopMapOptions,
} from "../workshop/workshop-access.util";
import { CreateRepairJobDto } from "./dto/create-repair-job.dto";
import { CreateRepairTaskDto } from "./dto/create-repair-task.dto";
import type { CreateRepairTaskTyreDto } from "./dto/create-repair-task-tyre.dto";
import { RepairTaskPartDto } from "./dto/repair-task-part.dto";
import { UpdateRepairJobDto } from "./dto/update-repair-job.dto";
import { UpdateRepairJobStatusDto } from "./dto/update-repair-job-status.dto";
import { UpdateRepairTaskDto } from "./dto/update-repair-task.dto";
import {
  type RepairMapOptions,
  toRepairJobDto,
  toRepairJobListDto,
} from "./repair-jobs.mapper";
import type { RepairJobListDto } from "@mygaragepro/shared";

@Injectable()
export class RepairJobsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly customers: CustomersService,
    @Inject(forwardRef(() => PartsService))
    private readonly parts: PartsService,
    @Inject(forwardRef(() => TyresService))
    private readonly tyres: TyresService,
  ) {}

  private jobInclude = {
    customer: true,
    tasks: {
      orderBy: { sortOrder: "asc" as const },
      include: {
        assignee: { select: { displayName: true } },
        parts: { orderBy: { sortOrder: "asc" as const } },
      },
    },
    invoice: {
      select: {
        id: true,
        invoiceNumber: true,
        amountNet: true,
        amountGross: true,
        status: true,
        depositAmount: true,
        allocations: { where: { deletedAt: null }, select: { amount: true } },
      },
    },
    partUsages: {
      include: {
        part: { select: { partNumber: true, description: true } },
        repairTask: { select: { title: true } },
      },
      orderBy: { consumedAt: "desc" as const },
    },
    tyreUsages: {
      include: {
        tyre: {
          select: { skuCode: true, brand: true, model: true, size: true, loadIndex: true, speedRating: true },
        },
        repairTask: { select: { title: true } },
      },
      orderBy: { consumedAt: "desc" as const },
    },
  };

  private async garageCanChargeVat(garageAccountId: string): Promise<boolean> {
    const garage = await this.prisma.garageAccount.findUnique({
      where: { id: garageAccountId },
      select: { vatNumber: true },
    });
    return Boolean(garage?.vatNumber?.trim());
  }

  private async resolveVatEnabled(
    garageAccountId: string,
    requested: boolean | undefined,
  ): Promise<boolean> {
    const canChargeVat = await this.garageCanChargeVat(garageAccountId);
    if (!canChargeVat) {
      if (requested) {
        throw new BadRequestException(
          "VAT cannot be charged — this garage is not VAT registered",
        );
      }
      return false;
    }
    return requested ?? true;
  }

  private async assertJobTasksEditable(garageAccountId: string, jobId: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { repairJobId: jobId, garageAccountId },
      select: { status: true },
    });
    if (invoice?.status === InvoiceStatus.PAID) {
      throw new BadRequestException("Tasks cannot be changed after the invoice is paid");
    }
  }

  private assertJobApprovedForAssignment(status: RepairJobStatus) {
    if (!isRepairJobApprovedForWork(status)) {
      throw new BadRequestException(
        "Approve this repair before assigning tasks to mechanics",
      );
    }
  }

  private garageId(user: RequestUser): string {
    if (!user.garageAccountId) throw new ForbiddenException("No garage context");
    if (!user.enabledModules.includes("repair")) {
      throw new ForbiddenException("Repair module is not enabled");
    }
    return user.garageAccountId;
  }

  private normalizeReg(reg?: string | null) {
    if (!reg?.trim()) return null;
    return normalizeRegistration(reg);
  }

  private async nextJobNumber(garageAccountId: string): Promise<string> {
    const garage = await this.prisma.garageAccount.update({
      where: { id: garageAccountId },
      data: { repairNextSeq: { increment: 1 } },
      select: { repairNextSeq: true },
    });
    const year = new Date().getFullYear();
    return `REJ-${year}-${String(garage.repairNextSeq).padStart(5, "0")}`;
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

  private computeTaskAmountNet(input: {
    useBreakdown: boolean;
    amountNet?: number;
    labourHours?: number;
    labourRateNet?: number;
    parts?: RepairTaskPartDto[];
  }): Prisma.Decimal {
    if (input.useBreakdown) {
      const labour = (input.labourHours ?? 1) * (input.labourRateNet ?? 0);
      const parts = (input.parts ?? []).reduce(
        (sum, part) => sum + (part.quantity ?? 1) * part.unitPriceNet,
        0,
      );
      return roundMoney(labour + parts);
    }
    return roundMoney(input.amountNet ?? 0);
  }

  private async resolveTyreSellPriceForTask(
    garageAccountId: string,
    tyreDto: CreateRepairTaskTyreDto,
  ): Promise<number> {
    const tyre = await this.prisma.tyre.findFirst({
      where: { id: tyreDto.tyreId, garageAccountId, deletedAt: null },
    });
    if (!tyre) throw new NotFoundException("Tyre not found");

    if (tyreDto.priceTier === "CUSTOM") {
      if (!(tyreDto.sellPriceNet !== undefined && tyreDto.sellPriceNet > 0)) {
        throw new BadRequestException("Enter an agreed unit price for this tyre task");
      }
      return Number(roundMoney(tyreDto.sellPriceNet));
    }
    if (tyreDto.priceTier === "TRADE") {
      const trade = Number(tyre.tradeSellPriceNet);
      if (trade > 0) return Number(roundMoney(trade));
      throw new BadRequestException("This tyre has no trade price — use customer or agreed price");
    }
    return Number(roundMoney(Number(tyre.sellPriceNet)));
  }

  private partCreateData(parts: RepairTaskPartDto[]) {
    return parts.map((part, index) => ({
      description: part.description.trim(),
      quantity: new Prisma.Decimal((part.quantity ?? 1).toFixed(3)),
      unitPriceNet: roundMoney(part.unitPriceNet),
      sortOrder: index,
    }));
  }

  private applyInvoiceSyncFields(
    row: {
      vatEnabled: boolean;
      vatRatePercent: Prisma.Decimal;
      tasks: {
        title: string;
        amountNet: Prisma.Decimal;
        useBreakdown: boolean;
        labourHours: Prisma.Decimal;
        labourRateNet: Prisma.Decimal;
        parts: {
          description: string;
          quantity: Prisma.Decimal;
          unitPriceNet: Prisma.Decimal;
        }[];
      }[];
      invoice: {
        amountNet: Prisma.Decimal;
        amountGross: Prisma.Decimal;
        status: InvoiceStatus;
      } | null;
      partUsages: {
        status: JobPartUsageStatus;
        quantity: Prisma.Decimal;
        sellPriceNet: Prisma.Decimal;
        part: { partNumber: string; description: string };
      }[];
      tyreUsages: {
        status: JobTyreUsageStatus;
        quantity: Prisma.Decimal;
        sellPriceNet: Prisma.Decimal;
        fittingChargeNet: Prisma.Decimal;
        tyre: { skuCode: string; brand: string | null; model: string | null; size: string; loadIndex: string | null; speedRating: string | null };
      }[];
    },
    dto: RepairJobListDto,
    canChargeVat: boolean,
  ): RepairJobListDto {
    if (!row.invoice) {
      return { ...dto, tasksAmountNet: null, tasksAmountGross: null, invoiceInSync: null };
    }

    const consumedParts = (row.partUsages ?? []).filter((u) => u.status === JobPartUsageStatus.CONSUMED);
    const consumedTyres = (row.tyreUsages ?? []).filter((u) => u.status === JobTyreUsageStatus.CONSUMED);
    const computed = computeJobInvoiceTotals(row, row.tasks, canChargeVat, consumedParts, consumedTyres);
    const refreshable =
      row.invoice.status === InvoiceStatus.SENT ||
      row.invoice.status === InvoiceStatus.PART_PAID;

    if (!computed) {
      return {
        ...dto,
        tasksAmountNet: "0.00",
        tasksAmountGross: "0.00",
        invoiceInSync: refreshable ? false : null,
      };
    }

    return {
      ...dto,
      tasksAmountNet: computed.amountNet,
      tasksAmountGross: computed.amountGross,
      invoiceInSync: refreshable
        ? invoiceAmountsMatch(row.invoice, computed)
        : null,
    };
  }

  private async validateAssignee(garageAccountId: string, assigneeId: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        id: assigneeId,
        garageAccountId,
        deletedAt: null,
        status: UserStatus.ACTIVE,
      },
    });
    if (!user) throw new BadRequestException("Assignee not found or inactive");
    return user;
  }

  private taskStatusForAssignee(assigneeId: string | null | undefined, current: RepairTaskStatus) {
    if (assigneeId && current === RepairTaskStatus.AVAILABLE) {
      return RepairTaskStatus.ASSIGNED;
    }
    if (!assigneeId && current === RepairTaskStatus.ASSIGNED) {
      return RepairTaskStatus.AVAILABLE;
    }
    return current;
  }

  private mapOpts(user: RequestUser): RepairMapOptions {
    return workshopMapOptions(user, "repair");
  }

  private jobVisibleToWorkshopStaff(
    job: {
      status: RepairJobStatus;
      tasks: { assigneeId: string | null; status: RepairTaskStatus }[];
    },
    userId: string,
  ) {
    const hasMine = job.tasks.some((t) => t.assigneeId === userId);
    const hasClaimable = job.tasks.some(
      (t) =>
        !t.assigneeId &&
        t.status === RepairTaskStatus.AVAILABLE &&
        REPAIR_CLAIMABLE_JOB_STATUSES.includes(job.status),
    );
    return hasMine || hasClaimable;
  }

  private assertWorkshopJobAccess(
    job: {
      status: RepairJobStatus;
      tasks: { assigneeId: string | null; status: RepairTaskStatus }[];
    },
    userId: string,
  ) {
    if (!this.jobVisibleToWorkshopStaff(job, userId)) {
      throw new NotFoundException("Repair job not found");
    }
  }

  private assertMechanicHasAssignedTask(
    tasks: { assigneeId: string | null }[],
    userId: string,
  ) {
    if (!tasks.some((t) => t.assigneeId === userId)) {
      throw new ForbiddenException("You have no assigned tasks on this job");
    }
  }

  private resolveJobStatusFromTasks(
    currentStatus: RepairJobStatus,
    taskStatuses: RepairTaskStatus[],
  ): RepairJobStatus | null {
    if (taskStatuses.length === 0) return null;

    const allDone = taskStatuses.every(
      (status) =>
        status === RepairTaskStatus.COMPLETED ||
        status === RepairTaskStatus.CANCELLED,
    );

    if (!allDone) {
      if (
        currentStatus === RepairJobStatus.TESTING ||
        currentStatus === RepairJobStatus.READY
      ) {
        return RepairJobStatus.IN_PROGRESS;
      }
      return null;
    }

    const autoAdvanceFrom: RepairJobStatus[] = [
      RepairJobStatus.APPROVED,
      RepairJobStatus.AWAITING_VEHICLE,
      RepairJobStatus.AWAITING_PARTS,
      RepairJobStatus.ON_HOLD,
      RepairJobStatus.IN_PROGRESS,
    ];
    if (autoAdvanceFrom.includes(currentStatus)) {
      return RepairJobStatus.TESTING;
    }

    return null;
  }

  /** Keep job status in sync with task completion (QC advance and revert). */
  private async syncJobStatusAfterTasks(
    jobId: string,
    db: Prisma.TransactionClient | PrismaService = this.prisma,
  ) {
    const job = await db.repairJob.findUnique({
      where: { id: jobId },
      include: { tasks: { select: { status: true } } },
    });
    if (!job || job.tasks.length === 0) return;

    const nextStatus = this.resolveJobStatusFromTasks(
      job.status,
      job.tasks.map((t) => t.status),
    );
    if (!nextStatus || nextStatus === job.status) return;

    await db.repairJob.update({
      where: { id: jobId },
      data: { status: nextStatus },
    });
  }

  private async syncJobStatusesForRows(jobIds: string[]) {
    if (jobIds.length === 0) return;
    await Promise.all(jobIds.map((id) => this.syncJobStatusAfterTasks(id)));
  }

  async list(
    user: RequestUser,
    q?: string,
    status?: RepairJobStatus,
    scope?: "mine" | "available",
    customerId?: string,
  ) {
    const garageAccountId = this.garageId(user);
    const search = q?.trim();

    const and: Prisma.RepairJobWhereInput[] = [{ garageAccountId }];
    if (customerId) and.push({ customerId });
    if (status) and.push({ status });
    if (search) {
      and.push({
        OR: [
          { jobNumber: { contains: search, mode: "insensitive" } },
          { vehicleRegistration: { contains: search.toUpperCase(), mode: "insensitive" } },
          { customerConcern: { contains: search, mode: "insensitive" } },
          { customer: { companyName: { contains: search, mode: "insensitive" } } },
          { customer: { firstName: { contains: search, mode: "insensitive" } } },
          { customer: { lastName: { contains: search, mode: "insensitive" } } },
        ],
      });
    }

    if (isWorkshopStaffView(user, "repair")) {
      if (scope === "mine") {
        and.push({ tasks: { some: { assigneeId: user.id } } });
      } else if (scope === "available") {
        and.push({
          status: { in: REPAIR_CLAIMABLE_JOB_STATUSES },
          tasks: {
            some: { assigneeId: null, status: RepairTaskStatus.AVAILABLE },
          },
        });
      } else {
        and.push({
          OR: [
            { tasks: { some: { assigneeId: user.id } } },
            {
              status: { in: REPAIR_CLAIMABLE_JOB_STATUSES },
              tasks: {
                some: { assigneeId: null, status: RepairTaskStatus.AVAILABLE },
              },
            },
          ],
        });
      }
    }

    const where: Prisma.RepairJobWhereInput = { AND: and };

    const rows = await this.prisma.repairJob.findMany({
      where,
      include: this.jobInclude,
      orderBy: [{ updatedAt: "desc" }],
      take: 200,
    });
    const jobIds = rows.map((row) => row.id);
    await this.syncJobStatusesForRows(jobIds);

    const refreshed =
      jobIds.length === 0
        ? []
        : await this.prisma.repairJob.findMany({
            where: { id: { in: jobIds } },
            include: this.jobInclude,
            orderBy: [{ updatedAt: "desc" }],
          });

    const opts = this.mapOpts(user);
    const canChargeVat = await this.garageCanChargeVat(garageAccountId);
    return refreshed.map((row) =>
      this.applyInvoiceSyncFields(row, toRepairJobListDto(row, opts), canChargeVat),
    );
  }

  async getOne(user: RequestUser, id: string) {
    const garageAccountId = this.garageId(user);
    await this.syncJobStatusAfterTasks(id);
    const row = await this.prisma.repairJob.findFirst({
      where: { id, garageAccountId },
      include: this.jobInclude,
    });
    if (!row) throw new NotFoundException("Repair job not found");
    if (isWorkshopStaffView(user, "repair")) {
      this.assertWorkshopJobAccess(row, user.id);
    }
    const opts = this.mapOpts(user);
    const canChargeVat = await this.garageCanChargeVat(garageAccountId);
    const listDto = this.applyInvoiceSyncFields(row, toRepairJobListDto(row, opts), canChargeVat);
    return { ...toRepairJobDto(row, opts), ...listDto };
  }

  async listAssignees(user: RequestUser) {
    const garageAccountId = this.garageId(user);
    const rows = await this.prisma.user.findMany({
      where: { garageAccountId, deletedAt: null, status: UserStatus.ACTIVE },
      select: { id: true, displayName: true, role: true },
      orderBy: { displayName: "asc" },
    });
    return rows.map((r) => ({
      id: r.id,
      displayName: r.displayName,
      role: r.role,
    }));
  }

  async create(user: RequestUser, dto: CreateRepairJobDto) {
    const garageAccountId = this.garageId(user);
    const customer = await this.prisma.customer.findFirst({
      where: { id: dto.customerId, garageAccountId, deletedAt: null },
    });
    if (!customer) throw new NotFoundException("Customer not found");

    const jobNumber = await this.nextJobNumber(garageAccountId);
    const vatEnabled = await this.resolveVatEnabled(garageAccountId, dto.vatEnabled);
    const vehicleRegistration = this.normalizeReg(dto.vehicleRegistration);
    const vehicleMake = dto.vehicleMake?.trim() || null;
    const vehicleModel = dto.vehicleModel?.trim() || null;

    const row = await this.prisma.repairJob.create({
      data: {
        garageAccountId,
        customerId: dto.customerId,
        jobNumber,
        source: dto.source ?? "CUSTOMER",
        vehicleRegistration,
        vehicleMake,
        vehicleModel,
        customerConcern: dto.customerConcern?.trim() || null,
        notes: dto.notes?.trim() || null,
        vatEnabled,
        vatRatePercent: roundMoney(dto.vatRatePercent ?? 20),
        createdById: user.id,
      },
      include: this.jobInclude,
    });

    if (vehicleRegistration) {
      await this.customers.ensureVehicle(garageAccountId, dto.customerId, {
        registration: vehicleRegistration,
        make: vehicleMake,
        model: vehicleModel,
      });
    }

    await this.audit.log({
      action: "repair.job.create",
      userId: user.id,
      garageAccountId,
      entityType: "repair_job",
      entityId: row.id,
      metadata: { jobNumber: row.jobNumber },
    });

    return toRepairJobDto(row, this.mapOpts(user));
  }

  private isVatSettingsUpdate(dto: UpdateRepairJobDto): boolean {
    const otherFields: (keyof UpdateRepairJobDto)[] = [
      "source",
      "vehicleRegistration",
      "vehicleMake",
      "vehicleModel",
      "customerConcern",
      "notes",
    ];
    return (
      (dto.vatEnabled !== undefined || dto.vatRatePercent !== undefined) &&
      otherFields.every((field) => dto[field] === undefined)
    );
  }

  async update(user: RequestUser, id: string, dto: UpdateRepairJobDto) {
    const garageAccountId = this.garageId(user);
    const existing = await this.prisma.repairJob.findFirst({
      where: { id, garageAccountId },
    });
    if (!existing) throw new NotFoundException("Repair job not found");
    if (existing.status === RepairJobStatus.CANCELLED) {
      throw new BadRequestException("Cancelled jobs cannot be edited");
    }

    const vatSettingsOnly = this.isVatSettingsUpdate(dto);
    if (!vatSettingsOnly && existing.status === RepairJobStatus.COMPLETED) {
      throw new BadRequestException("Completed jobs can only have VAT settings changed");
    }

    const vatChanging =
      (dto.vatEnabled !== undefined && dto.vatEnabled !== existing.vatEnabled) ||
      (dto.vatRatePercent !== undefined &&
        roundMoney(dto.vatRatePercent).toString() !== existing.vatRatePercent.toString());

    if (vatChanging) {
      const invoiced = await this.prisma.invoice.findFirst({
        where: { repairJobId: id },
        select: { id: true },
      });
      if (invoiced) {
        throw new BadRequestException("VAT cannot be changed after an invoice has been generated");
      }
    }

    let vatEnabled = dto.vatEnabled;
    if (dto.vatEnabled !== undefined) {
      vatEnabled = await this.resolveVatEnabled(garageAccountId, dto.vatEnabled);
    }

    const row = await this.prisma.repairJob.update({
      where: { id },
      data: {
        ...(dto.source !== undefined ? { source: dto.source } : {}),
        ...(dto.vehicleRegistration !== undefined
          ? { vehicleRegistration: this.normalizeReg(dto.vehicleRegistration) }
          : {}),
        ...(dto.vehicleMake !== undefined ? { vehicleMake: dto.vehicleMake?.trim() || null } : {}),
        ...(dto.vehicleModel !== undefined ? { vehicleModel: dto.vehicleModel?.trim() || null } : {}),
        ...(dto.customerConcern !== undefined
          ? { customerConcern: dto.customerConcern?.trim() || null }
          : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes?.trim() || null } : {}),
        ...(dto.vatEnabled !== undefined ? { vatEnabled } : {}),
        ...(dto.vatRatePercent !== undefined
          ? { vatRatePercent: roundMoney(dto.vatRatePercent) }
          : {}),
      },
      include: this.jobInclude,
    });

    await this.audit.log({
      action: "repair.job.update",
      userId: user.id,
      garageAccountId,
      entityType: "repair_job",
      entityId: row.id,
    });

    return toRepairJobDto(row, this.mapOpts(user));
  }

  async updateStatus(user: RequestUser, id: string, dto: UpdateRepairJobStatusDto) {
    const garageAccountId = this.garageId(user);
    const existing = await this.prisma.repairJob.findFirst({
      where: { id, garageAccountId },
      include: { tasks: { select: { assigneeId: true, status: true } } },
    });
    if (!existing) throw new NotFoundException("Repair job not found");

    if (isWorkshopStaffView(user, "repair")) {
      throw new ForbiddenException("Mechanics can update task status only, not job status");
    }
    if (!canTransitionRepairJob(existing.status, dto.status)) {
      throw new BadRequestException(
        `Cannot move job from ${existing.status} to ${dto.status}`,
      );
    }
    if (
      dto.status === RepairJobStatus.COMPLETED &&
      !allRepairTasksComplete(existing.tasks)
    ) {
      throw new BadRequestException(
        "All tasks must be completed before the job can be marked complete",
      );
    }
    if (jobStatusRequiresTasks(dto.status) && existing.tasks.length === 0) {
      throw new BadRequestException(JOB_QUOTE_APPROVE_TASKS_MESSAGE);
    }

    const sendBackToWorkshop =
      (existing.status === RepairJobStatus.TESTING ||
        existing.status === RepairJobStatus.READY) &&
      dto.status === RepairJobStatus.IN_PROGRESS;
    const qcApproved =
      existing.status === RepairJobStatus.TESTING && dto.status === RepairJobStatus.READY;

    const row = await this.prisma.$transaction(async (tx) => {
      if (sendBackToWorkshop) {
        const jobTasks = await tx.repairTask.findMany({
          where: { repairJobId: id },
          select: { id: true, title: true },
        });
        const allTaskIds = jobTasks.map((t) => t.id);
        const requestedIds = dto.failedTaskIds?.length ? dto.failedTaskIds : allTaskIds;
        const invalid = requestedIds.filter((taskId) => !allTaskIds.includes(taskId));
        if (invalid.length > 0) {
          throw new BadRequestException("One or more selected tasks do not belong to this job");
        }

        await tx.repairTask.updateMany({
          where: {
            repairJobId: id,
            id: { in: requestedIds },
            status: { not: RepairTaskStatus.CANCELLED },
          },
          data: { status: RepairTaskStatus.IN_PROGRESS },
        });

        const date = new Date().toISOString().slice(0, 10);
        const comment = dto.comment?.trim();
        const failedTitles = jobTasks
          .filter((t) => requestedIds.includes(t.id))
          .map((t) => t.title);
        const failedLabel =
          dto.failedTaskIds?.length && dto.failedTaskIds.length < allTaskIds.length
            ? ` (${failedTitles.join(", ")})`
            : "";
        const noteLine = comment
          ? `[QC ${date}] Returned to workshop${failedLabel}: ${comment}`
          : `[QC ${date}] Returned to workshop${failedLabel} for further work.`;
        const priorNotes = (
          await tx.repairJob.findUnique({ where: { id }, select: { notes: true } })
        )?.notes?.trim();

        await tx.repairJob.update({
          where: { id },
          data: {
            status: dto.status,
            notes: priorNotes ? `${priorNotes}\n\n${noteLine}` : noteLine,
          },
        });
      } else {
        await tx.repairJob.update({
          where: { id },
          data: { status: dto.status },
        });
      }

      return tx.repairJob.findFirst({
        where: { id },
        include: this.jobInclude,
      });
    });

    if (!row) throw new NotFoundException("Repair job not found");

    if (
      dto.status === RepairJobStatus.COMPLETED &&
      existing.status !== RepairJobStatus.COMPLETED
    ) {
      await this.parts.postPendingJobExpensesOnRepairComplete(user, id);
    }

    if (
      dto.status === RepairJobStatus.CANCELLED &&
      existing.status !== RepairJobStatus.CANCELLED
    ) {
      if (user.enabledModules.includes("parts")) {
        await this.parts.returnUsagesForJob(user, id);
      }
      if (user.enabledModules.includes("tyres")) {
        await this.tyres.returnUsagesForJob(user, id);
      }
    }

    await this.audit.log({
      action: sendBackToWorkshop ? "repair.job.qc.reject" : "repair.job.status",
      userId: user.id,
      garageAccountId,
      entityType: "repair_job",
      entityId: row.id,
      metadata: {
        from: existing.status,
        to: dto.status,
        ...(qcApproved ? { qcApproved: true } : {}),
        ...(sendBackToWorkshop
          ? {
              sendBack: true,
              comment: dto.comment?.trim() || null,
              failedTaskIds: dto.failedTaskIds?.length ? dto.failedTaskIds : null,
              allTasksFailed: !dto.failedTaskIds?.length,
            }
          : {}),
      },
    });

    return toRepairJobDto(row, this.mapOpts(user));
  }

  async addTask(user: RequestUser, jobId: string, dto: CreateRepairTaskDto) {
    const garageAccountId = this.garageId(user);
    const job = await this.prisma.repairJob.findFirst({
      where: { id: jobId, garageAccountId },
      include: { tasks: { select: { sortOrder: true } } },
    });
    if (!job) throw new NotFoundException("Repair job not found");
    if (job.status === RepairJobStatus.COMPLETED || job.status === RepairJobStatus.CANCELLED) {
      throw new BadRequestException("Cannot add tasks to a closed job");
    }
    await this.assertJobTasksEditable(garageAccountId, jobId);

    let assigneeId: string | null = dto.assigneeId ?? null;
    if (assigneeId) {
      this.assertJobApprovedForAssignment(job.status);
      await this.validateAssignee(garageAccountId, assigneeId);
    }
    let status: RepairTaskStatus = RepairTaskStatus.AVAILABLE;
    if (assigneeId) {
      status = RepairTaskStatus.ASSIGNED;
    }

    const hasTyre = Boolean(dto.tyre);
    if (hasTyre && !user.enabledModules.includes("tyres")) {
      throw new BadRequestException("Tyres module is not enabled");
    }

    const useBreakdown = hasTyre ? false : (dto.useBreakdown ?? false);
    const parts = useBreakdown ? (dto.parts ?? []).filter((p) => p.description?.trim()) : [];
    if (!hasTyre && useBreakdown && parts.length === 0 && !(dto.labourRateNet && dto.labourRateNet > 0)) {
      throw new BadRequestException("Add labour or at least one part when using breakdown");
    }
    if (!hasTyre && !useBreakdown && !(dto.amountNet && dto.amountNet > 0)) {
      throw new BadRequestException("Enter the task total amount, or enable labour and parts breakdown");
    }
    const amountNet = hasTyre
      ? roundMoney(0)
      : this.computeTaskAmountNet({
          useBreakdown,
          amountNet: dto.amountNet,
          labourHours: dto.labourHours,
          labourRateNet: dto.labourRateNet,
          parts,
        });

    const maxSort = job.tasks.reduce((m, t) => Math.max(m, t.sortOrder), -1);
    const row = await this.prisma.repairTask.create({
      data: {
        repairJobId: jobId,
        title: dto.title.trim(),
        description: dto.description?.trim() || null,
        assigneeId,
        status,
        amountNet,
        useBreakdown,
        labourHours: roundMoney(dto.labourHours ?? 1),
        labourRateNet: roundMoney(dto.labourRateNet ?? 0),
        sortOrder: maxSort + 1,
        parts: parts.length ? { create: this.partCreateData(parts) } : undefined,
      },
      include: {
        assignee: { select: { displayName: true } },
        parts: { orderBy: { sortOrder: "asc" } },
      },
    });

    await this.audit.log({
      action: "repair.task.create",
      userId: user.id,
      garageAccountId,
      entityType: "repair_task",
      entityId: row.id,
      metadata: { repairJobId: jobId },
    });

    if (dto.tyre) {
      const existingTyreTask = await this.prisma.jobTyreUsage.findFirst({
        where: {
          repairJobId: jobId,
          garageAccountId,
          status: JobTyreUsageStatus.CONSUMED,
          repairTaskId: { not: null },
        },
      });
      if (existingTyreTask) {
        throw new BadRequestException(
          "This job already has a tyre task — edit that task or remove it before adding another",
        );
      }
      const sellPriceNet = await this.resolveTyreSellPriceForTask(garageAccountId, dto.tyre);
      await this.tyres.consumeForRepairTask(user, jobId, row.id, {
        tyreId: dto.tyre.tyreId,
        quantity: dto.tyre.quantity,
        sellPriceNet,
      });
    }

    const full = await this.getOne(user, jobId);
    return full;
  }

  async updateTask(user: RequestUser, jobId: string, taskId: string, dto: UpdateRepairTaskDto) {
    const garageAccountId = this.garageId(user);
    const job = await this.prisma.repairJob.findFirst({
      where: { id: jobId, garageAccountId },
      include: { tasks: { select: { assigneeId: true, status: true } } },
    });
    if (!job) throw new NotFoundException("Repair job not found");
    if (job.status === RepairJobStatus.COMPLETED || job.status === RepairJobStatus.CANCELLED) {
      throw new BadRequestException("Cannot edit tasks on a closed job");
    }
    await this.assertJobTasksEditable(garageAccountId, jobId);

    const existing = await this.prisma.repairTask.findFirst({
      where: { id: taskId, repairJobId: jobId },
    });
    if (!existing) throw new NotFoundException("Task not found");

    if (isWorkshopStaffView(user, "repair")) {
      return this.updateTaskAsMechanic(user, job, existing, dto);
    }

    if (dto.tyre) {
      if (!user.enabledModules.includes("tyres")) {
        throw new BadRequestException("Tyres module is not enabled");
      }
      const existingTyres = await this.prisma.jobTyreUsage.count({
        where: { repairTaskId: taskId, status: JobTyreUsageStatus.CONSUMED },
      });
      if (existingTyres > 0) {
        throw new BadRequestException(
          "This task already has tyres fitted — cancel the task to change tyres",
        );
      }
    }

    let assigneeId = existing.assigneeId;
    if (dto.assigneeId !== undefined) {
      if (dto.assigneeId) {
        this.assertJobApprovedForAssignment(job.status);
        await this.validateAssignee(garageAccountId, dto.assigneeId);
      }
      assigneeId = dto.assigneeId;
    }

    let status = dto.status ?? existing.status;
    status = this.taskStatusForAssignee(assigneeId, status);

    const hasTyre = Boolean(dto.tyre);
    const useBreakdown = hasTyre ? false : (dto.useBreakdown ?? existing.useBreakdown);
    const pricingTouched =
      hasTyre ||
      dto.amountNet !== undefined ||
      dto.useBreakdown !== undefined ||
      dto.labourHours !== undefined ||
      dto.labourRateNet !== undefined ||
      dto.parts !== undefined;

    let amountNet = existing.amountNet;
    if (pricingTouched) {
      const existingParts =
        dto.parts !== undefined
          ? dto.parts
          : (
              await this.prisma.repairTaskPart.findMany({
                where: { repairTaskId: taskId },
                orderBy: { sortOrder: "asc" },
              })
            ).map((p) => ({
              description: p.description,
              quantity: Number(p.quantity),
              unitPriceNet: Number(p.unitPriceNet),
            }));

      const parts = useBreakdown
        ? (dto.parts ?? existingParts).filter((p) => p.description?.trim())
        : [];

      if (useBreakdown && parts.length === 0) {
        const labourRate =
          dto.labourRateNet !== undefined ? dto.labourRateNet : Number(existing.labourRateNet);
        if (!(labourRate > 0)) {
          throw new BadRequestException("Add labour or at least one part when using breakdown");
        }
      }

      amountNet = hasTyre
        ? roundMoney(0)
        : this.computeTaskAmountNet({
            useBreakdown,
            amountNet: dto.amountNet ?? Number(existing.amountNet),
            labourHours:
              dto.labourHours !== undefined ? dto.labourHours : Number(existing.labourHours),
            labourRateNet:
              dto.labourRateNet !== undefined
                ? dto.labourRateNet
                : Number(existing.labourRateNet),
            parts,
          });
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.repairTask.update({
        where: { id: taskId },
        data: {
          ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
          ...(dto.description !== undefined ? { description: dto.description?.trim() || null } : {}),
          ...(dto.status !== undefined || dto.assigneeId !== undefined ? { status } : {}),
          ...(dto.assigneeId !== undefined ? { assigneeId } : {}),
          ...(pricingTouched ? { amountNet, useBreakdown } : {}),
          ...(dto.labourHours !== undefined ? { labourHours: roundMoney(dto.labourHours) } : {}),
          ...(dto.labourRateNet !== undefined ? { labourRateNet: roundMoney(dto.labourRateNet) } : {}),
        },
      });

      if (dto.parts !== undefined || dto.useBreakdown !== undefined) {
        await tx.repairTaskPart.deleteMany({ where: { repairTaskId: taskId } });
        const parts = useBreakdown ? (dto.parts ?? []).filter((p) => p.description?.trim()) : [];
        if (parts.length) {
          await tx.repairTaskPart.createMany({
            data: this.partCreateData(parts).map((part) => ({
              ...part,
              repairTaskId: taskId,
            })),
          });
        }
      }

      await this.syncJobStatusAfterTasks(jobId, tx);
    });

    if (status === RepairTaskStatus.CANCELLED && existing.status !== RepairTaskStatus.CANCELLED) {
      if (user.enabledModules.includes("parts")) {
        await this.parts.returnUsagesForTask(user, jobId, taskId);
      }
      if (user.enabledModules.includes("tyres")) {
        await this.tyres.returnUsagesForTask(user, jobId, taskId);
      }
    }

    if (dto.tyre) {
      const sellPriceNet = await this.resolveTyreSellPriceForTask(garageAccountId, dto.tyre);
      await this.tyres.consumeForRepairTask(user, jobId, taskId, {
        tyreId: dto.tyre.tyreId,
        quantity: dto.tyre.quantity,
        sellPriceNet,
      });
    }

    await this.audit.log({
      action: "repair.task.update",
      userId: user.id,
      garageAccountId,
      entityType: "repair_task",
      entityId: taskId,
      metadata: { repairJobId: jobId, ...(dto.tyre ? { tyreAdded: true } : {}) },
    });

    return this.getOne(user, jobId);
  }

  private async updateTaskAsMechanic(
    user: RequestUser,
    job: {
      id: string;
      status: RepairJobStatus;
      tasks: { assigneeId: string | null; status: RepairTaskStatus }[];
    },
    existing: { id: string; assigneeId: string | null; status: RepairTaskStatus },
    dto: UpdateRepairTaskDto,
  ) {
    const garageAccountId = this.garageId(user);
    this.assertWorkshopJobAccess(job, user.id);

    const restrictedFields: (keyof UpdateRepairTaskDto)[] = [
      "title",
      "description",
      "amountNet",
      "useBreakdown",
      "labourHours",
      "labourRateNet",
      "parts",
      "tyre",
    ];
    if (restrictedFields.some((field) => dto[field] !== undefined)) {
      throw new ForbiddenException("Mechanics cannot edit task pricing or descriptions");
    }

    if (existing.assigneeId && existing.assigneeId !== user.id) {
      throw new ForbiddenException("This task is assigned to another mechanic");
    }

    if (!existing.assigneeId) {
      if (dto.assigneeId !== undefined && dto.assigneeId !== user.id) {
        throw new ForbiddenException("You can only assign tasks to yourself");
      }
      if (dto.status !== undefined) {
        throw new BadRequestException("Claim the task before updating its status");
      }
      if (dto.assigneeId === user.id) {
        return this.claimTask(user, job.id, existing.id);
      }
      throw new BadRequestException("No changes to apply");
    }

    if (dto.assigneeId !== undefined && dto.assigneeId !== user.id) {
      throw new ForbiddenException("You cannot reassign this task");
    }

    if (dto.status === undefined) {
      throw new BadRequestException("No changes to apply");
    }

    if (dto.status === existing.status) {
      return this.getOne(user, job.id);
    }
    if (!canTransitionRepairTaskMechanic(existing.status, dto.status)) {
      throw new BadRequestException(
        `Cannot move task from ${existing.status} to ${dto.status}`,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.repairTask.update({
        where: { id: existing.id },
        data: { status: dto.status },
      });
      await this.syncJobStatusAfterTasks(job.id, tx);
    });

    await this.audit.log({
      action: "repair.task.update",
      userId: user.id,
      garageAccountId,
      entityType: "repair_task",
      entityId: existing.id,
      metadata: { repairJobId: job.id, mechanic: true, status: dto.status },
    });

    return this.getOne(user, job.id);
  }

  async claimTask(user: RequestUser, jobId: string, taskId: string) {
    const garageAccountId = this.garageId(user);
    assertWorkshopStaffActor(user, "repair");

    const job = await this.prisma.repairJob.findFirst({
      where: { id: jobId, garageAccountId },
      include: { tasks: { select: { assigneeId: true, status: true } } },
    });
    if (!job) throw new NotFoundException("Repair job not found");
    this.assertJobApprovedForAssignment(job.status);
    if (!REPAIR_CLAIMABLE_JOB_STATUSES.includes(job.status)) {
      throw new BadRequestException("This job is not open for mechanics to claim work");
    }
    await this.assertJobTasksEditable(garageAccountId, jobId);

    const task = await this.prisma.repairTask.findFirst({
      where: { id: taskId, repairJobId: jobId },
    });
    if (!task) throw new NotFoundException("Task not found");
    if (task.assigneeId) {
      throw new BadRequestException("This task is already assigned");
    }
    if (task.status !== RepairTaskStatus.AVAILABLE) {
      throw new BadRequestException("This task cannot be claimed");
    }

    await this.validateAssignee(garageAccountId, user.id);

    await this.prisma.$transaction(async (tx) => {
      await tx.repairTask.update({
        where: { id: taskId },
        data: {
          assigneeId: user.id,
          status: RepairTaskStatus.ASSIGNED,
        },
      });

      if (job.status === RepairJobStatus.APPROVED) {
        await tx.repairJob.update({
          where: { id: jobId },
          data: { status: RepairJobStatus.IN_PROGRESS },
        });
      }
    });

    await this.audit.log({
      action: "repair.task.claim",
      userId: user.id,
      garageAccountId,
      entityType: "repair_task",
      entityId: taskId,
      metadata: { repairJobId: jobId },
    });

    return this.getOne(user, jobId);
  }

  async deleteTask(user: RequestUser, jobId: string, taskId: string) {
    const garageAccountId = this.garageId(user);
    const job = await this.prisma.repairJob.findFirst({
      where: { id: jobId, garageAccountId },
    });
    if (!job) throw new NotFoundException("Repair job not found");
    if (job.status === RepairJobStatus.COMPLETED || job.status === RepairJobStatus.CANCELLED) {
      throw new BadRequestException("Cannot delete tasks on a closed job");
    }
    await this.assertJobTasksEditable(garageAccountId, jobId);

    const existing = await this.prisma.repairTask.findFirst({
      where: { id: taskId, repairJobId: jobId },
    });
    if (!existing) throw new NotFoundException("Task not found");

    if (user.enabledModules.includes("parts")) {
      await this.parts.returnUsagesForTask(user, jobId, taskId);
    }
    if (user.enabledModules.includes("tyres")) {
      await this.tyres.returnUsagesForTask(user, jobId, taskId);
    }

    await this.prisma.repairTask.delete({ where: { id: taskId } });

    await this.audit.log({
      action: "repair.task.delete",
      userId: user.id,
      garageAccountId,
      entityType: "repair_task",
      entityId: taskId,
      metadata: { repairJobId: jobId },
    });

    await this.syncJobStatusAfterTasks(jobId);
    return this.getOne(user, jobId);
  }

  async generateInvoice(user: RequestUser, jobId: string) {
    const garageAccountId = this.garageId(user);
    if (!user.enabledModules.includes("invoices")) {
      throw new ForbiddenException("Invoices module is not enabled");
    }

    const job = await this.prisma.repairJob.findFirst({
      where: { id: jobId, garageAccountId },
      include: {
        customer: { include: { accountTerms: true } },
        tasks: { orderBy: { sortOrder: "asc" }, include: { parts: { orderBy: { sortOrder: "asc" } } } },
        partUsages: {
          where: { status: JobPartUsageStatus.CONSUMED },
          include: { part: { select: { partNumber: true, description: true } } },
        },
        tyreUsages: {
          where: { status: JobTyreUsageStatus.CONSUMED },
          include: {
            tyre: {
              select: { skuCode: true, brand: true, model: true, size: true, loadIndex: true, speedRating: true },
            },
          },
        },
        invoice: true,
      },
    });
    if (!job) throw new NotFoundException("Repair job not found");
    if (job.invoice) throw new BadRequestException("This job already has an invoice");
    if (
      job.status !== RepairJobStatus.APPROVED &&
      job.status !== RepairJobStatus.IN_PROGRESS &&
      job.status !== RepairJobStatus.TESTING &&
      job.status !== RepairJobStatus.READY &&
      job.status !== RepairJobStatus.COMPLETED
    ) {
      throw new BadRequestException("Job must be approved before invoicing");
    }
    if (job.tasks.length === 0) {
      throw new BadRequestException("Add at least one task before invoicing");
    }

    const canChargeVat = await this.garageCanChargeVat(garageAccountId);
    const computed = computeJobInvoiceTotals(
      { vatEnabled: job.vatEnabled, vatRatePercent: job.vatRatePercent },
      job.tasks,
      canChargeVat,
      job.partUsages,
      job.tyreUsages,
    );
    if (!computed) {
      throw new BadRequestException("Tasks need labour rate or parts pricing before invoicing");
    }

    const lineCalcs = computed.lineCalcs;
    const totals = sumLines(lineCalcs);
    const invoiceNumber = await this.nextInvoiceNumber(garageAccountId);
    const issueDate = new Date();
    const terms = job.customer.accountTerms?.paymentTermsDays ?? 30;
    const dueDate = new Date(issueDate.getTime() + terms * 24 * 60 * 60 * 1000);

    const invoice = await this.prisma.$transaction(async (tx) => {
      const inv = await tx.invoice.create({
        data: {
          garageAccountId,
          customerId: job.customerId,
          repairJobId: job.id,
          invoiceNumber,
          status: InvoiceStatus.SENT,
          issueDate,
          dueDate,
          amountNet: totals.amountNet,
          vatAmount: totals.vatAmount,
          amountGross: totals.amountGross,
          vehicleRegistration: job.vehicleRegistration,
          notes: `Repair job ${job.jobNumber}`,
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
      return inv;
    });

    await this.audit.log({
      action: "repair.job.invoice",
      userId: user.id,
      garageAccountId,
      entityType: "repair_job",
      entityId: job.id,
      metadata: { invoiceId: invoice.id, invoiceNumber },
    });

    return {
      job: await this.getOne(user, jobId),
      invoice: toInvoiceDto(invoice),
    };
  }

  async refreshInvoice(user: RequestUser, jobId: string) {
    const garageAccountId = this.garageId(user);
    if (!user.enabledModules.includes("invoices")) {
      throw new ForbiddenException("Invoices module is not enabled");
    }

    const job = await this.prisma.repairJob.findFirst({
      where: { id: jobId, garageAccountId },
      include: {
        tasks: { orderBy: { sortOrder: "asc" }, include: { parts: { orderBy: { sortOrder: "asc" } } } },
        partUsages: {
          where: { status: JobPartUsageStatus.CONSUMED },
          include: { part: { select: { partNumber: true, description: true } } },
        },
        tyreUsages: {
          where: { status: JobTyreUsageStatus.CONSUMED },
          include: {
            tyre: {
              select: { skuCode: true, brand: true, model: true, size: true, loadIndex: true, speedRating: true },
            },
          },
        },
        invoice: { include: { allocations: true } },
      },
    });
    if (!job) throw new NotFoundException("Repair job not found");
    if (!job.invoice) throw new BadRequestException("This job has no invoice to update");
    if (
      job.invoice.status !== InvoiceStatus.SENT &&
      job.invoice.status !== InvoiceStatus.PART_PAID
    ) {
      throw new BadRequestException("Only unpaid invoices can be updated from the job");
    }

    const canChargeVat = await this.garageCanChargeVat(garageAccountId);
    const computed = computeJobInvoiceTotals(
      job,
      job.tasks,
      canChargeVat,
      job.partUsages,
      job.tyreUsages,
    );
    if (!computed) {
      throw new BadRequestException("Tasks need labour rate or parts pricing before updating the invoice");
    }

    const paid = allocatedTotal(job.invoice.allocations);
    const newGross = Number(computed.amountGross);
    if (newGross < paid - 0.009) {
      throw new BadRequestException(
        "Updated invoice total cannot be less than payments already recorded",
      );
    }

    const totals = sumLines(computed.lineCalcs);
    const invoiceId = job.invoice.id;

    await this.prisma.$transaction(async (tx) => {
      await tx.invoiceLine.deleteMany({ where: { invoiceId } });
      await tx.invoiceLine.createMany({
        data: lineCreateData(computed.lineCalcs).map((line) => ({
          ...line,
          invoiceId,
        })),
      });
      await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          amountNet: totals.amountNet,
          vatAmount: totals.vatAmount,
          amountGross: totals.amountGross,
        },
      });

      const updated = await tx.invoice.findUniqueOrThrow({
        where: { id: invoiceId },
        include: { allocations: true },
      });
      const gross = Number(updated.amountGross);
      const deposit = Number(updated.depositAmount);
      const amountDue = Math.max(0, gross - deposit);
      let status: InvoiceStatus = InvoiceStatus.SENT;
      if (paid > 0.009 && paid < amountDue - 0.009) status = InvoiceStatus.PART_PAID;
      else if (paid >= amountDue - 0.009) status = InvoiceStatus.PAID;
      await tx.invoice.update({ where: { id: invoiceId }, data: { status } });
    });

    const invoice = await this.prisma.invoice.findFirstOrThrow({
      where: { id: invoiceId },
      include: {
        customer: true,
        lines: { orderBy: { sortOrder: "asc" } },
        allocations: true,
      },
    });

    await this.audit.log({
      action: "repair.job.invoice.refresh",
      userId: user.id,
      garageAccountId,
      entityType: "repair_job",
      entityId: job.id,
      metadata: {
        invoiceId,
        invoiceNumber: invoice.invoiceNumber,
        amountGross: invoice.amountGross.toString(),
      },
    });

    return {
      job: await this.getOne(user, jobId),
      invoice: toInvoiceDto(invoice),
    };
  }
}
