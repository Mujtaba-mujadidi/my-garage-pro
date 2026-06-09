"use client";

import { useSession } from "@/components/providers/session-provider";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { TableRowActionsMenu } from "@/components/ui/table-row-actions-menu";
import { apiFetch, ApiError, downloadAuthenticatedPdf } from "@/lib/api-client";
import type {
  InvoiceDto,
  InvoiceStatus,
  JobPartUsageDto,
  PartDto,
  PaymentAccountDto,
  PaymentMethod,
  BodyworkAssigneeDto,
  BodyworkJobDto,
  BodyworkJobStatus,
  BodyworkTaskDto,
  BodyworkTaskStatus,
} from "@mygaragepro/shared";
import {
  allBodyworkTasksComplete,
  filterJobStatusOptionsWithoutTasks,
  isBodyworkJobApprovedForWork,
  jobStatusRequiresTasks,
  JOB_QUOTE_APPROVE_TASKS_MESSAGE,
  managerBodyworkJobStatusLabel,
  managerBodyworkJobStatusOptions,
  managerBodyworkQcJobStatusOptions,
  bodyworkMechanicTaskStatusOptions,
  bodyworkTaskAmountNet,
  bodyworkTaskBreakdownNet,
  BODYWORK_JOB_STATUS_LABEL,
  BODYWORK_TASK_STATUS_LABEL,
  isWorkshopStaffView,
  isWorkshopTaskClaimable,
  workshopTaskAssigneeLabel,
} from "@mygaragepro/shared";
import { GateLoading } from "@/components/layout/gate-loading";
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
  /** Panel or area for this line of bodywork (e.g. NSF wing, rear bumper). */
  panel: string;
  title: string;
  description: string;
  assigneeId: string;
  amountNet: string;
  useBreakdown: boolean;
  labourHours: string;
  labourRateNet: string;
  parts: TaskPartDraft[];
  status: BodyworkTaskStatus;
};

function emptyTaskPart(): TaskPartDraft {
  return { description: "", quantity: "1", unitPriceNet: "" };
}

function emptyTaskDraft(): TaskDraft {
  return {
    panel: "",
    title: "",
    description: "",
    assigneeId: "",
    amountNet: "",
    useBreakdown: false,
    labourHours: "1",
    labourRateNet: "",
    parts: [emptyTaskPart()],
    status: "AVAILABLE",
  };
}

function taskToDraft(t: BodyworkTaskDto): TaskDraft {
  return {
    panel: t.panel ?? "",
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
  };
}

function draftAmountNet(draft: TaskDraft) {
  if (draft.useBreakdown) {
    return bodyworkTaskBreakdownNet({
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

function taskAmountSummary(task: BodyworkTaskDto) {
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
  job: Pick<BodyworkJobDto, "vatEnabled">,
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

function taskStatusChip(status: BodyworkTaskStatus) {
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
      {BODYWORK_TASK_STATUS_LABEL[status]}
    </span>
  );
}

const compactSelectTriggerClass =
  "min-h-0 min-w-[9rem] py-1.5 text-sm font-normal";

const compactSelectClass =
  "w-full min-w-[9rem] rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-sm disabled:opacity-50";

type Props = { jobId: string };

export function BodyworkJobDetail({ jobId }: Props) {
  const { session, hasPermission } = useSession();
  const canWrite = hasPermission("bodywork.write");
  const canChargeVat = Boolean(session?.garage?.vatNumber?.trim());
  const canInvoice = hasPermission("invoices.write");
  const partsModuleEnabled = session?.enabledModules.includes("parts") ?? false;
  const canPartsWrite = partsModuleEnabled && hasPermission("parts.write");
  const userId = session?.user.id;

  const [job, setJob] = useState<BodyworkJobDto | null>(null);
  const [assignees, setAssignees] = useState<BodyworkAssigneeDto[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [taskModal, setTaskModal] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [taskDraft, setTaskDraft] = useState<TaskDraft>(emptyTaskDraft());
  const [assigningTaskId, setAssigningTaskId] = useState<string | null>(null);
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);
  const [taskToRemove, setTaskToRemove] = useState<BodyworkTaskDto | null>(null);
  const [confirmMarkJobNotComplete, setConfirmMarkJobNotComplete] = useState(false);
  const [completeJobOpen, setCompleteJobOpen] = useState(false);
  const [completeJobConfirmChecked, setCompleteJobConfirmChecked] = useState(false);
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
  const [consumeModal, setConsumeModal] = useState(false);
  const [consumePartId, setConsumePartId] = useState("");
  const [consumeQty, setConsumeQty] = useState("1");
  const [consumeTaskId, setConsumeTaskId] = useState("");
  const [usageToReturn, setUsageToReturn] = useState<JobPartUsageDto | null>(null);
  /** Local draft for optional vehicle paint colour code — saved to the job on blur. */
  const [colourCodeDraft, setColourCodeDraft] = useState("");

  const isWorkView = isWorkshopStaffView(session?.permissions ?? [], "bodywork");

  const load = useCallback(async () => {
    const data = await apiFetch<BodyworkJobDto>(`/bodywork-jobs/${jobId}`);
    setJob(data);
  }, [jobId]);

  useEffect(() => {
    if (job) setColourCodeDraft(job.colourCode ?? "");
  }, [job?.id, job?.colourCode]);

  useEffect(() => {
    void load().catch(() => setError("Bodywork job not found"));
    if (canWrite) {
      void apiFetch<BodyworkAssigneeDto[]>("/bodywork-jobs/assignees")
        .then(setAssignees)
        .catch(() => setAssignees([]));
    }
    if (canInvoice) {
      void apiFetch<PaymentAccountDto[]>("/ledger/accounts")
        .then(setPaymentAccounts)
        .catch(() => setPaymentAccounts([]));
    }
    if (canPartsWrite) {
      void apiFetch<PartDto[]>("/parts")
        .then(setStockPartsCatalog)
        .catch(() => setStockPartsCatalog([]));
    }
  }, [load, canWrite, canInvoice, canPartsWrite]);

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
        label: `${p.partNumber} — ${p.description} (${p.quantityOnHand} on hand)`,
      })),
    [stockPartsCatalog],
  );

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
        ? managerBodyworkQcJobStatusOptions(job.status)
        : managerBodyworkJobStatusOptions(job.status);
    if (!allBodyworkTasksComplete(job.tasks)) {
      opts = opts.filter((s) => s !== "COMPLETED");
    }
    return opts;
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
      const updated = await apiFetch<BodyworkJobDto>(`/bodywork-jobs/${jobId}`, {
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

  /** Persist optional paint colour code for the whole vehicle on this job. */
  async function saveColourCode() {
    if (!job) return;
    const next = colourCodeDraft.trim();
    const current = job.colourCode?.trim() ?? "";
    if (next === current) return;

    setSaving(true);
    setError("");
    try {
      const updated = await apiFetch<BodyworkJobDto>(`/bodywork-jobs/${jobId}`, {
        method: "PATCH",
        body: JSON.stringify({ colourCode: next || "" }),
      });
      setJob(updated);
      setMessage(next ? "Colour code saved." : "Colour code removed.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save colour code");
      setColourCodeDraft(job.colourCode ?? "");
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(
    status: BodyworkJobStatus,
    options?: { comment?: string; failedTaskIds?: string[] },
  ) {
    if (!job || job.status === status) return;
    setSaving(true);
    setError("");
    try {
      const payload: {
        status: BodyworkJobStatus;
        comment?: string;
        failedTaskIds?: string[];
      } = { status };
      const trimmed = options?.comment?.trim();
      if (trimmed) payload.comment = trimmed;
      if (options?.failedTaskIds?.length) {
        payload.failedTaskIds = options.failedTaskIds;
      }

      const updated = await apiFetch<BodyworkJobDto>(`/bodywork-jobs/${jobId}/status`, {
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
        setMessage("Job marked as completed.");
      } else {
        setMessage(`Status updated to ${BODYWORK_JOB_STATUS_LABEL[status]}.`);
      }
      closeQcSignOff();
      closeCompleteJobConfirm();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Status update failed");
    } finally {
      setSaving(false);
    }
  }

  function handleStatusSelect(status: BodyworkJobStatus) {
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
    if (!completeJobConfirmChecked || !job || !allBodyworkTasksComplete(job.tasks)) return;
    await changeStatus("COMPLETED");
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
    setTaskModal(true);
  }

  function openEditTask(task: BodyworkTaskDto) {
    setEditingTaskId(task.id);
    setTaskDraft(taskToDraft(task));
    setTaskModal(true);
  }

  async function saveTask(e: FormEvent) {
    e.preventDefault();
    if (!taskDraft.panel.trim()) {
      setError("Panel / area is required — add one panel per task.");
      return;
    }
    if (!taskDraft.title.trim()) {
      setError("Task title is required.");
      return;
    }
    if (!taskDraft.useBreakdown && !(Number(taskDraft.amountNet) > 0)) {
      setError("Enter the task total amount, or enable labour and parts breakdown.");
      return;
    }
    if (taskDraft.useBreakdown) {
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

    const approvedForAssignment = job ? isBodyworkJobApprovedForWork(job.status) : false;
    const body = {
      panel: taskDraft.panel.trim(),
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
    };
    try {
      const updated = await apiFetch<BodyworkJobDto>(
        editingTaskId
          ? `/bodywork-jobs/${jobId}/tasks/${editingTaskId}`
          : `/bodywork-jobs/${jobId}/tasks`,
        {
          method: editingTaskId ? "PATCH" : "POST",
          body: JSON.stringify(body),
        },
      );
      setJob(updated);
      setTaskModal(false);
      setMessage(editingTaskId ? "Task updated." : "Task added.");
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
      const updated = await apiFetch<BodyworkJobDto>(`/bodywork-jobs/${jobId}/tasks/${taskId}`, {
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
      const updated = await apiFetch<BodyworkJobDto>(
        `/bodywork-jobs/${jobId}/tasks/${taskId}/claim`,
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
    status: BodyworkTaskStatus,
    successMessage?: string,
  ) {
    const current = job?.tasks.find((t) => t.id === taskId);
    if (!current || current.status === status) return;

    setUpdatingTaskId(taskId);
    setError("");
    try {
      const updated = await apiFetch<BodyworkJobDto>(`/bodywork-jobs/${jobId}/tasks/${taskId}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      setJob(updated);
      setMessage(
        successMessage ?? `Task marked as ${BODYWORK_TASK_STATUS_LABEL[status].toLowerCase()}.`,
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
      const updated = await apiFetch<BodyworkJobDto>(
        `/bodywork-jobs/${jobId}/tasks/${taskToRemove.id}`,
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
      const result = await apiFetch<{ job: BodyworkJobDto; invoice: InvoiceDto }>(
        `/bodywork-jobs/${jobId}/invoice/refresh`,
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
      const result = await apiFetch<{ job: BodyworkJobDto; invoice: InvoiceDto }>(
        `/bodywork-jobs/${jobId}/invoice`,
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

  function openConsumeModal() {
    setConsumePartId("");
    setConsumeQty("1");
    setConsumeTaskId("");
    setConsumeModal(true);
  }

  async function consumeStockPart(e: FormEvent) {
    e.preventDefault();
    if (!consumePartId) return;
    setSaving(true);
    setError("");
    try {
      const updated = await apiFetch<BodyworkJobDto>(`/bodywork-jobs/${jobId}/stock-parts`, {
        method: "POST",
        body: JSON.stringify({
          partId: consumePartId,
          quantity: Number(consumeQty),
          bodyworkTaskId: consumeTaskId || undefined,
        }),
      });
      setJob(updated);
      setConsumeModal(false);
      setMessage("Part consumed from stock.");
      if (canPartsWrite) {
        void apiFetch<PartDto[]>("/parts")
          .then(setStockPartsCatalog)
          .catch(() => undefined);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not use part from stock");
    } finally {
      setSaving(false);
    }
  }

  async function returnStockPart() {
    if (!usageToReturn) return;
    setSaving(true);
    setError("");
    try {
      const updated = await apiFetch<BodyworkJobDto>(
        `/bodywork-jobs/${jobId}/stock-parts/${usageToReturn.id}/return`,
        { method: "POST" },
      );
      setJob(updated);
      setUsageToReturn(null);
      setMessage("Part returned to stock.");
      if (canPartsWrite) {
        void apiFetch<PartDto[]>("/parts")
          .then(setStockPartsCatalog)
          .catch(() => undefined);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not return part to stock");
    } finally {
      setSaving(false);
    }
  }

  function openPaymentModal() {
    if (!job?.invoiceId || !job.invoiceBalanceDue) return;
    setPayAmount(job.invoiceBalanceDue);
    setPayAccountId(paymentAccounts[0]?.id ?? "");
    setPayMethod("BANK_TRANSFER");
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
  const jobInvoicePaid = job.invoiceStatus === "PAID";
  const jobApprovedForWork = isBodyworkJobApprovedForWork(job.status);
  const canEditTasks =
    canWrite &&
    job.status !== "COMPLETED" &&
    job.status !== "CANCELLED" &&
    !jobInvoicePaid;
  const canAssignTasks =
    canEditTasks && jobApprovedForWork && !isWorkView;
  const canEditVat =
    canWrite && !isWorkView && job.status !== "CANCELLED" && !job.invoiceId;
  const canConsumeStock =
    canPartsWrite &&
    canWrite &&
    !isWorkView &&
    jobApprovedForWork &&
    job.status !== "COMPLETED" &&
    job.status !== "CANCELLED" &&
    !jobInvoicePaid;
  const showStockParts = false;

  const allTasksDone = allBodyworkTasksComplete(job.tasks);
  const canEditJobStatus =
    job.status !== "COMPLETED" && job.status !== "CANCELLED";
  const showManagerStatusSelect =
    canWrite && !isWorkView && canEditJobStatus;
  const hasTasksForQuote = job.tasks.length > 0;

  function workDetail(task: BodyworkTaskDto) {
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
        <Link href="/bodywork" className="text-sm text-accent hover:underline">
          ← {isWorkView ? "My bodywork jobs" : "Bodywork jobs"}
        </Link>
      </div>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">{job.jobNumber}</h1>
          <p className="text-sm text-[var(--muted)]">
            {job.customerName}
            {job.vehicleLabel ? ` · ${job.vehicleLabel}` : ""}
          </p>
          {job.customerConcern && (
            <p className="mt-2 text-sm">{job.customerConcern}</p>
          )}
          {job.colourCode && (isWorkView || !canWrite) && (
            <p className="mt-2 text-sm text-[var(--muted)]">
              Colour code: <span className="font-mono font-medium text-[var(--foreground)]">{job.colourCode}</span>
            </p>
          )}
        </div>
        <div className="text-right">
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
            {isWorkView ? "Job" : "Job status"}
          </p>
          {showManagerStatusSelect ? (
            <Select
              value={job.status}
              onChange={(value) => handleStatusSelect(value as BodyworkJobStatus)}
              options={managerStatusChoices.map((s) => ({
                value: s,
                label: managerBodyworkJobStatusLabel(s, job.status),
              }))}
              disabled={saving}
              aria-label="Update job status"
              className="min-w-[11rem]"
              triggerClassName="min-h-0 py-1.5 font-semibold"
            />
          ) : (
            <p className="text-sm font-semibold">{BODYWORK_JOB_STATUS_LABEL[job.status]}</p>
          )}
        </div>
      </div>

      {message && <p className="mb-3 text-sm text-green-700 dark:text-green-400">{message}</p>}
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      {canWrite && !isWorkView && !jobApprovedForWork && (
        <div className="mb-6 rounded-xl border border-violet-300 bg-violet-50 p-4 dark:border-violet-800 dark:bg-violet-950/40">
          <p className="text-sm font-semibold text-violet-950 dark:text-violet-100">
            Awaiting bodywork approval
          </p>
          <p className="mt-1 text-sm text-violet-900 dark:text-violet-200/90">
            Add each damaged panel as a task to build the quote. Approve the bodywork before assigning
            tasks to mechanics or sending work to the workshop.
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
                Approve bodywork
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
                Approve bodywork
              </button>
            </div>
          )}
        </div>
      )}

      {canWrite && !isWorkView && (
        <section className="mb-6 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <h2 className="mb-3 text-sm font-semibold">Job details</h2>
          <div className="max-w-xs">
            <label className="mb-1 block text-xs font-medium text-[var(--muted)]">
              Colour code (optional)
            </label>
            <input
              value={colourCodeDraft}
              onChange={(e) => setColourCodeDraft(e.target.value)}
              onBlur={() => void saveColourCode()}
              disabled={saving || job.status === "CANCELLED"}
              className={inputClass}
              placeholder="e.g. 2Y, 1G3"
            />
            <p className="mt-1 text-xs text-[var(--muted)]">
              Paint code for this vehicle — applies to all panels on the job. Saved when you leave the
              field.
            </p>
          </div>
        </section>
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
            All workshop tasks are complete. Inspect the vehicle, test the work, and sign off before
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
            {jobInvoicePaid && canWrite && !isWorkView && (
              <p className="mt-0.5 text-xs text-[var(--muted)]">
                Locked — invoice is paid; task amounts cannot be changed.
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
              : "No tasks yet. Add a task for each panel with a total amount per line."}
          </p>
        ) : isWorkView ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <thead className="bg-[var(--background)] text-[var(--foreground)]">
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
                      {task.panel && (
                        <p className="text-xs font-medium uppercase tracking-wide text-accent">
                          {task.panel}
                        </p>
                      )}
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
                      {isWorkshopTaskClaimable(task, job.status, "bodywork") ? (
                        <button
                          type="button"
                          disabled={saving || jobInvoicePaid}
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
                            void updateTaskStatus(task.id, value as BodyworkTaskStatus)
                          }
                          options={bodyworkMechanicTaskStatusOptions(task.status).map((s) => ({
                            value: s,
                            label: BODYWORK_TASK_STATUS_LABEL[s],
                          }))}
                          disabled={updatingTaskId === task.id || saving || jobInvoicePaid}
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
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[44rem] text-left text-sm">
              <thead className="bg-[var(--background)] text-[var(--foreground)]">
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
                  const lineNet = bodyworkTaskAmountNet(task);
                  const summary = taskAmountSummary(task);
                  return (
                    <tr key={task.id} className="border-t border-[var(--border)] hover:bg-[var(--background)]">
                      <td className="px-4 py-3 align-top">
                        {task.panel && (
                          <p className="text-xs font-medium uppercase tracking-wide text-accent">
                            {task.panel}
                          </p>
                        )}
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
              {job.tasks.some((t) => bodyworkTaskAmountNet(t) > 0) && (() => {
                const tasksNet = job.tasks.reduce((sum, t) => sum + bodyworkTaskAmountNet(t), 0);
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
          </div>
        )}
      </section>

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
              <label className="mb-1 block text-xs font-medium text-[var(--muted)]">
                Panel / area <span className="text-red-600">*</span>
              </label>
              <input
                value={taskDraft.panel}
                onChange={(e) => {
                  const panel = e.target.value;
                  setTaskDraft((d) => ({
                    ...d,
                    panel,
                    // Suggest a title from the panel when the user has not typed one yet.
                    title:
                      !d.title.trim() || d.title.trim() === d.panel.trim()
                        ? panel
                        : d.title,
                  }));
                }}
                required
                className={inputClass}
                placeholder="e.g. NSF wing, rear bumper"
              />
              <p className="mt-1 text-xs text-[var(--muted)]">
                One panel per task — add another task for each additional area.
              </p>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Title</label>
              <input
                value={taskDraft.title}
                onChange={(e) => setTaskDraft((d) => ({ ...d, title: e.target.value }))}
                required
                className={inputClass}
                placeholder="e.g. Repair & paint NSF wing"
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
                Approve the bodywork before assigning tasks to mechanics.
              </p>
            )}

            {!taskDraft.useBreakdown && (
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

            {taskDraft.useBreakdown && (
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
                    setTaskDraft((d) => ({ ...d, status: e.target.value as BodyworkTaskStatus }))
                  }
                  className={inputClass}
                >
                  {Object.entries(BODYWORK_TASK_STATUS_LABEL).map(([k, label]) => (
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
                  onChange={setPayAccountId}
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
          return it to the workshop if the work is not satisfactory.
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
                Send back for rework
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
                          {task.panel && (
                            <span className="mr-2 text-xs font-medium uppercase text-accent">
                              {task.panel}
                            </span>
                          )}
                          <span className="font-medium">{task.title}</span>
                          <span className="ml-2 text-xs text-[var(--muted)]">
                            {BODYWORK_TASK_STATUS_LABEL[task.status]}
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
          This closes the bodywork job. Only confirm when every workshop task is finished and the
          customer&apos;s reported issues are fully resolved.
        </p>

        {job && !allTasksDone && (
          <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/40">
            <p className="text-sm font-medium text-amber-950 dark:text-amber-100">
              Tasks still open
            </p>
            <p className="mt-1 text-sm text-amber-900 dark:text-amber-200/90">
              Complete or cancel every task before closing this job.
            </p>
            <ul className="mt-2 list-inside list-disc text-sm text-amber-900 dark:text-amber-200/90">
              {job.tasks
                .filter((t) => t.status !== "COMPLETED" && t.status !== "CANCELLED")
                .map((t) => (
                  <li key={t.id}>
                    {t.title} ({BODYWORK_TASK_STATUS_LABEL[t.status]})
                  </li>
                ))}
            </ul>
          </div>
        )}

        <label
          className={`mt-4 flex items-start gap-3 rounded-lg border border-[var(--border)] bg-[var(--background)] p-3 text-sm ${
            allTasksDone ? "cursor-pointer" : "cursor-not-allowed opacity-60"
          }`}
        >
          <input
            type="checkbox"
            checked={completeJobConfirmChecked}
            onChange={(e) => setCompleteJobConfirmChecked(e.target.checked)}
            disabled={saving || !allTasksDone}
            className="mt-0.5 h-4 w-4 shrink-0 rounded border border-[var(--border)]"
          />
          <span>
            I confirm all tasks are completed and all reported issues are resolved.
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
            disabled={saving || !completeJobConfirmChecked || !allTasksDone}
            onClick={() => void confirmCompleteJob()}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {saving ? "Saving…" : "Mark job complete"}
          </button>
        </div>
      </Modal>

      <Modal
        title="Use part from stock"
        open={consumeModal}
        onClose={() => {
          if (!saving) setConsumeModal(false);
        }}
      >
        <form onSubmit={(e) => void consumeStockPart(e)} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Part</label>
            <SearchableSelect
              value={consumePartId}
              onChange={setConsumePartId}
              options={stockPartOptions}
              searchPlaceholder="Search parts…"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Quantity</label>
            <input
              type="number"
              min="0.001"
              step="0.001"
              value={consumeQty}
              onChange={(e) => setConsumeQty(e.target.value)}
              required
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--muted)]">
              Link to task (optional)
            </label>
            <SearchableSelect
              value={consumeTaskId}
              onChange={setConsumeTaskId}
              options={consumeTaskOptions}
              searchPlaceholder="Search tasks…"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={() => setConsumeModal(false)}
              className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !consumePartId}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {saving ? "Saving…" : "Use on job"}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={usageToReturn !== null}
        title="Return part to stock?"
        description={
          usageToReturn ? (
            <span>
              Return <strong className="text-[var(--foreground)]">{usageToReturn.partNumber}</strong>{" "}
              (qty {usageToReturn.quantity}) to inventory? The invoice will update if one exists.
            </span>
          ) : (
            "Return this part to inventory?"
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
