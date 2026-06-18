"use client";

import { useSession } from "@/components/providers/session-provider";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { TableRowActionsMenu } from "@/components/ui/table-row-actions-menu";
import { apiFetch, ApiError, downloadAuthenticatedPdf, openAuthenticatedPdf } from "@/lib/api-client";
import {
  StockPurchaseFields,
  emptyStockPurchaseDraft,
  stockPurchaseApiPayload,
  type StockPurchaseDraft,
} from "@/components/finance/stock-purchase-fields";
import { partsCatalogUrl } from "@/lib/parts-catalog-url";
import type {
  InvoiceDto,
  InvoiceStatus,
  JobPartUsageDto,
  JobTyreUsageDto,
  PartDto,
  SupplierDto,
  SupplierRefundType,
  TyreDto,
  PaymentAccountDto,
  PaymentMethod,
  RepairAssigneeDto,
  RepairJobDto,
  RepairJobStatus,
  RepairTaskDto,
  RepairTaskStatus,
  TyreTaskPriceTier,
} from "@mygaragepro/shared";
import {
  allRepairTasksComplete,
  defaultPaymentMethodForAccount,
  filterJobStatusOptionsWithoutTasks,
  isRepairJobApprovedForWork,
  jobStatusRequiresTasks,
  JOB_QUOTE_APPROVE_TASKS_MESSAGE,
  managerJobStatusLabel,
  managerJobStatusOptions,
  managerQcJobStatusOptions,
  mechanicTaskStatusOptions,
  repairTaskAmountNet,
  summarizePartFitments,
  repairTaskBreakdownNet,
  REPAIR_JOB_STATUS_LABEL,
  REPAIR_TASK_STATUS_LABEL,
  isWorkshopStaffView,
  isWorkshopTaskClaimable,
  workshopTaskAssigneeLabel,
  tyreIsLowStock,
} from "@mygaragepro/shared";
import { GateLoading } from "@/components/layout/gate-loading";
import { UkNumberPlate } from "@/components/jobs/uk-number-plate";
import { STICKY_TABLE_HEAD_CLASS, TableScroll } from "@/components/ui/table-scroll";
import { TabBar } from "@/components/ui/tab-bar";
import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

const inputClass =
  "w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm";

const INVOICE_STATUS_LABEL: Record<InvoiceStatus, string> = {
  DRAFT: "Draft",
  SENT: "Sent",
  PART_PAID: "Part paid",
  PAID: "Paid",
  CANCELLED: "Cancelled",
};

const PAYMENT_METHOD_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: "BANK_TRANSFER", label: "Bank transfer" },
  { value: "CARD", label: "Card" },
  { value: "CASH", label: "Cash" },
  { value: "CHEQUE", label: "Cheque" },
  { value: "OTHER", label: "Other" },
];

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

type TaskPartDraft = {
  description: string;
  quantity: string;
  unitPriceNet: string;
};

type TaskDraft = {
  title: string;
  description: string;
  assigneeId: string;
  amountNet: string;
  useBreakdown: boolean;
  labourHours: string;
  labourRateNet: string;
  parts: TaskPartDraft[];
  status: RepairTaskStatus;
  isTyreTask: boolean;
  tyreId: string;
  tyreQty: string;
  tyrePriceTier: TyreTaskPriceTier;
  tyreCustomPrice: string;
};

function emptyTaskPart(): TaskPartDraft {
  return { description: "", quantity: "1", unitPriceNet: "" };
}

type PartsMaterialsTab = "part-stock" | "order";

type TaskModalTab = "general" | "tyre";

type OrderPartBlock = {
  clientId: string;
  description: string;
  supplierId: string;
  supplierRef: string;
  quantity: string;
  taskId: string;
};

let nextOrderPartBlockId = 0;

function newOrderPartBlock(): OrderPartBlock {
  nextOrderPartBlockId += 1;
  return {
    clientId: `order-part-${nextOrderPartBlockId}`,
    description: "",
    supplierId: "",
    supplierRef: "",
    quantity: "1",
    taskId: "",
  };
}

function partUsageStatusLabel(usage: JobPartUsageDto): string {
  if (usage.status === "ORDERED") return "Ordered";
  if (usage.status === "RETURNED") return "Returned";
  return usage.source === "ORDERED" ? "Received" : "On job";
}

function partUsageCostBreakdown(usage: JobPartUsageDto) {
  const net =
    Number(usage.lineCostTotalNet) ||
    Number(usage.quantity) * Number(usage.costPriceNet);
  const vat = Number(usage.costVatAmount) || 0;
  const gross = Number(usage.costAmountGross) || net + vat;
  return { net, vat, gross };
}

type SupplierReturnDraft = {
  refundType: SupplierRefundType;
  supplierId: string;
  paymentAccountId: string;
  refundMethod: PaymentMethod;
  notes: string;
};

function emptySupplierReturnDraft(
  usage: JobPartUsageDto,
  accounts: PaymentAccountDto[],
): SupplierReturnDraft {
  const firstId = accounts[0]?.id ?? "";
  const account = accounts[0];
  return {
    refundType: "CREDIT",
    supplierId: usage.supplierId ?? "",
    paymentAccountId: firstId,
    refundMethod: account ? defaultPaymentMethodForAccount(account.type) : "BANK_TRANSFER",
    notes: "",
  };
}

type StockQtyIssue = { type: "error" | "warning"; message: string };

function stockQuantityIssue(
  requestedQty: number,
  onHand: number,
  itemLabel: string,
  opts?: { lowStockAfterUse?: boolean },
): StockQtyIssue | null {
  if (requestedQty <= 0) {
    return { type: "error", message: "Enter a quantity greater than zero." };
  }
  if (requestedQty > onHand) {
    const shortfall = requestedQty - onHand;
    return {
      type: "error",
      message: `Insufficient stock — you requested ${requestedQty} but only ${onHand} available for ${itemLabel} (${shortfall} short). Reduce the quantity or use Order from supplier.`,
    };
  }
  if (opts?.lowStockAfterUse) {
    return {
      type: "warning",
      message: `Low stock — using ${requestedQty} will leave ${onHand - requestedQty} on hand for ${itemLabel}.`,
    };
  }
  return null;
}

function StockQtyAlert({ issue }: { issue: StockQtyIssue }) {
  const tone =
    issue.type === "error"
      ? "border-red-200 bg-red-50 text-red-900 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200"
      : "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200";
  return (
    <p className={`rounded-lg border px-3 py-2 text-sm ${tone}`} role="alert">
      {issue.message}
    </p>
  );
}

function jobOrderPartNumber(jobNumber: string, block: OrderPartBlock, index: number): string {
  const ref = block.supplierRef.trim();
  if (ref) return ref.toUpperCase().slice(0, 80);
  const slug = block.description
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9-]/g, "")
    .slice(0, 24)
    .toUpperCase();
  return `${jobNumber}-${slug || "ORDER"}-${index + 1}`.slice(0, 80);
}

function emptyTaskDraft(): TaskDraft {
  return {
    title: "",
    description: "",
    assigneeId: "",
    amountNet: "",
    useBreakdown: false,
    labourHours: "1",
    labourRateNet: "",
    parts: [emptyTaskPart()],
    status: "AVAILABLE",
    isTyreTask: false,
    tyreId: "",
    tyreQty: "1",
    tyrePriceTier: "CUSTOMER",
    tyreCustomPrice: "",
  };
}

function taskToDraft(t: RepairTaskDto, stockTyres?: JobTyreUsageDto[]): TaskDraft {
  const linked =
    stockTyres?.filter((u) => u.repairTaskId === t.id && u.status === "CONSUMED") ?? [];
  return {
    title: t.title,
    description: t.description ?? "",
    assigneeId: t.assigneeId ?? "",
    amountNet: t.amountNet,
    useBreakdown: t.useBreakdown,
    labourHours: t.labourHours,
    labourRateNet: t.labourRateNet,
    parts:
      t.parts.length > 0
        ? t.parts.map((p) => ({
            description: p.description,
            quantity: p.quantity,
            unitPriceNet: p.unitPriceNet,
          }))
        : [emptyTaskPart()],
    status: t.status,
    isTyreTask: linked.length > 0,
    tyreId: linked[0]?.tyreId ?? "",
    tyreQty: linked[0]?.quantity ?? "1",
    tyrePriceTier: "CUSTOMER",
    tyreCustomPrice: "",
  };
}

function draftAmountNet(draft: TaskDraft) {
  if (draft.useBreakdown) {
    return repairTaskBreakdownNet({
      labourHours: draft.labourHours,
      labourRateNet: draft.labourRateNet,
      parts: draft.parts.map((p) => ({
        id: "",
        description: p.description,
        quantity: p.quantity,
        unitPriceNet: p.unitPriceNet,
        sortOrder: 0,
      })),
    });
  }
  return Number(draft.amountNet) || 0;
}

function taskAmountSummary(task: RepairTaskDto) {
  if (!task.useBreakdown) return null;
  const labour = Number(task.labourHours) * Number(task.labourRateNet);
  const parts = task.parts.length;
  const bits: string[] = [];
  if (labour > 0) bits.push("labour");
  if (parts > 0) bits.push(`${parts} part${parts === 1 ? "" : "s"}`);
  return bits.length ? bits.join(" + ") : null;
}

function formatGbp(amount: number) {
  return `£${amount.toFixed(2)}`;
}

function jobChargesVat(
  canChargeVat: boolean,
  job: Pick<RepairJobDto, "vatEnabled">,
): boolean {
  return canChargeVat && job.vatEnabled;
}

function grossAmountSuffix(chargesVat: boolean): string {
  return chargesVat ? " inc VAT" : "";
}

function waitingStatusTone(status: string) {
  if (status === "AWAITING_VEHICLE") {
    return "bg-violet-100 text-violet-900 dark:bg-violet-950/50 dark:text-violet-200";
  }
  if (status === "AWAITING_PARTS") {
    return "bg-orange-100 text-orange-900 dark:bg-orange-950/50 dark:text-orange-200";
  }
  if (status === "ON_HOLD") {
    return "bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200";
  }
  return null;
}

function taskStatusChip(status: RepairTaskStatus) {
  const waiting = waitingStatusTone(status);
  const tone =
    waiting ??
    (status === "COMPLETED"
      ? "bg-green-100 text-green-800 dark:bg-green-950/50 dark:text-green-300"
      : status === "CANCELLED"
        ? "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300"
        : status === "STARTED" || status === "IN_PROGRESS"
          ? "bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200"
          : status === "TESTING"
            ? "bg-cyan-100 text-cyan-900 dark:bg-cyan-950/50 dark:text-cyan-200"
            : status === "ASSIGNED"
              ? "bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300"
              : "bg-[var(--background)] text-[var(--foreground)]");
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${tone}`}>
      {REPAIR_TASK_STATUS_LABEL[status]}
    </span>
  );
}

const compactSelectTriggerClass =
  "min-h-0 min-w-[9rem] py-1.5 text-sm font-normal";

const compactSelectClass =
  "w-full min-w-[9rem] rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-sm disabled:opacity-50";

type Props = { jobId: string };

export function RepairJobDetail({ jobId }: Props) {
  const { session, hasPermission } = useSession();
  const canWrite = hasPermission("repair.write");
  const canChargeVat = Boolean(session?.garage?.vatNumber?.trim());
  const canInvoice = hasPermission("invoices.write");
  const partsModuleEnabled = session?.enabledModules.includes("parts") ?? false;
  const canPartsWrite = partsModuleEnabled && hasPermission("parts.write");
  const tyresModuleEnabled = session?.enabledModules.includes("tyres") ?? false;
  const canTyresWrite = tyresModuleEnabled && hasPermission("tyres.write");
  const userId = session?.user.id;

  const [job, setJob] = useState<RepairJobDto | null>(null);
  const [assignees, setAssignees] = useState<RepairAssigneeDto[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [taskModal, setTaskModal] = useState(false);
  const [taskModalTab, setTaskModalTab] = useState<TaskModalTab>("general");
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [taskDraft, setTaskDraft] = useState<TaskDraft>(emptyTaskDraft());
  const [assigningTaskId, setAssigningTaskId] = useState<string | null>(null);
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);
  const [taskToRemove, setTaskToRemove] = useState<RepairTaskDto | null>(null);
  const [confirmMarkJobNotComplete, setConfirmMarkJobNotComplete] = useState(false);
  const [completeJobOpen, setCompleteJobOpen] = useState(false);
  const [completeJobConfirmChecked, setCompleteJobConfirmChecked] = useState(false);
  const [completeOpenTasksChecked, setCompleteOpenTasksChecked] = useState(false);
  const [confirmGenerateInvoice, setConfirmGenerateInvoice] = useState(false);
  const [confirmRefreshInvoice, setConfirmRefreshInvoice] = useState(false);
  const [qcSignOffOpen, setQcSignOffOpen] = useState(false);
  const [qcConfirmChecked, setQcConfirmChecked] = useState(false);
  const [qcComment, setQcComment] = useState("");
  const [qcSendBackMode, setQcSendBackMode] = useState(false);
  const [qcFailedTaskIds, setQcFailedTaskIds] = useState<string[]>([]);
  const [paymentModal, setPaymentModal] = useState(false);
  const [paymentAccounts, setPaymentAccounts] = useState<PaymentAccountDto[]>([]);
  const [payAccountId, setPayAccountId] = useState("");
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState<PaymentMethod>("BANK_TRANSFER");
  const [payDate, setPayDate] = useState("");
  const [payReference, setPayReference] = useState("");
  const [stockPartsCatalog, setStockPartsCatalog] = useState<PartDto[]>([]);
  const [partSuppliers, setPartSuppliers] = useState<SupplierDto[]>([]);
  const [usageToReturn, setUsageToReturn] = useState<JobPartUsageDto | null>(null);
  const [supplierReturnDraft, setSupplierReturnDraft] = useState<SupplierReturnDraft | null>(
    null,
  );
  const [usageToCancel, setUsageToCancel] = useState<JobPartUsageDto | null>(null);
  const [usageToReceive, setUsageToReceive] = useState<JobPartUsageDto | null>(null);
  const [receivePurchase, setReceivePurchase] = useState<StockPurchaseDraft>(
    emptyStockPurchaseDraft([]),
  );
  const [stockTyresCatalog, setStockTyresCatalog] = useState<TyreDto[]>([]);
  const [tyreUsageToReturn, setTyreUsageToReturn] = useState<JobTyreUsageDto | null>(null);
  const [partsMaterialsModal, setPartsMaterialsModal] = useState(false);
  const [partsMaterialsTab, setPartsMaterialsTab] = useState<PartsMaterialsTab>("part-stock");
  const [consumePartId, setConsumePartId] = useState("");
  const [consumeQty, setConsumeQty] = useState("1");
  const [consumeTaskId, setConsumeTaskId] = useState("");
  const [orderPartBlocks, setOrderPartBlocks] = useState<OrderPartBlock[]>([]);

  const isWorkView = isWorkshopStaffView(session?.permissions ?? [], "repair");

  const load = useCallback(async () => {
    const data = await apiFetch<RepairJobDto>(`/repair-jobs/${jobId}`);
    setJob(data);
  }, [jobId]);

  useEffect(() => {
    void load().catch(() => setError("Repair job not found"));
    if (canWrite) {
      void apiFetch<RepairAssigneeDto[]>("/repair-jobs/assignees")
        .then(setAssignees)
        .catch(() => setAssignees([]));
    }
    if (canInvoice || canPartsWrite) {
      void apiFetch<PaymentAccountDto[]>("/ledger/accounts")
        .then((accounts) => {
          setPaymentAccounts(accounts);
          setOrderPartBlocks([newOrderPartBlock()]);
          setReceivePurchase(emptyStockPurchaseDraft(accounts));
        })
        .catch(() => setPaymentAccounts([]));
    }
    if (canPartsWrite) {
      void apiFetch<SupplierDto[]>("/suppliers")
        .then(setPartSuppliers)
        .catch(() => setPartSuppliers([]));
    }
  }, [load, canWrite, canInvoice, canPartsWrite]);

  // Reload stock catalog when the job vehicle changes — filters vehicle-specific parts.
  useEffect(() => {
    if (!canPartsWrite || !job) return;
    void apiFetch<PartDto[]>(partsCatalogUrl(job.vehicleMake, job.vehicleModel))
      .then(setStockPartsCatalog)
      .catch(() => setStockPartsCatalog([]));
  }, [canPartsWrite, job?.id, job?.vehicleMake, job?.vehicleModel]);

  useEffect(() => {
    if (!canTyresWrite || !job) return;
    void apiFetch<TyreDto[]>("/tyres")
      .then(setStockTyresCatalog)
      .catch(() => setStockTyresCatalog([]));
  }, [canTyresWrite, job?.id]);

  const accountOptions = useMemo(
    () => paymentAccounts.map((a) => ({ value: a.id, label: a.name })),
    [paymentAccounts],
  );

  const assigneeOptions = useMemo(
    () => [
      { value: "", label: "Unassigned" },
      ...assignees.map((a) => ({ value: a.id, label: a.displayName })),
    ],
    [assignees],
  );

  const stockPartOptions = useMemo(
    () =>
      stockPartsCatalog.map((p) => ({
        value: p.id,
        label: `${p.partNumber} — ${p.description} (${p.quantityOnHand} on hand) · ${summarizePartFitments(p.fitmentType ?? "UNIVERSAL", p.fitments ?? [])}`,
      })),
    [stockPartsCatalog],
  );

  const stockTyreOptions = useMemo(
    () =>
      stockTyresCatalog.map((t) => ({
        value: t.id,
        label: `${t.skuCode} — ${t.displayLabel} (${t.quantityOnHand} on hand)`,
      })),
    [stockTyresCatalog],
  );

  const tyreStockOptions = useMemo(
    () =>
      stockTyresCatalog
        .filter((t) => t.status === "ACTIVE" && Number(t.quantityOnHand) > 0)
        .map((t) => ({
          value: t.id,
          label: `${t.size} — ${t.brand || "No brand"} · ${t.skuCode} (${t.quantityOnHand} on hand)`,
        })),
    [stockTyresCatalog],
  );

  const selectedConsumePart = useMemo(
    () => stockPartsCatalog.find((p) => p.id === consumePartId),
    [stockPartsCatalog, consumePartId],
  );

  const consumePartStockIssue = useMemo((): StockQtyIssue | null => {
    if (!selectedConsumePart) return null;
    const qty = Number(consumeQty) || 0;
    const onHand = Number(selectedConsumePart.quantityOnHand);
    const label = `${selectedConsumePart.partNumber} (${selectedConsumePart.description})`;
    const remaining = onHand - qty;
    const lowAfter =
      qty > 0 &&
      qty <= onHand &&
      (selectedConsumePart.isLowStock ||
        (Number(selectedConsumePart.minQuantity) > 0 &&
          remaining <= Number(selectedConsumePart.minQuantity)));
    return stockQuantityIssue(qty, onHand, label, { lowStockAfterUse: lowAfter });
  }, [selectedConsumePart, consumeQty]);

  const hasJobTyreTask = useMemo(
    () =>
      (job?.stockTyres ?? []).some(
        (u) => u.status === "CONSUMED" && u.repairTaskId,
      ),
    [job?.stockTyres],
  );

  const selectedTaskTyre = useMemo(
    () => stockTyresCatalog.find((t) => t.id === taskDraft.tyreId),
    [stockTyresCatalog, taskDraft.tyreId],
  );

  const taskTyreStockIssue = useMemo(() => {
    if (taskModalTab !== "tyre" || !selectedTaskTyre) return null;
    const qty = Number(taskDraft.tyreQty) || 0;
    const onHand = Number(selectedTaskTyre.quantityOnHand);
    if (qty <= 0) return { type: "error" as const, message: "Enter tyre quantity." };
    if (qty > onHand) {
      return {
        type: "error" as const,
        message: `Out of stock — only ${onHand} available for ${selectedTaskTyre.size}.`,
      };
    }
    const remaining = onHand - qty;
    if (
      selectedTaskTyre.isLowStock ||
      tyreIsLowStock(remaining, selectedTaskTyre.minQuantity)
    ) {
      return { type: "warning" as const, message: "Low stock — reorder level will be reached." };
    }
    return null;
  }, [taskModalTab, taskDraft.tyreQty, selectedTaskTyre]);

  const taskTyreUnitSell = useMemo(() => {
    if (!selectedTaskTyre) return 0;
    if (taskDraft.tyrePriceTier === "TRADE") {
      return Number(selectedTaskTyre.tradeSellPriceNet) || 0;
    }
    if (taskDraft.tyrePriceTier === "CUSTOM") {
      return Number(taskDraft.tyreCustomPrice) || 0;
    }
    return Number(selectedTaskTyre.sellPriceNet);
  }, [selectedTaskTyre, taskDraft.tyrePriceTier, taskDraft.tyreCustomPrice]);

  const taskTyreLineTotal = useMemo(() => {
    const qty = Number(taskDraft.tyreQty) || 1;
    return taskTyreUnitSell * qty;
  }, [taskDraft.tyreQty, taskTyreUnitSell]);

  const editingTaskHasTyre = useMemo(() => {
    if (!editingTaskId || !job?.stockTyres) return false;
    return job.stockTyres.some(
      (u) => u.repairTaskId === editingTaskId && u.status === "CONSUMED",
    );
  }, [editingTaskId, job?.stockTyres]);

  const addingTyreToTask =
    taskModalTab === "tyre" && (!editingTaskId || !editingTaskHasTyre);

  const taskModalTabs = useMemo(() => {
    const tabs: { id: TaskModalTab; label: string }[] = [{ id: "general", label: "General" }];
    const showTyreTab =
      canTyresWrite &&
      tyresModuleEnabled &&
      (!hasJobTyreTask || (editingTaskId && taskDraft.isTyreTask));
    if (showTyreTab) tabs.push({ id: "tyre", label: "Tyre" });
    return tabs;
  }, [canTyresWrite, tyresModuleEnabled, hasJobTyreTask, editingTaskId, taskDraft.isTyreTask]);

  const consumeTaskOptions = useMemo(
    () => [
      { value: "", label: "No task link" },
      ...((job?.tasks ?? []).map((t) => ({ value: t.id, label: t.title }))),
    ],
    [job?.tasks],
  );

  const managerStatusChoices = useMemo(() => {
    if (!job) return [];
    let opts =
      job.status === "TESTING" || job.status === "READY"
        ? managerQcJobStatusOptions(job.status)
        : managerJobStatusOptions(job.status);
    return filterJobStatusOptionsWithoutTasks(opts, job.tasks.length);
  }, [job]);

  function openQcSignOff(sendBack = false) {
    setQcConfirmChecked(false);
    setQcComment("");
    setQcFailedTaskIds([]);
    setQcSendBackMode(sendBack);
    setQcSignOffOpen(true);
  }

  function toggleQcFailedTask(taskId: string) {
    setQcFailedTaskIds((prev) =>
      prev.includes(taskId) ? prev.filter((id) => id !== taskId) : [...prev, taskId],
    );
  }

  function toggleQcFailedAll(checked: boolean) {
    if (!job) return;
    setQcFailedTaskIds(checked ? job.tasks.map((t) => t.id) : []);
  }

  function closeQcSignOff() {
    if (!saving) setQcSignOffOpen(false);
  }

  function openCompleteJobConfirm() {
    setCompleteJobConfirmChecked(false);
    setCompleteOpenTasksChecked(false);
    setCompleteJobOpen(true);
  }

  function closeCompleteJobConfirm() {
    if (!saving) setCompleteJobOpen(false);
  }

  async function updateVatEnabled(enabled: boolean) {
    if (!job || job.vatEnabled === enabled) return;
    setSaving(true);
    setError("");
    try {
      const updated = await apiFetch<RepairJobDto>(`/repair-jobs/${jobId}`, {
        method: "PATCH",
        body: JSON.stringify({ vatEnabled: enabled }),
      });
      setJob(updated);
      setMessage(enabled ? "VAT enabled for this job." : "VAT removed from this job.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update VAT setting");
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(
    status: RepairJobStatus,
    options?: {
      comment?: string;
      failedTaskIds?: string[];
      completeOpenTasks?: boolean;
    },
  ) {
    if (!job || job.status === status) return;
    setSaving(true);
    setError("");
    try {
      const payload: {
        status: RepairJobStatus;
        comment?: string;
        failedTaskIds?: string[];
        completeOpenTasks?: boolean;
      } = { status };
      const trimmed = options?.comment?.trim();
      if (trimmed) payload.comment = trimmed;
      if (options?.failedTaskIds?.length) {
        payload.failedTaskIds = options.failedTaskIds;
      }
      if (options?.completeOpenTasks) {
        payload.completeOpenTasks = true;
      }

      const updated = await apiFetch<RepairJobDto>(`/repair-jobs/${jobId}/status`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setJob(updated);
      if (status === "READY" && job.status === "TESTING") {
        setMessage("Quality check signed off — vehicle is ready for collection.");
      } else if (
        status === "IN_PROGRESS" &&
        (job.status === "TESTING" || job.status === "READY")
      ) {
        setMessage("Job marked as not complete — returned to the workshop.");
      } else if (status === "COMPLETED") {
        setMessage(
          options?.completeOpenTasks
            ? "Open tasks marked complete and job closed."
            : "Job marked as completed.",
        );
      } else {
        setMessage(`Status updated to ${REPAIR_JOB_STATUS_LABEL[status]}.`);
      }
      closeQcSignOff();
      closeCompleteJobConfirm();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Status update failed");
    } finally {
      setSaving(false);
    }
  }

  function handleStatusSelect(status: RepairJobStatus) {
    if (!job || job.status === status) return;
    if (job.status === "TESTING" && (status === "READY" || status === "IN_PROGRESS")) {
      openQcSignOff(status === "IN_PROGRESS");
      return;
    }
    if (job.status === "READY" && status === "IN_PROGRESS") {
      setConfirmMarkJobNotComplete(true);
      return;
    }
    if (status === "COMPLETED") {
      openCompleteJobConfirm();
      return;
    }
    if (jobStatusRequiresTasks(status) && job.tasks.length === 0) {
      setError(JOB_QUOTE_APPROVE_TASKS_MESSAGE);
      return;
    }
    void changeStatus(status);
  }

  async function confirmCompleteJob() {
    if (!completeJobConfirmChecked || !job) return;
    if (!allTasksDone && !completeOpenTasksChecked) return;
    await changeStatus("COMPLETED", {
      completeOpenTasks: !allTasksDone ? true : undefined,
    });
  }

  async function approveQcSignOff() {
    if (!qcConfirmChecked) return;
    await changeStatus("READY");
  }

  async function sendBackFromQc() {
    await changeStatus("IN_PROGRESS", {
      comment: qcComment,
      failedTaskIds: qcFailedTaskIds.length > 0 ? qcFailedTaskIds : undefined,
    });
  }

  function openAddTask() {
    setEditingTaskId(null);
    setTaskDraft(emptyTaskDraft());
    setTaskModalTab("general");
    setTaskModal(true);
  }

  function openEditTask(task: RepairTaskDto) {
    setEditingTaskId(task.id);
    const draft = taskToDraft(task, job?.stockTyres);
    setTaskDraft(draft);
    setTaskModalTab(draft.isTyreTask ? "tyre" : "general");
    setTaskModal(true);
  }

  async function saveTask(e: FormEvent) {
    e.preventDefault();
    if (!taskDraft.title.trim()) {
      setError("Task title is required.");
      return;
    }
    if (addingTyreToTask) {
      if (!taskDraft.tyreId) {
        setError("Select a tyre from stock.");
        return;
      }
      if (taskTyreStockIssue?.type === "error") {
        setError(taskTyreStockIssue.message);
        return;
      }
      if (taskDraft.tyrePriceTier === "TRADE" && !(Number(selectedTaskTyre?.tradeSellPriceNet) > 0)) {
        setError("This tyre has no trade price — choose customer or agreed price.");
        return;
      }
      if (taskDraft.tyrePriceTier === "CUSTOM" && !(Number(taskDraft.tyreCustomPrice) > 0)) {
        setError("Enter the agreed unit price.");
        return;
      }
    } else if (!taskDraft.useBreakdown && !(Number(taskDraft.amountNet) > 0)) {
      setError("Enter the task total amount, or enable labour and parts breakdown.");
      return;
    }
    if (taskDraft.useBreakdown && !addingTyreToTask) {
      const hasLabour = Number(taskDraft.labourRateNet) > 0;
      const hasParts = taskDraft.parts.some(
        (p) => p.description.trim() && Number(p.unitPriceNet) > 0,
      );
      if (!hasLabour && !hasParts) {
        setError("Add labour rate or at least one part when using breakdown.");
        return;
      }
    }

    setSaving(true);
    setError("");

    const approvedForAssignment = job ? isRepairJobApprovedForWork(job.status) : false;
    const body = {
      title: taskDraft.title.trim(),
      description: taskDraft.description.trim() || undefined,
      ...(approvedForAssignment && taskDraft.assigneeId
        ? { assigneeId: taskDraft.assigneeId }
        : {}),
      useBreakdown: taskDraft.useBreakdown,
      ...(taskDraft.useBreakdown
        ? {
            labourHours: Number(taskDraft.labourHours) || 1,
            labourRateNet: Number(taskDraft.labourRateNet) || 0,
            parts: taskDraft.parts
              .filter((p) => p.description.trim())
              .map((p) => ({
                description: p.description.trim(),
                quantity: Number(p.quantity) || 1,
                unitPriceNet: Number(p.unitPriceNet) || 0,
              })),
          }
        : { amountNet: Number(taskDraft.amountNet) || 0 }),
      ...(editingTaskId && approvedForAssignment ? { status: taskDraft.status } : {}),
      ...(addingTyreToTask
        ? {
            amountNet: 0,
            useBreakdown: false,
            tyre: {
              tyreId: taskDraft.tyreId,
              quantity: Number(taskDraft.tyreQty) || 1,
              priceTier: taskDraft.tyrePriceTier,
              ...(taskDraft.tyrePriceTier === "CUSTOM"
                ? { sellPriceNet: Number(taskDraft.tyreCustomPrice) }
                : {}),
            },
          }
        : {}),
    };
    try {
      const updated = await apiFetch<RepairJobDto>(
        editingTaskId
          ? `/repair-jobs/${jobId}/tasks/${editingTaskId}`
          : `/repair-jobs/${jobId}/tasks`,
        {
          method: editingTaskId ? "PATCH" : "POST",
          body: JSON.stringify(body),
        },
      );
      setJob(updated);
      setTaskModal(false);
      setMessage(editingTaskId ? "Task updated." : "Task added.");
      if (addingTyreToTask && canTyresWrite) {
        void apiFetch<TyreDto[]>("/tyres").then(setStockTyresCatalog).catch(() => undefined);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save task");
    } finally {
      setSaving(false);
    }
  }

  async function assignTask(taskId: string, assigneeId: string) {
    const current = job?.tasks.find((t) => t.id === taskId);
    if (!current || (current.assigneeId ?? "") === assigneeId) return;

    setAssigningTaskId(taskId);
    setError("");
    try {
      const updated = await apiFetch<RepairJobDto>(`/repair-jobs/${jobId}/tasks/${taskId}`, {
        method: "PATCH",
        body: JSON.stringify({ assigneeId: assigneeId || null }),
      });
      setJob(updated);
      setMessage("Assignee updated.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not assign task");
    } finally {
      setAssigningTaskId(null);
    }
  }

  async function claimTask(taskId: string) {
    setSaving(true);
    setError("");
    try {
      const updated = await apiFetch<RepairJobDto>(
        `/repair-jobs/${jobId}/tasks/${taskId}/claim`,
        { method: "POST" },
      );
      setJob(updated);
      setMessage("Task assigned to you.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not claim task");
    } finally {
      setSaving(false);
    }
  }

  async function updateTaskStatus(
    taskId: string,
    status: RepairTaskStatus,
    successMessage?: string,
  ) {
    const current = job?.tasks.find((t) => t.id === taskId);
    if (!current || current.status === status) return;

    setUpdatingTaskId(taskId);
    setError("");
    try {
      const updated = await apiFetch<RepairJobDto>(`/repair-jobs/${jobId}/tasks/${taskId}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      setJob(updated);
      setMessage(
        successMessage ?? `Task marked as ${REPAIR_TASK_STATUS_LABEL[status].toLowerCase()}.`,
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update task status");
    } finally {
      setUpdatingTaskId(null);
    }
  }

  async function confirmMarkJobNotCompleteAction() {
    setConfirmMarkJobNotComplete(false);
    await changeStatus("IN_PROGRESS");
  }

  async function confirmRemoveTask() {
    if (!taskToRemove) return;
    setSaving(true);
    setError("");
    try {
      const updated = await apiFetch<RepairJobDto>(
        `/repair-jobs/${jobId}/tasks/${taskToRemove.id}`,
        { method: "DELETE" },
      );
      setJob(updated);
      setTaskToRemove(null);
      setMessage("Task removed.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not delete task");
    } finally {
      setSaving(false);
    }
  }

  async function refreshInvoice() {
    setSaving(true);
    setError("");
    try {
      const result = await apiFetch<{ job: RepairJobDto; invoice: InvoiceDto }>(
        `/repair-jobs/${jobId}/invoice/refresh`,
        { method: "POST" },
      );
      setJob(result.job);
      setConfirmRefreshInvoice(false);
      setMessage(`Invoice ${result.invoice.invoiceNumber} updated from current tasks.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update invoice");
    } finally {
      setSaving(false);
    }
  }

  async function generateInvoice() {
    setSaving(true);
    setError("");
    try {
      const result = await apiFetch<{ job: RepairJobDto; invoice: InvoiceDto }>(
        `/repair-jobs/${jobId}/invoice`,
        { method: "POST" },
      );
      setJob(result.job);
      setConfirmGenerateInvoice(false);
      setMessage(
        `Invoice ${result.invoice.invoiceNumber} created. Record payment when the customer pays.`,
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not generate invoice");
    } finally {
      setSaving(false);
    }
  }

  function openPartsMaterialsModal(tab?: PartsMaterialsTab) {
    setConsumePartId("");
    setConsumeQty("1");
    setConsumeTaskId("");
    setOrderPartBlocks([newOrderPartBlock()]);
    setPartsMaterialsTab(tab ?? "part-stock");
    setPartsMaterialsModal(true);
  }

  async function submitPartFromStock() {
    if (!consumePartId) return;
    setSaving(true);
    setError("");
    try {
      const updated = await apiFetch<RepairJobDto>(`/repair-jobs/${jobId}/stock-parts`, {
        method: "POST",
        body: JSON.stringify({
          partId: consumePartId,
          quantity: Number(consumeQty),
          repairTaskId: consumeTaskId || undefined,
        }),
      });
      setJob(updated);
      setPartsMaterialsModal(false);
      setMessage("Part added from stock.");
      if (canPartsWrite && job) {
        void apiFetch<PartDto[]>(partsCatalogUrl(job.vehicleMake, job.vehicleModel))
          .then(setStockPartsCatalog)
          .catch(() => undefined);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not use part from stock");
    } finally {
      setSaving(false);
    }
  }

  async function submitOrderedParts() {
    if (!job) return;
    const blocks = orderPartBlocks.filter((b) => b.description.trim());
    if (blocks.length === 0) {
      setError("Add at least one part description.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      let updated: RepairJobDto | null = null;
      let blockIndex = 0;
      for (const block of blocks) {
        const partNumber = jobOrderPartNumber(job.jobNumber, block, blockIndex);
        blockIndex += 1;
        updated = await apiFetch<RepairJobDto>(`/repair-jobs/${jobId}/stock-parts/order`, {
          method: "POST",
          body: JSON.stringify({
            description: block.description.trim(),
            supplierId: block.supplierId || undefined,
            supplierRef: block.supplierRef.trim() || undefined,
            partNumber,
            quantity: Number(block.quantity) || 1,
            repairTaskId: block.taskId || undefined,
          }),
        });
      }
      if (updated) setJob(updated);
      setPartsMaterialsModal(false);
      setMessage(
        blocks.length > 1
          ? `${blocks.length} parts ordered — mark received when they arrive.`
          : "Part ordered — mark received when it arrives.",
      );
      if (canPartsWrite) {
        void apiFetch<PartDto[]>(partsCatalogUrl(job.vehicleMake, job.vehicleModel))
          .then(setStockPartsCatalog)
          .catch(() => undefined);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not order parts for this job");
    } finally {
      setSaving(false);
    }
  }

  function handlePartsMaterialsSubmit(e: FormEvent) {
    e.preventDefault();
    if (partsMaterialsTab === "part-stock") void submitPartFromStock();
    else void submitOrderedParts();
  }

  function openReceiveOrdered(usage: JobPartUsageDto) {
    setUsageToReceive(usage);
    setReceivePurchase({
      ...emptyStockPurchaseDraft(paymentAccounts),
      supplierId: usage.supplierId ?? "",
    });
  }

  async function submitReceiveOrdered(e: FormEvent) {
    e.preventDefault();
    if (!usageToReceive) return;
    setSaving(true);
    setError("");
    try {
      const updated = await apiFetch<RepairJobDto>(
        `/repair-jobs/${jobId}/stock-parts/${usageToReceive.id}/receive`,
        {
          method: "POST",
          body: JSON.stringify(stockPurchaseApiPayload(receivePurchase)),
        },
      );
      setJob(updated);
      setUsageToReceive(null);
      setMessage("Part received and fitted on job.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not receive part");
    } finally {
      setSaving(false);
    }
  }

  async function cancelOrderedPart() {
    if (!usageToCancel) return;
    setSaving(true);
    setError("");
    try {
      const updated = await apiFetch<RepairJobDto>(
        `/repair-jobs/${jobId}/stock-parts/${usageToCancel.id}/cancel`,
        { method: "POST" },
      );
      setJob(updated);
      setUsageToCancel(null);
      setMessage("Order cancelled.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not cancel order");
    } finally {
      setSaving(false);
    }
  }

  async function returnStockTyre() {
    if (!tyreUsageToReturn) return;
    setSaving(true);
    setError("");
    try {
      const updated = await apiFetch<RepairJobDto>(
        `/repair-jobs/${jobId}/stock-tyres/${tyreUsageToReturn.id}/return`,
        { method: "POST" },
      );
      setJob(updated);
      setTyreUsageToReturn(null);
      setMessage("Tyre returned to stock.");
      void apiFetch<TyreDto[]>("/tyres").then(setStockTyresCatalog).catch(() => undefined);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not return tyre");
    } finally {
      setSaving(false);
    }
  }

  function openPartReturn(usage: JobPartUsageDto) {
    if (usage.source === "ORDERED") {
      setUsageToReturn(usage);
      setSupplierReturnDraft(emptySupplierReturnDraft(usage, paymentAccounts));
      return;
    }
    setUsageToReturn(usage);
    setSupplierReturnDraft(null);
  }

  async function returnStockPart() {
    if (!usageToReturn || usageToReturn.source === "ORDERED") return;
    setSaving(true);
    setError("");
    try {
      const updated = await apiFetch<RepairJobDto>(
        `/repair-jobs/${jobId}/stock-parts/${usageToReturn.id}/return`,
        {
          method: "POST",
          body: JSON.stringify({ returnTo: "STOCK" }),
        },
      );
      setJob(updated);
      setUsageToReturn(null);
      setMessage("Part returned to stock.");
      if (canPartsWrite && job) {
        void apiFetch<PartDto[]>(partsCatalogUrl(job.vehicleMake, job.vehicleModel))
          .then(setStockPartsCatalog)
          .catch(() => undefined);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not return part to stock");
    } finally {
      setSaving(false);
    }
  }

  async function submitSupplierReturn(e: FormEvent) {
    e.preventDefault();
    if (!usageToReturn || !supplierReturnDraft) return;
    if (supplierReturnDraft.refundType === "CREDIT" && !supplierReturnDraft.supplierId) {
      setError("Select the supplier to credit.");
      return;
    }
    if (
      supplierReturnDraft.refundType === "PAYMENT" &&
      !supplierReturnDraft.paymentAccountId
    ) {
      setError("Select the account that received the refund.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const updated = await apiFetch<RepairJobDto>(
        `/repair-jobs/${jobId}/stock-parts/${usageToReturn.id}/return`,
        {
          method: "POST",
          body: JSON.stringify({
            returnTo: "SUPPLIER",
            refundType: supplierReturnDraft.refundType,
            supplierId: supplierReturnDraft.supplierId || undefined,
            refundMethod:
              supplierReturnDraft.refundType === "PAYMENT"
                ? supplierReturnDraft.refundMethod
                : undefined,
            paymentAccountId:
              supplierReturnDraft.refundType === "PAYMENT"
                ? supplierReturnDraft.paymentAccountId
                : undefined,
            notes: supplierReturnDraft.notes.trim() || undefined,
          }),
        },
      );
      setJob(updated);
      setUsageToReturn(null);
      setSupplierReturnDraft(null);
      setMessage(
        supplierReturnDraft.refundType === "CREDIT"
          ? "Part returned — credit added to supplier account."
          : "Part returned — refund recorded.",
      );
      void apiFetch<SupplierDto[]>("/suppliers").then(setPartSuppliers).catch(() => undefined);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not return part to supplier");
    } finally {
      setSaving(false);
    }
  }

  function methodForAccount(accountId: string): PaymentMethod {
    const account = paymentAccounts.find((a) => a.id === accountId);
    return account ? defaultPaymentMethodForAccount(account.type) : "BANK_TRANSFER";
  }

  function openPaymentModal() {
    if (!job?.invoiceId || !job.invoiceBalanceDue) return;
    setPayAmount(job.invoiceBalanceDue);
    const firstAccountId = paymentAccounts[0]?.id ?? "";
    setPayAccountId(firstAccountId);
    setPayMethod(methodForAccount(firstAccountId));
    setPayDate(todayIso());
    setPayReference(job.invoiceNumber ? `Payment — ${job.invoiceNumber}` : "");
    setPaymentModal(true);
  }

  async function savePayment(e: FormEvent) {
    e.preventDefault();
    if (!job?.invoiceId || !job.customerId) return;

    const amount = Number(payAmount);
    if (!payAccountId || amount <= 0) {
      setError("Payment account and amount are required.");
      return;
    }

    const balance = Number(job.invoiceBalanceDue ?? 0);
    if (amount > balance + 0.009) {
      setError(`Amount cannot exceed balance due (${formatGbp(balance)}).`);
      return;
    }

    setSaving(true);
    setError("");
    try {
      await apiFetch("/invoices/payments", {
        method: "POST",
        body: JSON.stringify({
          customerId: job.customerId,
          paymentAccountId: payAccountId,
          amount,
          valueDate: payDate,
          method: payMethod,
          reference: payReference || undefined,
          allocations: [{ invoiceId: job.invoiceId, amount }],
        }),
      });
      setPaymentModal(false);
      setMessage("Payment recorded and posted to the ledger.");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not record payment");
    } finally {
      setSaving(false);
    }
  }

  if (!job) {
    return <GateLoading />;
  }

  const canGenerateInvoice =
    canWrite &&
    canInvoice &&
    !job.invoiceId &&
    ["APPROVED", "IN_PROGRESS", "TESTING", "READY", "COMPLETED"].includes(job.status);

  const canRecordPayment =
    canWrite &&
    !isWorkView &&
    canInvoice &&
    job.invoiceId &&
    job.invoiceStatus &&
    ["SENT", "PART_PAID"].includes(job.invoiceStatus) &&
    Number(job.invoiceBalanceDue ?? 0) > 0.009;

  const canRefreshInvoice =
    canWrite &&
    !isWorkView &&
    canInvoice &&
    job.invoiceId &&
    job.invoiceInSync === false;

  const chargesVat = jobChargesVat(canChargeVat, job);
  const jobClosed = job.status === "COMPLETED" || job.status === "CANCELLED";
  const jobApprovedForWork = isRepairJobApprovedForWork(job.status);
  const canEditTasks = canWrite && !jobClosed;
  const canAssignTasks =
    canEditTasks && jobApprovedForWork && !isWorkView;
  const canEditVat =
    canWrite && !isWorkView && job.status !== "CANCELLED" && !job.invoiceId;
  const canConsumeStock =
    canPartsWrite && canWrite && !isWorkView && jobApprovedForWork && !jobClosed;
  const showStockParts =
    partsModuleEnabled && hasPermission("parts.read") && !isWorkView;
  const showStockTyres =
    tyresModuleEnabled && hasPermission("tyres.read") && !isWorkView;
  const showJobMaterials = (showStockParts || showStockTyres) && !isWorkView;
  const canAddJobMaterials = canConsumeStock;

  const partsMaterialsTabs: { id: PartsMaterialsTab; label: string }[] = [];
  if (canConsumeStock && partsModuleEnabled) {
    partsMaterialsTabs.push({ id: "part-stock", label: "Part from stock" });
    partsMaterialsTabs.push({ id: "order", label: "Order from supplier" });
  }

  const activePartsMaterialsTab: PartsMaterialsTab = partsMaterialsTabs.some(
    (t) => t.id === partsMaterialsTab,
  )
    ? partsMaterialsTab
    : (partsMaterialsTabs[0]?.id ?? "part-stock");

  const jobMaterialsEmpty =
    (job.stockParts?.length ?? 0) === 0 && (job.stockTyres?.length ?? 0) === 0;

  const allTasksDone = allRepairTasksComplete(job.tasks);
  const openTasks = job.tasks.filter(
    (t) => t.status !== "COMPLETED" && t.status !== "CANCELLED",
  );
  const canConfirmCompleteJob =
    completeJobConfirmChecked && (allTasksDone || completeOpenTasksChecked);
  const canEditJobStatus =
    job.status !== "COMPLETED" && job.status !== "CANCELLED";
  const showManagerStatusSelect =
    canWrite && !isWorkView && canEditJobStatus;
  const hasTasksForQuote = job.tasks.length > 0;

  function workDetail(task: RepairTaskDto) {
    const parts: string[] = [];
    if (Number(task.labourHours) > 0) parts.push(`${task.labourHours}h labour`);
    if (task.useBreakdown && task.parts.length > 0) {
      parts.push(`${task.parts.length} part${task.parts.length === 1 ? "" : "s"}`);
    }
    return parts.length > 0 ? parts.join(" · ") : "—";
  }

  return (
    <div>
      <div className="mb-4">
        <Link href="/repair" className="text-sm text-accent hover:underline">
          ← {isWorkView ? "My workshop jobs" : "Repair jobs"}
        </Link>
      </div>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          {job.vehicleRegistration && (
            <UkNumberPlate registration={job.vehicleRegistration} className="mb-2" />
          )}
          <h1 className="text-xl font-semibold">{job.jobNumber}</h1>
          <p className="text-sm text-[var(--muted)]">
            {job.customerName}
            {job.vehicleLabel ? ` · ${job.vehicleLabel}` : ""}
          </p>
          {job.customerConcern && (
            <p className="mt-2 text-sm">{job.customerConcern}</p>
          )}
        </div>
        <div className="text-right">
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
            {isWorkView ? "Job" : "Job status"}
          </p>
          {showManagerStatusSelect ? (
            <Select
              value={job.status}
              onChange={(value) => handleStatusSelect(value as RepairJobStatus)}
              options={managerStatusChoices.map((s) => ({
                value: s,
                label: managerJobStatusLabel(s, job.status),
              }))}
              disabled={saving}
              aria-label="Update job status"
              className="min-w-[11rem]"
              triggerClassName="min-h-0 py-1.5 font-semibold"
            />
          ) : (
            <p className="text-sm font-semibold">{REPAIR_JOB_STATUS_LABEL[job.status]}</p>
          )}
        </div>
      </div>

      {message && <p className="mb-3 text-sm text-green-700 dark:text-green-400">{message}</p>}
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      {canWrite && !isWorkView && !jobApprovedForWork && (
        <div className="mb-6 rounded-xl border border-violet-300 bg-violet-50 p-4 dark:border-violet-800 dark:bg-violet-950/40">
          <p className="text-sm font-semibold text-violet-950 dark:text-violet-100">
            Awaiting repair approval
          </p>
          <p className="mt-1 text-sm text-violet-900 dark:text-violet-200/90">
            Add tasks to build the repair quote now. Approve the repair before assigning tasks to
            mechanics or sending work to the workshop.
          </p>
          {!hasTasksForQuote && (
            <p className="mt-2 text-xs text-amber-800 dark:text-amber-200">
              {JOB_QUOTE_APPROVE_TASKS_MESSAGE}
            </p>
          )}
          {job.status === "NEW" && (
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={saving || !hasTasksForQuote}
                onClick={() => void changeStatus("QUOTE_SENT")}
                className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm font-medium hover:bg-[var(--background)] disabled:opacity-50"
              >
                Mark quote sent
              </button>
              <button
                type="button"
                disabled={saving || !hasTasksForQuote}
                onClick={() => void changeStatus("APPROVED")}
                className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                Approve repair
              </button>
            </div>
          )}
          {job.status === "QUOTE_SENT" && (
            <div className="mt-3">
              <button
                type="button"
                disabled={saving || !hasTasksForQuote}
                onClick={() => void changeStatus("APPROVED")}
                className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                Approve repair
              </button>
            </div>
          )}
        </div>
      )}

      {canWrite && !isWorkView && (
        <section className="mb-6 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <h2 className="mb-3 text-sm font-semibold">Billing</h2>
          {canChargeVat ? (
            <label className="flex cursor-pointer items-start gap-3 text-sm">
              <input
                type="checkbox"
                checked={job.vatEnabled}
                disabled={saving || !canEditVat}
                onChange={(e) => void updateVatEnabled(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 rounded border border-[var(--border)] disabled:cursor-not-allowed disabled:opacity-50"
              />
              <span>
                <span className="font-medium">Charge VAT on this job</span>
                <span className="block text-xs text-[var(--muted)]">
                  {job.vatRatePercent}% applied to task totals and the invoice when generated.
                </span>
                {!canEditVat && job.invoiceId && (
                  <span className="mt-1 block text-xs text-amber-700 dark:text-amber-300">
                    Locked — an invoice has already been generated for this job.
                  </span>
                )}
                {!canEditVat && job.status === "CANCELLED" && (
                  <span className="mt-1 block text-xs text-[var(--muted)]">
                    Cannot change on a cancelled job.
                  </span>
                )}
              </span>
            </label>
          ) : (
            <p className="text-sm text-[var(--muted)]">
              VAT cannot be charged — this garage has no VAT registration number.
            </p>
          )}
        </section>
      )}

      {canWrite && !isWorkView && job.status === "TESTING" && (
        <div className="mb-6 rounded-xl border border-cyan-300 bg-cyan-50 p-4 dark:border-cyan-800 dark:bg-cyan-950/40">
          <p className="text-sm font-semibold text-cyan-950 dark:text-cyan-100">
            Awaiting quality check
          </p>
          <p className="mt-1 text-sm text-cyan-900 dark:text-cyan-200/90">
            All workshop tasks are complete. Inspect the vehicle, test the repair, and sign off before
            the customer collects the car — or send it back to the workshop if further work is needed.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={() => openQcSignOff(false)}
              className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              Sign off quality check
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => setConfirmMarkJobNotComplete(true)}
              className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-sm font-medium text-amber-900 hover:bg-amber-50 disabled:opacity-50 dark:border-amber-700 dark:bg-transparent dark:text-amber-200 dark:hover:bg-amber-950/40"
            >
              Mark job not complete
            </button>
          </div>
        </div>
      )}

      {isWorkView && job.status === "TESTING" && (
        <div className="mb-6 rounded-xl border border-cyan-300 bg-cyan-50 p-4 dark:border-cyan-800 dark:bg-cyan-950/40">
          <p className="text-sm font-semibold text-cyan-950 dark:text-cyan-100">
            Awaiting quality check
          </p>
          <p className="mt-1 text-sm text-cyan-900 dark:text-cyan-200/90">
            Your tasks are complete. A manager will inspect the vehicle and sign off before collection.
          </p>
        </div>
      )}

      {canWrite && !isWorkView && job.status === "READY" && (
        <div className="mb-6 rounded-xl border border-green-200 bg-green-50 p-4 dark:border-green-900 dark:bg-green-950/30">
          <p className="text-sm font-semibold text-green-900 dark:text-green-200">
            Ready for collection
          </p>
          <p className="mt-1 text-sm text-green-800 dark:text-green-300/90">
            Quality check is complete. Generate the invoice when you are ready to bill the customer.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {canGenerateInvoice && (
              <button
                type="button"
                disabled={saving}
                onClick={() => setConfirmGenerateInvoice(true)}
                className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm font-medium hover:bg-[var(--background)] disabled:opacity-50"
              >
                Generate invoice
              </button>
            )}
            <button
              type="button"
              disabled={saving}
              onClick={() => openCompleteJobConfirm()}
              className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              Mark job complete
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => setConfirmMarkJobNotComplete(true)}
              className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-sm font-medium text-amber-900 hover:bg-amber-50 disabled:opacity-50 dark:border-amber-700 dark:bg-transparent dark:text-amber-200 dark:hover:bg-amber-950/40"
            >
              Mark job not complete
            </button>
          </div>
        </div>
      )}

      {canWrite &&
        !isWorkView &&
        allTasksDone &&
        canEditJobStatus &&
        job.status !== "TESTING" &&
        job.status !== "READY" && (
          <div className="mb-6 rounded-xl border border-green-200 bg-green-50 p-4 dark:border-green-900 dark:bg-green-950/30">
            <p className="text-sm font-semibold text-green-900 dark:text-green-200">
              All tasks are complete
            </p>
            <p className="mt-1 text-sm text-green-800 dark:text-green-300/90">
              The job moves to Awaiting QC automatically when the last task is finished. A manager
              will inspect the vehicle and sign off before collection.
            </p>
          </div>
        )}

      {!isWorkView && job.invoiceId && job.invoiceInSync === false && (
        <div className="mb-6 rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/40">
          <p className="text-sm font-semibold text-amber-950 dark:text-amber-100">
            Invoice is out of date
          </p>
          <p className="mt-1 text-sm text-amber-900 dark:text-amber-200/90">
            Job pricing changed after the invoice was created. Current job total{" "}
            <span className="font-mono font-medium">
              {job.tasksAmountGross ? formatGbp(Number(job.tasksAmountGross)) : "—"}
            </span>
            {grossAmountSuffix(chargesVat)}, but invoice{" "}
            <span className="font-mono font-medium">
              {job.invoiceAmountGross ? formatGbp(Number(job.invoiceAmountGross)) : "—"}
            </span>
            {grossAmountSuffix(chargesVat)}. Update the invoice before recording payment or sending
            the PDF to the customer.
          </p>
          {canRefreshInvoice && (
            <button
              type="button"
              disabled={saving}
              onClick={() => setConfirmRefreshInvoice(true)}
              className="mt-3 rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              Update invoice from job
            </button>
          )}
        </div>
      )}

      {!isWorkView && (
        <div className="mb-6 flex flex-wrap items-center gap-2">
          {job.invoiceId && job.invoiceNumber && (
            <>
              <Link
                href="/invoices"
                className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm font-medium hover:bg-[var(--background)]"
              >
                Invoice {job.invoiceNumber}
                {job.invoiceAmountGross
                  ? chargesVat && job.invoiceAmountNet
                    ? ` · ${formatGbp(Number(job.invoiceAmountNet))} ex VAT · ${formatGbp(Number(job.invoiceAmountGross))} inc VAT`
                    : ` · ${formatGbp(Number(job.invoiceAmountGross))}`
                  : ""}
              </Link>
              {job.invoiceStatus && (
                <span className="text-sm text-[var(--muted)]">
                  {INVOICE_STATUS_LABEL[job.invoiceStatus]}
                  {job.invoiceBalanceDue && Number(job.invoiceBalanceDue) > 0.009
                    ? ` · ${formatGbp(Number(job.invoiceBalanceDue))} due`
                    : ""}
                </span>
              )}
              <button
                type="button"
                onClick={() => {
                  if (!job.invoiceId) return;
                  void openAuthenticatedPdf(job.invoiceId).catch((err) =>
                    setError(err instanceof ApiError ? err.message : "Could not open PDF"),
                  );
                }}
                className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm font-medium hover:bg-[var(--background)]"
              >
                View PDF
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!job.invoiceId || !job.invoiceNumber) return;
                  void downloadAuthenticatedPdf(job.invoiceId, `${job.invoiceNumber}.pdf`).catch(
                    (err) =>
                      setError(err instanceof ApiError ? err.message : "Could not download PDF"),
                  );
                }}
                className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm font-medium hover:bg-[var(--background)]"
              >
                Download PDF
              </button>
              {canRecordPayment && (
                <button
                  type="button"
                  disabled={saving}
                  onClick={openPaymentModal}
                  className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
                >
                  Record payment
                </button>
              )}
            </>
          )}
          {canGenerateInvoice && (
            <button
              type="button"
              disabled={saving}
              onClick={() => setConfirmGenerateInvoice(true)}
              className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              Generate invoice
            </button>
          )}
        </div>
      )}

      <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)]">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold">Tasks</h2>
            {jobClosed && canWrite && !isWorkView && (
              <p className="mt-0.5 text-xs text-[var(--muted)]">
                Locked — job is complete; tasks and parts cannot be changed.
              </p>
            )}
          </div>
          {canEditTasks && (
            <button type="button" onClick={openAddTask} className="text-sm font-medium text-accent">
              + Add task
            </button>
          )}
        </div>
        {job.tasks.length === 0 ? (
          <p className="px-4 py-6 text-sm text-[var(--muted)]">
            {isWorkView
              ? "No tasks on this job yet."
              : "No tasks yet. Add tasks with a total amount per line."}
          </p>
        ) : isWorkView ? (
          <TableScroll>
            <table className="w-full min-w-[40rem] text-left text-sm">
              <thead className={`${STICKY_TABLE_HEAD_CLASS} text-[var(--foreground)]`}>
                <tr>
                  <th className="px-4 py-3 font-semibold">Task</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Assignee</th>
                  <th className="px-4 py-3 font-semibold">Work</th>
                  <th className="px-4 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {job.tasks.map((task) => (
                  <tr key={task.id} className="border-t border-[var(--border)] hover:bg-[var(--background)]">
                    <td className="px-4 py-3 align-top">
                      <p className="font-medium">{task.title}</p>
                      {task.description && (
                        <p className="mt-0.5 text-xs text-[var(--muted)]">{task.description}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 align-top">{taskStatusChip(task.status)}</td>
                    <td className="px-4 py-3 align-top text-[var(--muted)]">
                      {workshopTaskAssigneeLabel(task, userId)}
                    </td>
                    <td className="px-4 py-3 align-top text-[var(--muted)]">{workDetail(task)}</td>
                    <td className="px-4 py-3 text-right align-top">
                      {isWorkshopTaskClaimable(task, job.status, "repair") ? (
                        <button
                          type="button"
                          disabled={saving || jobClosed}
                          onClick={() => void claimTask(task.id)}
                          className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                        >
                          Assign to me
                        </button>
                      ) : task.assigneeId === userId &&
                        task.status !== "COMPLETED" &&
                        task.status !== "CANCELLED" ? (
                        <Select
                          value={task.status}
                          onChange={(value) =>
                            void updateTaskStatus(task.id, value as RepairTaskStatus)
                          }
                          options={mechanicTaskStatusOptions(task.status).map((s) => ({
                            value: s,
                            label: REPAIR_TASK_STATUS_LABEL[s],
                          }))}
                          disabled={updatingTaskId === task.id || saving || jobClosed}
                          aria-label={`Update status for ${task.title}`}
                          className="ml-auto min-w-[9rem]"
                          triggerClassName={compactSelectTriggerClass}
                        />
                      ) : task.assigneeId && task.assigneeId !== userId ? (
                        <span className="text-xs text-[var(--muted)]">
                          With {task.assigneeName ?? "colleague"}
                        </span>
                      ) : (
                        <span className="text-xs text-[var(--muted)]">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        ) : (
          <TableScroll>
            <table className="w-full min-w-[44rem] text-left text-sm">
              <thead className={`${STICKY_TABLE_HEAD_CLASS} text-[var(--foreground)]`}>
                <tr>
                  <th className="px-4 py-3 font-semibold">Task</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="min-w-[10rem] px-4 py-3 font-semibold">Assignee</th>
                  <th className="px-4 py-3 text-right font-semibold">Amount (ex VAT)</th>
                  {canEditTasks && <th className="px-4 py-3 text-right font-semibold">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {job.tasks.map((task) => {
                  const lineNet = repairTaskAmountNet(task);
                  const summary = taskAmountSummary(task);
                  return (
                    <tr key={task.id} className="border-t border-[var(--border)] hover:bg-[var(--background)]">
                      <td className="px-4 py-3 align-top">
                        <p className="font-medium">{task.title}</p>
                        {task.description && (
                          <p className="mt-0.5 text-xs text-[var(--muted)]">{task.description}</p>
                        )}
                        {summary && (
                          <p className="mt-0.5 text-xs text-[var(--muted)]">{summary}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top">{taskStatusChip(task.status)}</td>
                      <td className="px-4 py-3 align-top">
                        {canAssignTasks ? (
                          <select
                            value={task.assigneeId ?? ""}
                            onChange={(e) => void assignTask(task.id, e.target.value)}
                            disabled={assigningTaskId === task.id || saving}
                            aria-label={`Assign ${task.title}`}
                            className={compactSelectClass}
                          >
                            {assigneeOptions.map((o) => (
                              <option key={o.value || "unassigned"} value={o.value}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-sm text-[var(--muted)]">
                            {task.assigneeName ?? "Unassigned"}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right align-top font-medium tabular-nums">
                        {lineNet > 0 ? formatGbp(lineNet) : "—"}
                      </td>
                      {canEditTasks && (
                        <td className="px-4 py-3 text-right align-top">
                          <TableRowActionsMenu
                            triggerLabel={`Actions for ${task.title}`}
                            actions={[
                              { label: "Edit", onClick: () => openEditTask(task) },
                              {
                                label: "Remove",
                                variant: "danger",
                                onClick: () => setTaskToRemove(task),
                              },
                            ]}
                          />
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
              {job.tasks.some((t) => repairTaskAmountNet(t) > 0) && (() => {
                const tasksNet = job.tasks.reduce((sum, t) => sum + repairTaskAmountNet(t), 0);
                const vatRate =
                  canChargeVat && job.vatEnabled ? Number(job.vatRatePercent) / 100 : 0;
                const tasksGross = Math.round(tasksNet * (1 + vatRate) * 100) / 100;
                return (
                  <tfoot>
                    <tr className="border-t border-[var(--border)] bg-[var(--background)] font-medium">
                      <td
                        colSpan={canEditTasks ? 3 : 2}
                        className="px-4 py-3 text-right text-[var(--muted)]"
                      >
                        {chargesVat ? "Tasks total (ex VAT)" : "Tasks total"}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {formatGbp(tasksNet)}
                      </td>
                      {canEditTasks && <td />}
                    </tr>
                    {canChargeVat && job.vatEnabled && vatRate > 0 && (
                      <tr className="bg-[var(--background)] font-medium">
                        <td
                          colSpan={canEditTasks ? 3 : 2}
                          className="px-4 py-3 text-right text-[var(--muted)]"
                        >
                          Tasks total (inc VAT)
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {formatGbp(tasksGross)}
                        </td>
                        {canEditTasks && <td />}
                      </tr>
                    )}
                  </tfoot>
                );
              })()}
            </table>
          </TableScroll>
        )}
      </section>

      {showJobMaterials && (
        <section className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--surface)]">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold">Parts & tyres</h2>
              <p className="mt-0.5 text-xs text-[var(--muted)]">
                Parts record stock used on this job (customer price is on tasks). Tyres are added via
                a tyre task. Ordered parts are expensed when received; ledger posts when the job is
                complete.
              </p>
            </div>
            {canAddJobMaterials && (
              <button
                type="button"
                onClick={() => openPartsMaterialsModal()}
                className="text-sm font-medium text-accent"
              >
                + Add parts
              </button>
            )}
          </div>
          {!jobApprovedForWork && canAddJobMaterials && !jobClosed && (
              <p className="px-4 py-3 text-xs text-[var(--muted)]">
                Approve the repair before adding parts or tyres to this job.
              </p>
            )}
          {jobMaterialsEmpty ? (
            <p className="px-4 py-6 text-sm text-[var(--muted)]">
              No parts or tyres on this job yet.
            </p>
          ) : (
            <TableScroll>
              <table className="w-full min-w-[900px] text-sm">
                <thead className={STICKY_TABLE_HEAD_CLASS}>
                  <tr className="border-b border-[var(--border)] text-left text-xs text-[var(--muted)]">
                    <th className="px-4 py-2 font-medium">Type</th>
                    <th className="px-4 py-2 font-medium">Item</th>
                    <th className="px-4 py-2 font-medium">Task</th>
                    <th className="px-4 py-2 text-right font-medium">Qty</th>
                    <th className="px-4 py-2 text-right font-medium">Cost (ex VAT)</th>
                    <th className="px-4 py-2 text-right font-medium">VAT</th>
                    <th className="px-4 py-2 text-right font-medium">Cost (inc VAT)</th>
                    <th className="px-4 py-2 text-right font-medium">Status</th>
                    {canAddJobMaterials && <th className="px-4 py-2" />}
                  </tr>
                </thead>
                <tbody>
                  {showStockParts &&
                    job.stockParts?.map((usage) => (
                      <tr key={`part-${usage.id}`} className="border-b border-[var(--border)]">
                        <td className="px-4 py-3 text-xs text-[var(--muted)]">Part</td>
                        <td className="px-4 py-3">
                          <div className="font-medium">{usage.partNumber}</div>
                          <div className="text-xs text-[var(--muted)]">{usage.partDescription}</div>
                        </td>
                        <td className="px-4 py-3 text-[var(--muted)]">
                          {usage.repairTaskTitle ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">{usage.quantity}</td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {formatGbp(partUsageCostBreakdown(usage).net)}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {formatGbp(partUsageCostBreakdown(usage).vat)}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {formatGbp(partUsageCostBreakdown(usage).gross)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-xs text-[var(--muted)]">
                            {partUsageStatusLabel(usage)}
                          </span>
                        </td>
                        {canAddJobMaterials && (
                          <td className="px-4 py-3 text-right">
                            {usage.status === "ORDERED" && (
                              <div className="flex flex-col items-end gap-1">
                                <button
                                  type="button"
                                  disabled={saving}
                                  onClick={() => openReceiveOrdered(usage)}
                                  className="text-xs font-medium text-accent hover:underline disabled:opacity-50"
                                >
                                  Mark received
                                </button>
                                <button
                                  type="button"
                                  disabled={saving}
                                  onClick={() => setUsageToCancel(usage)}
                                  className="text-xs text-[var(--muted)] hover:underline disabled:opacity-50"
                                >
                                  Cancel order
                                </button>
                              </div>
                            )}
                            {usage.status === "CONSUMED" && canConsumeStock && (
                              <button
                                type="button"
                                disabled={saving}
                                onClick={() => openPartReturn(usage)}
                                className="text-xs font-medium text-accent hover:underline disabled:opacity-50"
                              >
                                {usage.source === "ORDERED"
                                  ? "Return to supplier"
                                  : "Return to stock"}
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  {showStockTyres &&
                    job.stockTyres?.map((usage) => (
                      <tr key={`tyre-${usage.id}`} className="border-b border-[var(--border)] last:border-0">
                        <td className="px-4 py-3 text-xs text-[var(--muted)]">Tyre</td>
                        <td className="px-4 py-3">
                          <div className="font-medium">{usage.skuCode}</div>
                          <div className="text-xs text-[var(--muted)]">{usage.tyreLabel}</div>
                        </td>
                        <td className="px-4 py-3 text-[var(--muted)]">
                          {usage.repairTaskTitle ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">{usage.quantity}</td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {formatGbp(Number(usage.lineSellTotalNet))}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {usage.status === "RETURNED" ? (
                            <span className="text-xs text-[var(--muted)]">Returned</span>
                          ) : (
                            <span className="text-xs text-green-700 dark:text-green-400">On job</span>
                          )}
                        </td>
                        {canEditTasks && (
                          <td className="px-4 py-3 text-right">
                            {usage.status === "CONSUMED" && usage.repairTaskId ? (
                              <span className="text-xs text-[var(--muted)]">Tyre task</span>
                            ) : (
                              usage.status === "CONSUMED" &&
                              canTyresWrite && (
                                <button
                                  type="button"
                                  disabled={saving}
                                  onClick={() => setTyreUsageToReturn(usage)}
                                  className="text-xs font-medium text-accent hover:underline disabled:opacity-50"
                                >
                                  Return to stock
                                </button>
                              )
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                </tbody>
              </table>
            </TableScroll>
          )}
        </section>
      )}

      {canEditTasks && (
        <Modal
          title={editingTaskId ? "Edit task" : "Add task"}
          open={taskModal}
          onClose={() => setTaskModal(false)}
          size="lg"
          autoHeight
        >
          <form onSubmit={(e) => void saveTask(e)} className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Title</label>
              <input
                value={taskDraft.title}
                onChange={(e) => setTaskDraft((d) => ({ ...d, title: e.target.value }))}
                required
                className={inputClass}
                placeholder="e.g. Replace clutch"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Description</label>
              <textarea
                value={taskDraft.description}
                onChange={(e) => setTaskDraft((d) => ({ ...d, description: e.target.value }))}
                rows={2}
                className={inputClass}
              />
            </div>
            {canAssignTasks ? (
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--muted)]">
                  Assign mechanic
                </label>
                <SearchableSelect
                  value={taskDraft.assigneeId}
                  onChange={(v) => setTaskDraft((d) => ({ ...d, assigneeId: v }))}
                  options={assigneeOptions}
                  searchPlaceholder="Search team…"
                />
              </div>
            ) : (
              <p className="text-xs text-[var(--muted)]">
                Approve the repair before assigning tasks to mechanics.
              </p>
            )}

            {taskModalTabs.length > 1 && (
              <TabBar
                tabs={taskModalTabs}
                active={taskModalTab}
                onChange={(tab) => {
                  setTaskModalTab(tab);
                  if (tab === "tyre") {
                    setTaskDraft((d) => ({
                      ...d,
                      isTyreTask: true,
                      useBreakdown: false,
                      amountNet: "",
                    }));
                  } else if (!editingTaskHasTyre) {
                    setTaskDraft((d) => ({ ...d, isTyreTask: false }));
                  }
                }}
                className="-mx-1"
              />
            )}

            {hasJobTyreTask && !editingTaskId && canTyresWrite && (
              <p className="text-xs text-[var(--muted)]">
                This job already has a tyre task. Edit that task to change tyres.
              </p>
            )}

            {taskModalTab === "tyre" && (
              <div className="space-y-3 rounded-lg border border-[var(--border)] p-3">
                {addingTyreToTask ? (
                  <>
                    <p className="text-xs text-[var(--muted)]">
                      Tyre fitting is billed on the invoice. Task amount stays at £0.
                    </p>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-[var(--muted)]">
                        Tyre from stock
                      </label>
                      <SearchableSelect
                        value={taskDraft.tyreId}
                        onChange={(v) => setTaskDraft((d) => ({ ...d, tyreId: v }))}
                        options={tyreStockOptions}
                        searchPlaceholder="Search by size, brand, or code…"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-[var(--muted)]">
                        Quantity
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="4"
                        step="1"
                        value={taskDraft.tyreQty}
                        onChange={(e) => setTaskDraft((d) => ({ ...d, tyreQty: e.target.value }))}
                        required
                        className={inputClass}
                      />
                    </div>
                    {taskTyreStockIssue && (
                      <p
                        className={`text-xs ${
                          taskTyreStockIssue.type === "error"
                            ? "text-red-600 dark:text-red-400"
                            : "text-amber-700 dark:text-amber-400"
                        }`}
                      >
                        {taskTyreStockIssue.message}
                      </p>
                    )}
                    {selectedTaskTyre && (
                      <fieldset className="space-y-2">
                        <legend className="text-xs font-medium text-[var(--muted)]">
                          Sell price per tyre, incl. fitting (ex VAT)
                        </legend>
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="radio"
                            name="tyrePriceTier"
                            checked={taskDraft.tyrePriceTier === "CUSTOMER"}
                            onChange={() =>
                              setTaskDraft((d) => ({ ...d, tyrePriceTier: "CUSTOMER" }))
                            }
                          />
                          Customer — {formatGbp(Number(selectedTaskTyre.sellPriceNet))}
                        </label>
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="radio"
                            name="tyrePriceTier"
                            checked={taskDraft.tyrePriceTier === "TRADE"}
                            onChange={() =>
                              setTaskDraft((d) => ({ ...d, tyrePriceTier: "TRADE" }))
                            }
                          />
                          Trade —{" "}
                          {Number(selectedTaskTyre.tradeSellPriceNet) > 0
                            ? formatGbp(Number(selectedTaskTyre.tradeSellPriceNet))
                            : "not set"}
                        </label>
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="radio"
                            name="tyrePriceTier"
                            checked={taskDraft.tyrePriceTier === "CUSTOM"}
                            onChange={() =>
                              setTaskDraft((d) => ({ ...d, tyrePriceTier: "CUSTOM" }))
                            }
                          />
                          Agreed price
                        </label>
                        {taskDraft.tyrePriceTier === "CUSTOM" && (
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={taskDraft.tyreCustomPrice}
                            onChange={(e) =>
                              setTaskDraft((d) => ({ ...d, tyreCustomPrice: e.target.value }))
                            }
                            placeholder="Unit price ex VAT"
                            className={inputClass}
                          />
                        )}
                        <p className="text-xs text-[var(--muted)]">
                          Invoice line:{" "}
                          <span className="font-medium text-[var(--foreground)]">
                            {formatGbp(taskTyreLineTotal)} ex VAT ({taskDraft.tyreQty || 1} tyre
                            {(Number(taskDraft.tyreQty) || 1) !== 1 ? "s" : ""})
                          </span>
                        </p>
                      </fieldset>
                    )}
                  </>
                ) : (
                  editingTaskHasTyre &&
                  selectedTaskTyre && (
                    <p className="text-xs text-[var(--muted)]">
                      Stock tyre: {selectedTaskTyre.size} — {selectedTaskTyre.brand || "No brand"}{" "}
                      × {taskDraft.tyreQty}. Cancel the task to return tyres to stock.
                    </p>
                  )
                )}
              </div>
            )}

            {taskModalTab === "general" && !taskDraft.useBreakdown && (
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--muted)]">
                  Total amount (ex VAT, £)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={taskDraft.amountNet}
                  onChange={(e) => setTaskDraft((d) => ({ ...d, amountNet: e.target.value }))}
                  className={inputClass}
                  placeholder="e.g. 150.00"
                  required
                />
              </div>
            )}

            {taskModalTab === "general" && (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={taskDraft.useBreakdown}
                  onChange={(e) =>
                    setTaskDraft((d) => ({
                      ...d,
                      useBreakdown: e.target.checked,
                      parts: d.parts.length ? d.parts : [emptyTaskPart()],
                    }))
                  }
                  className="h-4 w-4 rounded border border-[var(--border)]"
                />
                Split into labour and parts
              </label>
            )}

            {taskModalTab === "general" && taskDraft.useBreakdown && (
              <div className="space-y-3 rounded-lg border border-[var(--border)] p-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Labour hours</label>
                    <input
                      type="number"
                      step="0.25"
                      min="0"
                      value={taskDraft.labourHours}
                      onChange={(e) => setTaskDraft((d) => ({ ...d, labourHours: e.target.value }))}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[var(--muted)]">
                      Labour rate (ex VAT, £)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={taskDraft.labourRateNet}
                      onChange={(e) => setTaskDraft((d) => ({ ...d, labourRateNet: e.target.value }))}
                      className={inputClass}
                    />
                  </div>
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-xs font-medium text-[var(--muted)]">Parts</p>
                    <button
                      type="button"
                      onClick={() =>
                        setTaskDraft((d) => ({ ...d, parts: [...d.parts, emptyTaskPart()] }))
                      }
                      className="text-xs font-medium text-accent hover:underline"
                    >
                      + Add part
                    </button>
                  </div>
                  <div className="space-y-2">
                    {taskDraft.parts.map((part, index) => (
                      <div
                        key={index}
                        className="grid gap-2 rounded-lg bg-[var(--background)] p-2 sm:grid-cols-[1fr_5rem_6rem_auto]"
                      >
                        <input
                          value={part.description}
                          onChange={(e) =>
                            setTaskDraft((d) => ({
                              ...d,
                              parts: d.parts.map((p, i) =>
                                i === index ? { ...p, description: e.target.value } : p,
                              ),
                            }))
                          }
                          className={inputClass}
                          placeholder="Part description"
                        />
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={part.quantity}
                          onChange={(e) =>
                            setTaskDraft((d) => ({
                              ...d,
                              parts: d.parts.map((p, i) =>
                                i === index ? { ...p, quantity: e.target.value } : p,
                              ),
                            }))
                          }
                          className={inputClass}
                          placeholder="Qty"
                          aria-label="Part quantity"
                        />
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={part.unitPriceNet}
                          onChange={(e) =>
                            setTaskDraft((d) => ({
                              ...d,
                              parts: d.parts.map((p, i) =>
                                i === index ? { ...p, unitPriceNet: e.target.value } : p,
                              ),
                            }))
                          }
                          className={inputClass}
                          placeholder="Unit £"
                          aria-label="Part unit price"
                        />
                        <button
                          type="button"
                          disabled={taskDraft.parts.length === 1}
                          onClick={() =>
                            setTaskDraft((d) => ({
                              ...d,
                              parts: d.parts.filter((_, i) => i !== index),
                            }))
                          }
                          className="rounded-lg border border-[var(--border)] px-2 text-xs text-red-600 disabled:opacity-40"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <p className="text-right text-sm font-medium tabular-nums">
                  Total: {formatGbp(draftAmountNet(taskDraft))} ex VAT
                </p>
              </div>
            )}
            {editingTaskId && jobApprovedForWork && (
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Task status</label>
                <select
                  value={taskDraft.status}
                  onChange={(e) =>
                    setTaskDraft((d) => ({ ...d, status: e.target.value as RepairTaskStatus }))
                  }
                  className={inputClass}
                >
                  {Object.entries(REPAIR_TASK_STATUS_LABEL).map(([k, label]) => (
                    <option key={k} value={k}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setTaskModal(false)} className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm">
                Cancel
              </button>
              <button type="submit" disabled={saving} className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                {saving ? "Saving…" : "Save task"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      <Modal
        title="Record payment"
        open={paymentModal}
        onClose={() => setPaymentModal(false)}
        size="lg"
        autoHeight
      >
        {job?.invoiceId && (
          <form onSubmit={(e) => void savePayment(e)} className="space-y-3">
            <div className="rounded-lg bg-[var(--background)] px-3 py-2 text-sm">
              <p>
                <span className="text-[var(--muted)]">Customer </span>
                {job.customerName}
              </p>
              <p className="mt-1">
                <span className="text-[var(--muted)]">Invoice </span>
                <span className="font-medium">{job.invoiceNumber}</span>
                {job.invoiceBalanceDue && (
                  <span className="text-[var(--muted)]">
                    {" "}
                    · Balance due {formatGbp(Number(job.invoiceBalanceDue))}
                  </span>
                )}
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--muted)]">
                  Amount received (£)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  required
                  className={inputClass}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--muted)]">
                  Bank / cash account
                </label>
                <SearchableSelect
                  value={payAccountId}
                  onChange={(v) => {
                    setPayAccountId(v);
                    setPayMethod(methodForAccount(v));
                  }}
                  options={accountOptions}
                  searchPlaceholder="Search accounts…"
                  required
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--muted)]">
                  Payment method
                </label>
                <select
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value as PaymentMethod)}
                  className={inputClass}
                >
                  {PAYMENT_METHOD_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--muted)]">
                  Payment date
                </label>
                <input
                  type="date"
                  value={payDate}
                  onChange={(e) => setPayDate(e.target.value)}
                  required
                  className={inputClass}
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Reference</label>
              <input
                value={payReference}
                onChange={(e) => setPayReference(e.target.value)}
                className={inputClass}
              />
            </div>
            <p className="text-xs text-[var(--muted)]">
              Payment is allocated to this job&apos;s invoice and posted to the ledger automatically.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPaymentModal(false)}
                className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {saving ? "Saving…" : "Record payment"}
              </button>
            </div>
          </form>
        )}
      </Modal>

      <Modal
        title="Quality check sign-off"
        open={qcSignOffOpen}
        onClose={closeQcSignOff}
        autoHeight
      >
        <p className="text-sm text-[var(--muted)]">
          Confirm the vehicle has been inspected before it is released for customer collection, or
          return it to the workshop if the repair is not satisfactory.
        </p>

        {!qcSendBackMode ? (
          <>
            <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-lg border border-[var(--border)] bg-[var(--background)] p-3 text-sm">
              <input
                type="checkbox"
                checked={qcConfirmChecked}
                onChange={(e) => setQcConfirmChecked(e.target.checked)}
                disabled={saving}
                className="mt-0.5 h-4 w-4 shrink-0 rounded border border-[var(--border)]"
              />
              <span>
                I confirm the vehicle has been tested and all reported issues are resolved.
              </span>
            </label>
            <div className="mt-6 flex flex-wrap justify-between gap-2">
              <button
                type="button"
                disabled={saving}
                onClick={() => setQcSendBackMode(true)}
                className="rounded-lg border border-amber-400 px-4 py-2 text-sm font-medium text-amber-900 hover:bg-amber-50 disabled:opacity-50 dark:border-amber-700 dark:text-amber-200 dark:hover:bg-amber-950/40"
              >
                Send back for repair
              </button>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={closeQcSignOff}
                  disabled={saving}
                  className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={saving || !qcConfirmChecked}
                  onClick={() => void approveQcSignOff()}
                  className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {saving ? "Saving…" : "Mark ready for collection"}
                </button>
              </div>
            </div>
          </>
        ) : (
          <>
            {job && job.tasks.length > 0 && (
              <div className="mt-4 rounded-lg border border-[var(--border)] bg-[var(--background)] p-3">
                <p className="text-sm font-medium text-[var(--foreground)]">
                  Which tasks failed QC?
                </p>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  Select specific tasks to send back, or leave none selected to reopen all tasks.
                </p>
                <label className="mt-3 flex cursor-pointer items-center gap-2 border-b border-[var(--border)] pb-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={
                      job.tasks.length > 0 && qcFailedTaskIds.length === job.tasks.length
                    }
                    onChange={(e) => toggleQcFailedAll(e.target.checked)}
                    disabled={saving}
                    className="h-4 w-4 rounded border border-[var(--border)]"
                  />
                  Select all tasks
                </label>
                <ul className="mt-2 max-h-40 space-y-2 overflow-y-auto">
                  {job.tasks.map((task) => (
                    <li key={task.id}>
                      <label className="flex cursor-pointer items-start gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={qcFailedTaskIds.includes(task.id)}
                          onChange={() => toggleQcFailedTask(task.id)}
                          disabled={saving}
                          className="mt-0.5 h-4 w-4 shrink-0 rounded border border-[var(--border)]"
                        />
                        <span>
                          <span className="font-medium">{task.title}</span>
                          <span className="ml-2 text-xs text-[var(--muted)]">
                            {REPAIR_TASK_STATUS_LABEL[task.status]}
                            {task.assigneeName ? ` · ${task.assigneeName}` : ""}
                          </span>
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="mt-4">
              <label className="mb-1 block text-xs font-medium text-[var(--muted)]">
                What still needs to be done? (optional)
              </label>
              <textarea
                value={qcComment}
                onChange={(e) => setQcComment(e.target.value)}
                disabled={saving}
                rows={3}
                placeholder="e.g. Brake pedal still soft — re-bleed system"
                className={inputClass}
              />
            </div>
            <p className="mt-2 text-xs text-[var(--muted)]">
              The job returns to In progress. Selected tasks (or all if none selected) reopen for
              the workshop team.
            </p>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                disabled={saving}
                onClick={() => setQcSendBackMode(false)}
                className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm"
              >
                Back
              </button>
              <button
                type="button"
                onClick={closeQcSignOff}
                disabled={saving}
                className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void sendBackFromQc()}
                className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
              >
                {saving ? "Saving…" : "Return to workshop"}
              </button>
            </div>
          </>
        )}
      </Modal>

      <Modal
        title="Mark job as completed?"
        open={completeJobOpen}
        onClose={closeCompleteJobConfirm}
        autoHeight
      >
        <p className="text-sm text-[var(--muted)]">
          This closes the repair job. Only confirm when every workshop task is finished and the
          customer&apos;s reported issues are fully resolved.
        </p>

        {job && !allTasksDone && (
          <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/40">
            <p className="text-sm font-medium text-amber-950 dark:text-amber-100">
              Tasks still open
            </p>
            <p className="mt-1 text-sm text-amber-900 dark:text-amber-200/90">
              Mechanics may not have updated task status. You can mark all open tasks complete below,
              then close this job.
            </p>
            <ul className="mt-2 list-inside list-disc text-sm text-amber-900 dark:text-amber-200/90">
              {openTasks.map((t) => (
                <li key={t.id}>
                  {t.title} ({REPAIR_TASK_STATUS_LABEL[t.status]})
                </li>
              ))}
            </ul>
            <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-lg border border-amber-400/60 bg-white/60 p-3 text-sm dark:border-amber-700 dark:bg-amber-950/20">
              <input
                type="checkbox"
                checked={completeOpenTasksChecked}
                onChange={(e) => setCompleteOpenTasksChecked(e.target.checked)}
                disabled={saving}
                className="mt-0.5 h-4 w-4 shrink-0 rounded border border-[var(--border)]"
              />
              <span className="text-amber-950 dark:text-amber-100">
                Mark {openTasks.length} open task{openTasks.length === 1 ? "" : "s"} as complete
              </span>
            </label>
          </div>
        )}

        <label
          className={`mt-4 flex items-start gap-3 rounded-lg border border-[var(--border)] bg-[var(--background)] p-3 text-sm ${
            allTasksDone || completeOpenTasksChecked
              ? "cursor-pointer"
              : "cursor-not-allowed opacity-60"
          }`}
        >
          <input
            type="checkbox"
            checked={completeJobConfirmChecked}
            onChange={(e) => setCompleteJobConfirmChecked(e.target.checked)}
            disabled={saving || (!allTasksDone && !completeOpenTasksChecked)}
            className="mt-0.5 h-4 w-4 shrink-0 rounded border border-[var(--border)]"
          />
          <span>
            I confirm work is finished and all reported issues are resolved.
          </span>
        </label>

        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={closeCompleteJobConfirm}
            disabled={saving}
            className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving || !canConfirmCompleteJob}
            onClick={() => void confirmCompleteJob()}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {saving
              ? "Saving…"
              : allTasksDone
                ? "Mark job complete"
                : "Complete tasks and close job"}
          </button>
        </div>
      </Modal>

      <Modal
        title="Add parts"
        open={partsMaterialsModal}
        onClose={() => {
          if (!saving) setPartsMaterialsModal(false);
        }}
        size="2xl"
        fixedHeight
        allowFullscreen
      >
        <form
          onSubmit={(e) => void handlePartsMaterialsSubmit(e)}
          className="flex min-h-0 flex-1 flex-col"
        >
          <TabBar
            tabs={partsMaterialsTabs}
            active={activePartsMaterialsTab}
            onChange={setPartsMaterialsTab}
            className="-mx-1 shrink-0"
          />

          <div className="min-h-0 flex-1 overflow-y-auto py-4 pr-1">
            {activePartsMaterialsTab === "part-stock" && (
              <div className="space-y-4">
                {job?.vehicleMake?.trim() && job?.vehicleModel?.trim() ? (
                  <p className="text-xs text-[var(--muted)]">
                    Universal parts and those compatible with {job.vehicleMake} {job.vehicleModel}.
                  </p>
                ) : (
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    No make/model on this job — only universal stock is listed. Add vehicle details
                    on the job card to filter fitment.
                  </p>
                )}
                <div>
                  <label className="mb-1 block text-xs font-medium text-[var(--muted)]">
                    Part from inventory
                  </label>
                  <SearchableSelect
                    value={consumePartId}
                    onChange={setConsumePartId}
                    options={stockPartOptions}
                    searchPlaceholder="Search stocked parts…"
                  />
                </div>
                {consumePartStockIssue && <StockQtyAlert issue={consumePartStockIssue} />}
                <div>
                  <label className="mb-1 block text-xs font-medium text-[var(--muted)]">
                    Quantity
                    {selectedConsumePart && (
                      <span className="ml-1 font-normal text-[var(--muted)]">
                        ({selectedConsumePart.quantityOnHand} in stock)
                      </span>
                    )}
                  </label>
                  <input
                    type="number"
                    min="0.001"
                    step="any"
                    value={consumeQty}
                    onChange={(e) => setConsumeQty(e.target.value)}
                    required
                    className={inputClass}
                    aria-invalid={consumePartStockIssue?.type === "error"}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-[var(--muted)]">
                    Link to task (optional)
                  </label>
                  <p className="mb-1.5 text-xs text-[var(--muted)]">
                    For workshop reference only — customer price stays on the task.
                  </p>
                  <SearchableSelect
                    value={consumeTaskId}
                    onChange={setConsumeTaskId}
                    options={consumeTaskOptions}
                    searchPlaceholder="Search tasks…"
                  />
                </div>
                {selectedConsumePart && (
                  <p className="text-xs text-[var(--muted)]">
                    Cost: £{Number(selectedConsumePart.costPriceNet).toFixed(2)} — catalog sell: £
                    {Number(selectedConsumePart.sellPriceNet).toFixed(2)}
                  </p>
                )}
              </div>
            )}

            {activePartsMaterialsTab === "order" && (
              <div className="space-y-4">
                <p className="text-xs text-[var(--muted)]">
                  Place a supplier order for this job. Payment is recorded when you mark each part
                  received. Expense posts to the ledger when the job is completed.
                </p>
                {orderPartBlocks.map((block, index) => (
                  <fieldset
                    key={block.clientId}
                    className="space-y-3 rounded-lg border border-[var(--border)] p-4"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <legend className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                        Part {index + 1}
                      </legend>
                      {orderPartBlocks.length > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            setOrderPartBlocks((rows) =>
                              rows.filter((r) => r.clientId !== block.clientId),
                            )
                          }
                          className="text-xs font-medium text-red-600 hover:underline"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-[var(--muted)]">
                        Description <span className="text-red-600">*</span>
                      </label>
                      <input
                        value={block.description}
                        onChange={(e) =>
                          setOrderPartBlocks((rows) =>
                            rows.map((r) =>
                              r.clientId === block.clientId
                                ? { ...r, description: e.target.value }
                                : r,
                            ),
                          )
                        }
                        className={inputClass}
                        placeholder="e.g. Front brake pads — Bosch"
                        required={index === 0}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-[var(--muted)]">
                        Supplier
                      </label>
                      <SearchableSelect
                        value={block.supplierId}
                        onChange={(supplierId) =>
                          setOrderPartBlocks((rows) =>
                            rows.map((r) =>
                              r.clientId === block.clientId ? { ...r, supplierId } : r,
                            ),
                          )
                        }
                        options={[
                          { value: "", label: "Select supplier…" },
                          ...partSuppliers.map((s) => ({ value: s.id, label: s.name })),
                        ]}
                        searchPlaceholder="Search suppliers…"
                      />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-xs font-medium text-[var(--muted)]">
                          Supplier ref / part no. (optional)
                        </label>
                        <input
                          value={block.supplierRef}
                          onChange={(e) =>
                            setOrderPartBlocks((rows) =>
                              rows.map((r) =>
                                r.clientId === block.clientId
                                  ? { ...r, supplierRef: e.target.value }
                                  : r,
                              ),
                            )
                          }
                          className={inputClass}
                          placeholder="Or leave blank to auto-generate"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-[var(--muted)]">
                          Quantity
                        </label>
                        <input
                          type="number"
                          min="0.001"
                          step="any"
                          value={block.quantity}
                          onChange={(e) =>
                            setOrderPartBlocks((rows) =>
                              rows.map((r) =>
                                r.clientId === block.clientId
                                  ? { ...r, quantity: e.target.value }
                                  : r,
                              ),
                            )
                          }
                          className={inputClass}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-[var(--muted)]">
                        Link to task (optional)
                      </label>
                      <SearchableSelect
                        value={block.taskId}
                        onChange={(taskId) =>
                          setOrderPartBlocks((rows) =>
                            rows.map((r) =>
                              r.clientId === block.clientId ? { ...r, taskId } : r,
                            ),
                          )
                        }
                        options={consumeTaskOptions}
                        searchPlaceholder="Search tasks…"
                      />
                    </div>
                  </fieldset>
                ))}
                <button
                  type="button"
                  onClick={() =>
                    setOrderPartBlocks((rows) => [...rows, newOrderPartBlock()])
                  }
                  className="text-sm font-medium text-accent hover:underline"
                >
                  + Add another part
                </button>
              </div>
            )}
          </div>

          <div className="flex shrink-0 justify-end gap-2 border-t border-[var(--border)] pt-4">
            <button
              type="button"
              disabled={saving}
              onClick={() => setPartsMaterialsModal(false)}
              className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={
                saving ||
                (activePartsMaterialsTab === "part-stock" &&
                  (!consumePartId || consumePartStockIssue?.type === "error")) ||
                (activePartsMaterialsTab === "order" &&
                  !orderPartBlocks.some((b) => b.description.trim()))
              }
              className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {saving
                ? "Saving…"
                : activePartsMaterialsTab === "order"
                  ? "Place order"
                  : "Record on job"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        title="Mark part received"
        open={usageToReceive !== null}
        onClose={() => {
          if (!saving) setUsageToReceive(null);
        }}
        size="lg"
        autoHeight
      >
        {usageToReceive && (
          <form onSubmit={(e) => void submitReceiveOrdered(e)} className="space-y-4">
            <p className="text-sm text-[var(--muted)]">
              Receive <strong className="text-[var(--foreground)]">{usageToReceive.partDescription}</strong>{" "}
              (qty {usageToReceive.quantity}) onto job {job.jobNumber}. Record how you paid the
              supplier — expense posts when the job is marked complete.
            </p>
            <StockPurchaseFields
              draft={receivePurchase}
              onChange={setReceivePurchase}
              accounts={paymentAccounts}
              suppliers={partSuppliers}
              title="Supplier payment"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setUsageToReceive(null)}
                disabled={saving}
                className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {saving ? "Saving…" : "Receive & fit"}
              </button>
            </div>
          </form>
        )}
      </Modal>

      <ConfirmDialog
        open={usageToCancel !== null}
        title="Cancel order?"
        description={
          usageToCancel ? (
            <span>
              Cancel the order for{" "}
              <strong className="text-[var(--foreground)]">{usageToCancel.partDescription}</strong>?
            </span>
          ) : (
            "Cancel this order?"
          )
        }
        confirmLabel="Cancel order"
        loading={saving}
        onCancel={() => {
          if (!saving) setUsageToCancel(null);
        }}
        onConfirm={() => void cancelOrderedPart()}
      />

      <Modal
        title="Return to supplier"
        open={usageToReturn !== null && usageToReturn.source === "ORDERED" && supplierReturnDraft !== null}
        onClose={() => {
          if (!saving) {
            setUsageToReturn(null);
            setSupplierReturnDraft(null);
          }
        }}
        size="lg"
        autoHeight
      >
        {usageToReturn && supplierReturnDraft && (
          <form onSubmit={(e) => void submitSupplierReturn(e)} className="space-y-4">
            <p className="text-sm text-[var(--muted)]">
              Return <strong className="text-[var(--foreground)]">{usageToReturn.partDescription}</strong>{" "}
              (qty {usageToReturn.quantity}) — refund{" "}
              <strong>{formatGbp(partUsageCostBreakdown(usageToReturn).gross)}</strong> inc VAT.
            </p>
            <fieldset className="space-y-2">
              <legend className="text-xs font-medium text-[var(--muted)]">Refund method</legend>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="refundType"
                  checked={supplierReturnDraft.refundType === "CREDIT"}
                  onChange={() =>
                    setSupplierReturnDraft((d) => d && { ...d, refundType: "CREDIT" })
                  }
                />
                Credit on supplier account
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="refundType"
                  checked={supplierReturnDraft.refundType === "PAYMENT"}
                  onChange={() =>
                    setSupplierReturnDraft((d) => d && { ...d, refundType: "PAYMENT" })
                  }
                />
                Payment received (cash, card, transfer, etc.)
              </label>
            </fieldset>
            {supplierReturnDraft.refundType === "CREDIT" && (
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--muted)]">
                  Supplier to credit
                </label>
                <SearchableSelect
                  value={supplierReturnDraft.supplierId}
                  onChange={(supplierId) =>
                    setSupplierReturnDraft((d) => d && { ...d, supplierId })
                  }
                  options={partSuppliers.map((s) => ({
                    value: s.id,
                    label: `${s.name} (credit £${Number(s.creditBalance).toFixed(2)})`,
                  }))}
                  searchPlaceholder="Select supplier…"
                />
              </div>
            )}
            {supplierReturnDraft.refundType === "PAYMENT" && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-[var(--muted)]">
                    Received into
                  </label>
                  <SearchableSelect
                    value={supplierReturnDraft.paymentAccountId}
                    onChange={(paymentAccountId) =>
                      setSupplierReturnDraft(
                        (d) =>
                          d && {
                            ...d,
                            paymentAccountId,
                            refundMethod: methodForAccount(paymentAccountId),
                          },
                      )
                    }
                    options={paymentAccounts.map((a) => ({ value: a.id, label: a.name }))}
                    searchPlaceholder="Select account…"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-[var(--muted)]">
                    How paid
                  </label>
                  <Select
                    value={supplierReturnDraft.refundMethod}
                    onChange={(v) =>
                      setSupplierReturnDraft((d) => d && { ...d, refundMethod: v as PaymentMethod })
                    }
                    options={PAYMENT_METHOD_OPTIONS}
                  />
                </div>
              </div>
            )}
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Notes</label>
              <input
                value={supplierReturnDraft.notes}
                onChange={(e) =>
                  setSupplierReturnDraft((d) => d && { ...d, notes: e.target.value })
                }
                className={inputClass}
                placeholder="Optional reference"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setUsageToReturn(null);
                  setSupplierReturnDraft(null);
                }}
                disabled={saving}
                className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {saving ? "Saving…" : "Confirm return"}
              </button>
            </div>
          </form>
        )}
      </Modal>

      <ConfirmDialog
        open={usageToReturn !== null && usageToReturn.source !== "ORDERED"}
        title="Return part to stock?"
        description={
          usageToReturn ? (
            <span>
              Return <strong className="text-[var(--foreground)]">{usageToReturn.partNumber}</strong>{" "}
              (qty {usageToReturn.quantity}) to inventory?
            </span>
          ) : (
            "Return this part?"
          )
        }
        confirmLabel="Return to stock"
        loading={saving}
        onCancel={() => {
          if (!saving) setUsageToReturn(null);
        }}
        onConfirm={() => void returnStockPart()}
      />

      <ConfirmDialog
        open={tyreUsageToReturn !== null}
        title="Return tyre to stock?"
        description={
          tyreUsageToReturn ? (
            <span>
              Return <strong className="text-[var(--foreground)]">{tyreUsageToReturn.skuCode}</strong>{" "}
              (qty {tyreUsageToReturn.quantity}) to inventory? The invoice will update if one exists.
            </span>
          ) : (
            "Return this tyre to inventory?"
          )
        }
        confirmLabel="Return to stock"
        loading={saving}
        onCancel={() => {
          if (!saving) setTyreUsageToReturn(null);
        }}
        onConfirm={() => void returnStockTyre()}
      />

      <ConfirmDialog
        open={confirmGenerateInvoice}
        title="Generate invoice?"
        description="Create and send an invoice from this job's tasks. Record payment separately when the customer pays."
        confirmLabel="Generate"
        loading={saving}
        onCancel={() => {
          if (!saving) setConfirmGenerateInvoice(false);
        }}
        onConfirm={() => void generateInvoice()}
      />

      <ConfirmDialog
        open={confirmRefreshInvoice}
        title="Update invoice from job?"
        description={
          job ? (
            <span>
              Replace invoice lines with current job pricing. Invoice number stays{" "}
              <strong className="text-[var(--foreground)]">{job.invoiceNumber}</strong>. Job total{" "}
              {job.tasksAmountGross ? formatGbp(Number(job.tasksAmountGross)) : "—"}
              {grossAmountSuffix(chargesVat)} will replace invoice{" "}
              {job.invoiceAmountGross ? formatGbp(Number(job.invoiceAmountGross)) : "—"}
              {grossAmountSuffix(chargesVat)}.
            </span>
          ) : (
            "Replace invoice lines with current task pricing."
          )
        }
        confirmLabel="Update invoice"
        loading={saving}
        onCancel={() => {
          if (!saving) setConfirmRefreshInvoice(false);
        }}
        onConfirm={() => void refreshInvoice()}
      />

      <ConfirmDialog
        open={confirmMarkJobNotComplete}
        title="Mark job as not complete?"
        description={
          <span>
            Return this job to <strong className="text-[var(--foreground)]">In progress</strong>?
            All workshop tasks reopen for further work
            {job?.status === "TESTING"
              ? " and the job leaves Awaiting QC"
              : job?.status === "READY"
                ? " and the job leaves Ready for collection"
                : ""}
            .
          </span>
        }
        confirmLabel="Mark job not complete"
        loading={saving}
        onCancel={() => {
          if (!saving) setConfirmMarkJobNotComplete(false);
        }}
        onConfirm={() => void confirmMarkJobNotCompleteAction()}
      />

      <ConfirmDialog
        open={taskToRemove !== null}
        title="Remove task?"
        description={
          <span>
            Remove <strong className="text-[var(--foreground)]">{taskToRemove?.title}</strong> from
            this job? This cannot be undone.
          </span>
        }
        confirmLabel="Remove"
        variant="danger"
        loading={saving}
        onCancel={() => {
          if (!saving) setTaskToRemove(null);
        }}
        onConfirm={() => void confirmRemoveTask()}
      />
    </div>
  );
}
