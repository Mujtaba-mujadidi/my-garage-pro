import type { InvoiceStatus } from "./invoice-types";
import type { JobPartUsageDto } from "./part-types";
import type { JobTyreUsageDto } from "./tyre-types";

export type RepairJobStatus =
  | "NEW"
  | "QUOTE_SENT"
  | "APPROVED"
  | "AWAITING_VEHICLE"
  | "AWAITING_PARTS"
  | "ON_HOLD"
  | "IN_PROGRESS"
  | "TESTING"
  | "READY"
  | "COMPLETED"
  | "CANCELLED";

export type RepairJobSource = "CUSTOMER" | "INTERNAL" | "RENTAL" | "WARRANTY";

export type RepairTaskStatus =
  | "AVAILABLE"
  | "ASSIGNED"
  | "STARTED"
  | "AWAITING_VEHICLE"
  | "AWAITING_PARTS"
  | "IN_PROGRESS"
  | "ON_HOLD"
  | "TESTING"
  | "COMPLETED"
  | "CANCELLED";

export const REPAIR_JOB_STATUS_LABEL: Record<RepairJobStatus, string> = {
  NEW: "New",
  QUOTE_SENT: "Quote sent",
  APPROVED: "Approved",
  AWAITING_VEHICLE: "Waiting for car",
  AWAITING_PARTS: "Waiting for parts",
  ON_HOLD: "On hold",
  IN_PROGRESS: "In progress",
  TESTING: "Awaiting QC",
  READY: "Ready for collection",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export const REPAIR_JOB_SOURCE_LABEL: Record<RepairJobSource, string> = {
  CUSTOMER: "Customer",
  INTERNAL: "Internal",
  RENTAL: "Rental vehicle",
  WARRANTY: "Warranty",
};

export const REPAIR_TASK_STATUS_LABEL: Record<RepairTaskStatus, string> = {
  AVAILABLE: "Available",
  ASSIGNED: "Assigned",
  STARTED: "Started",
  AWAITING_VEHICLE: "Waiting for car",
  AWAITING_PARTS: "Waiting for parts",
  IN_PROGRESS: "In progress",
  ON_HOLD: "On hold",
  TESTING: "Testing",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

/** Manager / full workflow transitions. */
export const REPAIR_JOB_TRANSITIONS: Record<RepairJobStatus, RepairJobStatus[]> = {
  NEW: ["QUOTE_SENT", "APPROVED", "CANCELLED"],
  QUOTE_SENT: ["APPROVED", "CANCELLED"],
  APPROVED: ["AWAITING_VEHICLE", "AWAITING_PARTS", "IN_PROGRESS", "CANCELLED"],
  AWAITING_VEHICLE: ["IN_PROGRESS", "ON_HOLD", "CANCELLED"],
  AWAITING_PARTS: ["IN_PROGRESS", "ON_HOLD", "CANCELLED"],
  ON_HOLD: ["IN_PROGRESS", "AWAITING_VEHICLE", "AWAITING_PARTS", "CANCELLED"],
  IN_PROGRESS: ["AWAITING_VEHICLE", "AWAITING_PARTS", "ON_HOLD", "TESTING", "READY", "CANCELLED"],
  TESTING: ["READY", "COMPLETED", "IN_PROGRESS", "CANCELLED"],
  READY: ["COMPLETED", "IN_PROGRESS", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

/** Mechanic job status transitions (workshop floor). */
export const REPAIR_MECHANIC_JOB_TRANSITIONS: Record<RepairJobStatus, RepairJobStatus[]> = {
  NEW: [],
  QUOTE_SENT: [],
  APPROVED: ["IN_PROGRESS", "AWAITING_VEHICLE"],
  AWAITING_VEHICLE: ["IN_PROGRESS"],
  AWAITING_PARTS: ["IN_PROGRESS", "READY"],
  ON_HOLD: ["IN_PROGRESS"],
  IN_PROGRESS: ["TESTING", "READY", "AWAITING_VEHICLE", "AWAITING_PARTS", "ON_HOLD"],
  TESTING: ["READY", "COMPLETED", "IN_PROGRESS"],
  READY: [],
  COMPLETED: [],
  CANCELLED: [],
};

/** Mechanic task status transitions on tasks assigned to them. */
export const REPAIR_MECHANIC_TASK_TRANSITIONS: Record<RepairTaskStatus, RepairTaskStatus[]> = {
  AVAILABLE: [],
  ASSIGNED: ["STARTED", "AWAITING_VEHICLE", "AWAITING_PARTS", "IN_PROGRESS", "ON_HOLD", "TESTING", "COMPLETED"],
  STARTED: ["AWAITING_VEHICLE", "AWAITING_PARTS", "IN_PROGRESS", "ON_HOLD", "TESTING", "COMPLETED"],
  AWAITING_VEHICLE: ["STARTED", "ASSIGNED", "IN_PROGRESS"],
  AWAITING_PARTS: ["STARTED", "IN_PROGRESS", "TESTING", "COMPLETED"],
  IN_PROGRESS: ["AWAITING_VEHICLE", "AWAITING_PARTS", "ON_HOLD", "TESTING", "COMPLETED"],
  ON_HOLD: ["STARTED", "ASSIGNED", "IN_PROGRESS"],
  TESTING: ["IN_PROGRESS", "COMPLETED"],
  COMPLETED: [],
  CANCELLED: [],
};

/** Job statuses where unassigned tasks can be claimed by a mechanic. */
export const REPAIR_CLAIMABLE_JOB_STATUSES: RepairJobStatus[] = ["APPROVED", "IN_PROGRESS"];

/** Active workshop statuses shown in mechanic job filters. */
export const REPAIR_MECHANIC_LIST_STATUSES: RepairJobStatus[] = [
  "APPROVED",
  "AWAITING_VEHICLE",
  "AWAITING_PARTS",
  "IN_PROGRESS",
  "ON_HOLD",
  "TESTING",
  "READY",
];

/** Fixed job statuses mechanics can pick (dropdown always shows all of these). */
export const REPAIR_MECHANIC_JOB_STATUS_OPTIONS: RepairJobStatus[] = [
  "AWAITING_VEHICLE",
  "IN_PROGRESS",
  "AWAITING_PARTS",
  "ON_HOLD",
  "TESTING",
  "COMPLETED",
];

/** Fixed task statuses mechanics can pick (dropdown always shows all of these). */
export const REPAIR_MECHANIC_TASK_STATUS_OPTIONS: RepairTaskStatus[] = [
  "AWAITING_VEHICLE",
  "STARTED",
  "AWAITING_PARTS",
  "IN_PROGRESS",
  "ON_HOLD",
  "TESTING",
  "COMPLETED",
];

export function canTransitionRepairJob(from: RepairJobStatus, to: RepairJobStatus) {
  return REPAIR_JOB_TRANSITIONS[from].includes(to);
}

export function canTransitionRepairJobMechanic(from: RepairJobStatus, to: RepairJobStatus) {
  return REPAIR_MECHANIC_JOB_TRANSITIONS[from].includes(to);
}

export function canTransitionRepairTaskMechanic(from: RepairTaskStatus, to: RepairTaskStatus) {
  return REPAIR_MECHANIC_TASK_TRANSITIONS[from].includes(to);
}

export function isMechanicJobStatusAllowed(status: RepairJobStatus) {
  return REPAIR_MECHANIC_JOB_STATUS_OPTIONS.includes(status);
}

export function isMechanicTaskStatusAllowed(status: RepairTaskStatus) {
  return REPAIR_MECHANIC_TASK_STATUS_OPTIONS.includes(status);
}

/** Dropdown options: fixed list, plus current value if it falls outside the workshop set. */
export function mechanicJobStatusOptions(current: RepairJobStatus): RepairJobStatus[] {
  if (REPAIR_MECHANIC_JOB_STATUS_OPTIONS.includes(current)) {
    return REPAIR_MECHANIC_JOB_STATUS_OPTIONS;
  }
  return [current, ...REPAIR_MECHANIC_JOB_STATUS_OPTIONS];
}

export function mechanicTaskStatusOptions(current: RepairTaskStatus): RepairTaskStatus[] {
  if (REPAIR_MECHANIC_TASK_STATUS_OPTIONS.includes(current)) {
    return REPAIR_MECHANIC_TASK_STATUS_OPTIONS;
  }
  return [current, ...REPAIR_MECHANIC_TASK_STATUS_OPTIONS];
}

/** Intake statuses before workshop work may begin. */
export const REPAIR_JOB_INTAKE_STATUSES: RepairJobStatus[] = ["NEW", "QUOTE_SENT"];

/** Simplified QC outcome labels for the manager status dropdown. */
export const REPAIR_QC_OUTCOME_LABEL: Partial<Record<RepairJobStatus, string>> = {
  READY: "Ready for collection",
  COMPLETED: "Complete",
  IN_PROGRESS: "Not complete",
};

export function isRepairJobApprovedForWork(status: RepairJobStatus) {
  return !REPAIR_JOB_INTAKE_STATUSES.includes(status);
}

/** Manager job status dropdown: current status plus allowed next steps. */
export function managerJobStatusOptions(current: RepairJobStatus): RepairJobStatus[] {
  const next = REPAIR_JOB_TRANSITIONS[current];
  if (next.length === 0) return [current];
  return [current, ...next.filter((s) => s !== current)];
}

/** QC phase dropdown: ready for collection, complete, or not complete. */
export function managerQcJobStatusOptions(current: RepairJobStatus): RepairJobStatus[] {
  if (current === "TESTING") {
    return [current, "READY", "COMPLETED", "IN_PROGRESS"];
  }
  if (current === "READY") {
    return [current, "COMPLETED", "IN_PROGRESS"];
  }
  return managerJobStatusOptions(current);
}

export function managerJobStatusLabel(
  status: RepairJobStatus,
  currentJobStatus: RepairJobStatus,
): string {
  if (
    (currentJobStatus === "TESTING" || currentJobStatus === "READY") &&
    REPAIR_QC_OUTCOME_LABEL[status]
  ) {
    return REPAIR_QC_OUTCOME_LABEL[status]!;
  }
  return REPAIR_JOB_STATUS_LABEL[status];
}

export function allRepairTasksComplete(tasks: { status: RepairTaskStatus }[]) {
  if (tasks.length === 0) return false;
  return tasks.every(
    (t) => t.status === "COMPLETED" || t.status === "CANCELLED",
  );
}

export type RepairTaskPartDto = {
  id: string;
  description: string;
  quantity: string;
  unitPriceNet: string;
  sortOrder: number;
};

export type RepairTaskDto = {
  id: string;
  title: string;
  description: string | null;
  status: RepairTaskStatus;
  assigneeId: string | null;
  assigneeName: string | null;
  /** Task total (ex VAT). When useBreakdown is true, equals labour + parts. */
  amountNet: string;
  useBreakdown: boolean;
  labourHours: string;
  labourRateNet: string;
  parts: RepairTaskPartDto[];
  sortOrder: number;
  /** True when task is unassigned and the job can be claimed. */
  claimable?: boolean;
};

export function repairTaskBreakdownNet(
  task: Pick<RepairTaskDto, "labourHours" | "labourRateNet" | "parts">,
): number {
  const labour = Number(task.labourHours) * Number(task.labourRateNet);
  const parts = task.parts.reduce(
    (sum, part) => sum + Number(part.quantity) * Number(part.unitPriceNet),
    0,
  );
  return Math.round((labour + parts) * 100) / 100;
}

export function repairTaskAmountNet(task: RepairTaskDto): number {
  if (task.useBreakdown) return repairTaskBreakdownNet(task);
  return Number(task.amountNet) || 0;
}

export type RepairJobListDto = {
  id: string;
  jobNumber: string;
  status: RepairJobStatus;
  source: RepairJobSource;
  customerId: string;
  customerName: string;
  vehicleRegistration: string | null;
  vehicleLabel: string | null;
  customerConcern: string | null;
  taskCount: number;
  completedTaskCount: number;
  invoiceId: string | null;
  invoiceNumber: string | null;
  invoiceAmountNet: string | null;
  invoiceAmountGross: string | null;
  invoiceStatus: InvoiceStatus | null;
  invoiceBalanceDue: string | null;
  /** Current task pricing (ex VAT) when an invoice exists; null otherwise. */
  tasksAmountNet: string | null;
  /** Current task pricing (inc VAT) when an invoice exists; null otherwise. */
  tasksAmountGross: string | null;
  /**
   * `false` when unpaid invoice totals differ from current tasks.
   * `null` when there is no invoice or invoice is paid/cancelled.
   */
  invoiceInSync: boolean | null;
  createdAt: string;
  updatedAt: string;
  /** Mechanic list: jobs with tasks assigned to the current user. */
  myTaskCount?: number;
  /** Mechanic list: unassigned tasks on approved / in-progress jobs. */
  availableTaskCount?: number;
};

export type RepairJobDto = RepairJobListDto & {
  vehicleMake: string | null;
  vehicleModel: string | null;
  notes: string | null;
  vatEnabled: boolean;
  vatRatePercent: string;
  tasks: RepairTaskDto[];
  /** Stock parts consumed on this job (manager view). */
  stockParts?: JobPartUsageDto[];
  stockTyres?: JobTyreUsageDto[];
  /** `work` hides pricing and scopes tasks for mechanics. */
  viewMode?: "full" | "work";
};

export type RepairAssigneeDto = {
  id: string;
  displayName: string;
  role: string;
};
