import type {
  Customer,
  Invoice,
  PaymentAllocation,
  BodyworkJob,
  BodyworkTask,
  BodyworkTaskPart,
  User,
} from "@prisma/client";
import {
  invoiceBalanceDue,
  BODYWORK_CLAIMABLE_JOB_STATUSES,
  type InvoiceStatus,
  type BodyworkJobDto,
  type BodyworkJobListDto,
  type BodyworkJobStatus,
  type BodyworkTaskDto,
  type BodyworkTaskPartDto,
} from "@mygaragepro/shared";
import { customerDisplayName } from "../invoices/invoices.mapper";

function decimalToString(d: { toString(): string }) {
  return d.toString();
}

type TaskRow = BodyworkTask & {
  assignee: Pick<User, "displayName"> | null;
  parts: BodyworkTaskPart[];
};
type JobInvoiceRow = Pick<
  Invoice,
  "id" | "invoiceNumber" | "amountNet" | "amountGross" | "status" | "depositAmount"
> & {
  allocations: Pick<PaymentAllocation, "amount">[];
};

type JobRow = BodyworkJob & {
  customer: Customer;
  tasks: TaskRow[];
  invoice: JobInvoiceRow | null;
};

export type BodyworkMapOptions = {
  viewMode?: "full" | "work";
  userId?: string;
};

function vehicleLabel(job: BodyworkJob) {
  const parts = [job.vehicleRegistration, job.vehicleMake, job.vehicleModel].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : null;
}

function isTaskClaimable(task: TaskRow, jobStatus: BodyworkJobStatus) {
  return (
    !task.assigneeId &&
    task.status === "AVAILABLE" &&
    BODYWORK_CLAIMABLE_JOB_STATUSES.includes(jobStatus)
  );
}

/** Workshop view shows every task on the job so mechanics see full context. */
function filterTasksForView(tasks: TaskRow[], _jobStatus: BodyworkJobStatus, _opts: BodyworkMapOptions) {
  return tasks;
}

function toBodyworkTaskPartDto(part: BodyworkTaskPart, hidePricing: boolean): BodyworkTaskPartDto {
  return {
    id: part.id,
    description: part.description,
    quantity: hidePricing ? "0" : decimalToString(part.quantity),
    unitPriceNet: hidePricing ? "0" : decimalToString(part.unitPriceNet),
    sortOrder: part.sortOrder,
  };
}

export function toBodyworkTaskDto(
  row: TaskRow,
  jobStatus: BodyworkJobStatus,
  opts: BodyworkMapOptions = {},
): BodyworkTaskDto {
  const hidePricing = opts.viewMode === "work";
  const claimable =
    opts.viewMode === "work" && opts.userId
      ? isTaskClaimable(row, jobStatus)
      : undefined;

  return {
    id: row.id,
    title: row.title,
    description: row.description,
    panel: row.panel,
    status: row.status,
    assigneeId: row.assigneeId,
    assigneeName: row.assignee?.displayName ?? null,
    amountNet: hidePricing ? "0" : decimalToString(row.amountNet),
    useBreakdown: row.useBreakdown,
    labourHours: decimalToString(row.labourHours),
    labourRateNet: hidePricing ? "0" : decimalToString(row.labourRateNet),
    parts: row.parts.map((part) => toBodyworkTaskPartDto(part, hidePricing)),
    sortOrder: row.sortOrder,
    ...(claimable ? { claimable: true } : {}),
  };
}

export function toBodyworkJobListDto(row: JobRow, opts: BodyworkMapOptions = {}): BodyworkJobListDto {
  const dto: BodyworkJobListDto = {
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

export function toBodyworkJobDto(row: JobRow, opts: BodyworkMapOptions = {}): BodyworkJobDto {
  const tasks = filterTasksForView(row.tasks, row.status, opts);
  const hidePricing = opts.viewMode === "work";

  return {
    ...toBodyworkJobListDto(row, opts),
    vehicleMake: row.vehicleMake,
    vehicleModel: row.vehicleModel,
    panelCode: hidePricing ? null : row.panelCode,
    colourCode: hidePricing ? null : row.colourCode,
    paintMaterialCostNet: hidePricing ? "0" : decimalToString(row.paintMaterialCostNet),
    outsourcedCostNet: hidePricing ? "0" : decimalToString(row.outsourcedCostNet),
    notes: hidePricing ? null : row.notes,
    vatEnabled: hidePricing ? true : row.vatEnabled,
    vatRatePercent: hidePricing ? "0" : decimalToString(row.vatRatePercent),
    tasks: tasks.map((t) => toBodyworkTaskDto(t, row.status, opts)),
    ...(opts.viewMode === "work" ? { viewMode: "work" as const } : {}),
  };
}
