import type {
  Customer,
  Invoice,
  JobPartUsage,
  JobTyreUsage,
  PaymentAllocation,
  Part,
  Tyre,
  RepairJob,
  RepairTask,
  RepairTaskPart,
  User,
} from "@prisma/client";
import {
  invoiceBalanceDue,
  REPAIR_CLAIMABLE_JOB_STATUSES,
  type InvoiceStatus,
  type RepairJobDto,
  type RepairJobListDto,
  type RepairJobStatus,
  type RepairTaskDto,
  type RepairTaskPartDto,
} from "@mygaragepro/shared";
import { customerDisplayName } from "../invoices/invoices.mapper";
import { toJobPartUsageDto } from "../parts/job-parts.mapper";
import { toJobTyreUsageDto } from "../tyres/job-tyres.mapper";

function decimalToString(d: { toString(): string }) {
  return d.toString();
}

type TaskRow = RepairTask & {
  assignee: Pick<User, "displayName"> | null;
  parts: RepairTaskPart[];
};
type JobInvoiceRow = Pick<
  Invoice,
  "id" | "invoiceNumber" | "amountNet" | "amountGross" | "status" | "depositAmount"
> & {
  allocations: Pick<PaymentAllocation, "amount">[];
};

type UsageRow = JobPartUsage & {
  part: Pick<Part, "partNumber" | "description">;
  repairTask?: Pick<RepairTask, "title"> | null;
};

type TyreUsageRow = JobTyreUsage & {
  tyre: Pick<Tyre, "skuCode" | "brand" | "model" | "size" | "loadIndex" | "speedRating">;
  repairTask?: Pick<RepairTask, "title"> | null;
};

type JobRow = RepairJob & {
  customer: Customer;
  tasks: TaskRow[];
  invoice: JobInvoiceRow | null;
  partUsages?: UsageRow[];
  tyreUsages?: TyreUsageRow[];
};

export type RepairMapOptions = {
  viewMode?: "full" | "work";
  userId?: string;
};

function vehicleLabel(job: RepairJob) {
  const parts = [job.vehicleRegistration, job.vehicleMake, job.vehicleModel].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : null;
}

function isTaskClaimable(task: TaskRow, jobStatus: RepairJobStatus) {
  return (
    !task.assigneeId &&
    task.status === "AVAILABLE" &&
    REPAIR_CLAIMABLE_JOB_STATUSES.includes(jobStatus)
  );
}

/** Workshop view shows every task on the job so mechanics see full context. */
function filterTasksForView(tasks: TaskRow[], _jobStatus: RepairJobStatus, _opts: RepairMapOptions) {
  return tasks;
}

function toRepairTaskPartDto(part: RepairTaskPart, hidePricing: boolean): RepairTaskPartDto {
  return {
    id: part.id,
    description: part.description,
    quantity: hidePricing ? "0" : decimalToString(part.quantity),
    unitPriceNet: hidePricing ? "0" : decimalToString(part.unitPriceNet),
    sortOrder: part.sortOrder,
  };
}

export function toRepairTaskDto(
  row: TaskRow,
  jobStatus: RepairJobStatus,
  opts: RepairMapOptions = {},
): RepairTaskDto {
  const hidePricing = opts.viewMode === "work";
  const claimable =
    opts.viewMode === "work" && opts.userId
      ? isTaskClaimable(row, jobStatus)
      : undefined;

  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    assigneeId: row.assigneeId,
    assigneeName: row.assignee?.displayName ?? null,
    amountNet: hidePricing ? "0" : decimalToString(row.amountNet),
    useBreakdown: row.useBreakdown,
    labourHours: decimalToString(row.labourHours),
    labourRateNet: hidePricing ? "0" : decimalToString(row.labourRateNet),
    parts: row.parts.map((part) => toRepairTaskPartDto(part, hidePricing)),
    sortOrder: row.sortOrder,
    ...(claimable ? { claimable: true } : {}),
  };
}

export function toRepairJobListDto(row: JobRow, opts: RepairMapOptions = {}): RepairJobListDto {
  const dto: RepairJobListDto = {
    id: row.id,
    jobNumber: row.jobNumber,
    status: row.status,
    source: row.source,
    customerId: row.customerId,
    customerName: customerDisplayName(row.customer),
    vehicleRegistration: row.vehicleRegistration,
    vehicleLabel: vehicleLabel(row),
    customerConcern: row.customerConcern,
    taskCount: row.tasks.length,
    completedTaskCount: row.tasks.filter((t) => t.status === "COMPLETED").length,
    invoiceId: row.invoice?.id ?? null,
    invoiceNumber: row.invoice?.invoiceNumber ?? null,
    invoiceAmountNet: row.invoice ? decimalToString(row.invoice.amountNet) : null,
    invoiceAmountGross: row.invoice ? decimalToString(row.invoice.amountGross) : null,
    invoiceStatus: row.invoice ? (row.invoice.status as InvoiceStatus) : null,
    invoiceBalanceDue: row.invoice
      ? invoiceBalanceDue(
          Number(row.invoice.amountGross),
          Number(row.invoice.depositAmount),
          row.invoice.allocations.reduce((sum, a) => sum + Number(a.amount), 0),
        ).toFixed(2)
      : null,
    tasksAmountNet: null,
    tasksAmountGross: null,
    invoiceInSync: null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };

  if (opts.viewMode === "work" && opts.userId) {
    dto.myTaskCount = row.tasks.filter((t) => t.assigneeId === opts.userId).length;
    dto.availableTaskCount = row.tasks.filter((t) => isTaskClaimable(t, row.status)).length;
  }

  return dto;
}

export function toRepairJobDto(row: JobRow, opts: RepairMapOptions = {}): RepairJobDto {
  const tasks = filterTasksForView(row.tasks, row.status, opts);
  const hidePricing = opts.viewMode === "work";

  return {
    ...toRepairJobListDto(row, opts),
    vehicleMake: row.vehicleMake,
    vehicleModel: row.vehicleModel,
    notes: hidePricing ? null : row.notes,
    vatEnabled: hidePricing ? true : row.vatEnabled,
    vatRatePercent: hidePricing ? "0" : decimalToString(row.vatRatePercent),
    tasks: tasks.map((t) => toRepairTaskDto(t, row.status, opts)),
    stockParts:
      opts.viewMode === "work" || !row.partUsages?.length
        ? undefined
        : row.partUsages.map(toJobPartUsageDto),
    stockTyres:
      opts.viewMode === "work" || !row.tyreUsages?.length
        ? undefined
        : row.tyreUsages.map(toJobTyreUsageDto),
    ...(opts.viewMode === "work" ? { viewMode: "work" as const } : {}),
  };
}
