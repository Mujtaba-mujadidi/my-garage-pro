"use client";

import { useSession } from "@/components/providers/session-provider";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Modal } from "@/components/ui/modal";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { SearchableTable, type TableColumn } from "@/components/ui/searchable-table";
import { TabBar } from "@/components/ui/tab-bar";
import { TableRowActionsMenu } from "@/components/ui/table-row-actions-menu";
import { apiFetch, ApiError, downloadAuthenticatedPdf } from "@/lib/api-client";
import { normalizeRegistration } from "@/lib/vehicle-registration";
import type { InvoiceLineDraft } from "@/components/invoices/invoice-line-fields";
import {
  emptyInvoiceWorkBlock,
  InvoiceWorkBlocks,
  type InvoiceWorkBlock,
} from "@/components/invoices/invoice-work-blocks";
import type {
  CustomerBalanceDto,
  CustomerDto,
  CustomerPaymentDto,
  InvoiceDto,
  InvoiceLineInput,
  InvoiceLineType,
  InvoiceStatus,
  PaymentAccountDto,
  PaymentMethod,
} from "@mygaragepro/shared";
import { invoiceBalanceDue, previewInvoiceTotals } from "@mygaragepro/shared";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

const STATUS_LABEL: Record<InvoiceStatus, string> = {
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

type Tab = "invoices" | "payments";

function formatMoney(value: string) {
  const n = Number(value);
  if (Number.isNaN(n)) return value;
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(n);
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function linesToPayload(lines: InvoiceLineDraft[], lineType: InvoiceLineType): InvoiceLineInput[] {
  return lines
    .filter((l) => l.description.trim() && Number(l.unitPriceNet) > 0)
    .map((l) => ({
      lineType,
      description: l.description.trim(),
      quantity: Number(l.quantity) || 1,
      unitPriceNet: Number(l.unitPriceNet),
      vatRatePercent: l.includeVat ? Number(l.vatRatePercent) || 20 : 0,
    }));
}

function draftsToPreviewLines(lines: InvoiceLineDraft[]) {
  return lines
    .filter((l) => l.description.trim() && Number(l.unitPriceNet) > 0)
    .map((l) => ({
      quantity: Number(l.quantity) || 1,
      unitPriceNet: Number(l.unitPriceNet),
      vatRatePercent: l.includeVat ? Number(l.vatRatePercent) || 20 : 0,
    }));
}

function blocksToPayload(blocks: InvoiceWorkBlock[]): InvoiceLineInput[] {
  return blocks.flatMap((b) => [
    ...linesToPayload([b.labour], "LABOUR"),
    ...linesToPayload([b.part], "PARTS"),
  ]);
}

function blocksToPreviewLines(blocks: InvoiceWorkBlock[]) {
  return blocks.flatMap((b) => [
    ...draftsToPreviewLines([b.labour]),
    ...draftsToPreviewLines([b.part]),
  ]);
}

const inputClass =
  "w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm";

export function InvoicesPageContent() {
  const { session, hasPermission } = useSession();
  const canWrite = hasPermission("invoices.write");
  const isOwner = session?.user.role === "OWNER";

  const [tab, setTab] = useState<Tab>("invoices");
  const [invoices, setInvoices] = useState<InvoiceDto[]>([]);
  const [payments, setPayments] = useState<CustomerPaymentDto[]>([]);
  const [customers, setCustomers] = useState<CustomerDto[]>([]);
  const [accounts, setAccounts] = useState<PaymentAccountDto[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [invoiceModal, setInvoiceModal] = useState(false);
  const [invoiceCustomerId, setInvoiceCustomerId] = useState("");
  const [vehicleRegistration, setVehicleRegistration] = useState("");
  const [customerVehicles, setCustomerVehicles] = useState<
    { registration: string; label: string }[]
  >([]);
  const [workBlocks, setWorkBlocks] = useState<InvoiceWorkBlock[]>([emptyInvoiceWorkBlock()]);
  const [invoiceNotes, setInvoiceNotes] = useState("");
  const [depositAmount, setDepositAmount] = useState("");
  const [sendOnCreate, setSendOnCreate] = useState(true);
  const [invoiceModalError, setInvoiceModalError] = useState("");

  const [paymentModal, setPaymentModal] = useState(false);
  const [payCustomerId, setPayCustomerId] = useState("");
  const [payAccountId, setPayAccountId] = useState("");
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState<PaymentMethod>("BANK_TRANSFER");
  const [payDate, setPayDate] = useState(todayIso());
  const [payReference, setPayReference] = useState("");
  const [openInvoices, setOpenInvoices] = useState<InvoiceDto[]>([]);
  const [allocations, setAllocations] = useState<Record<string, string>>({});
  const [customerBalance, setCustomerBalance] = useState<CustomerBalanceDto | null>(null);

  const [confirmUndoAlloc, setConfirmUndoAlloc] = useState<string | null>(null);
  const [viewInvoice, setViewInvoice] = useState<InvoiceDto | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setError("");
    try {
      const [inv, pay, cust, accts] = await Promise.all([
        apiFetch<InvoiceDto[]>("/invoices"),
        apiFetch<CustomerPaymentDto[]>("/invoices/payments"),
        apiFetch<CustomerDto[]>("/customers"),
        apiFetch<PaymentAccountDto[]>("/ledger/accounts"),
      ]);
      setInvoices(inv);
      setPayments(pay);
      setCustomers(cust);
      setAccounts(accts);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load invoices");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!invoiceCustomerId) {
      setCustomerVehicles([]);
      return;
    }
    void apiFetch<CustomerDto>(`/customers/${invoiceCustomerId}`)
      .then((c) => {
        setCustomerVehicles(
          c.vehicles.map((v) => ({
            registration: v.registration,
            label: [v.registration, v.make, v.model].filter(Boolean).join(" · "),
          })),
        );
      })
      .catch(() => setCustomerVehicles([]));
  }, [invoiceCustomerId]);

  const customerOptions = useMemo(
    () =>
      customers.map((c) => ({
        value: c.id,
        label: c.displayName,
      })),
    [customers],
  );

  const invoicePreview = useMemo(() => {
    return previewInvoiceTotals(blocksToPreviewLines(workBlocks));
  }, [workBlocks]);

  const depositPreview = Number(depositAmount) || 0;
  const balancePreview = invoiceBalanceDue(invoicePreview.amountGross, depositPreview, 0);

  const accountOptions = useMemo(
    () =>
      accounts.map((a) => ({
        value: a.id,
        label: `${a.name} (${a.type})`,
      })),
    [accounts],
  );

  async function loadPaymentContext(customerId: string) {
    if (!customerId) {
      setOpenInvoices([]);
      setCustomerBalance(null);
      setAllocations({});
      return;
    }
    const [open, balance] = await Promise.all([
      apiFetch<InvoiceDto[]>(`/invoices/customers/${customerId}/open`),
      apiFetch<CustomerBalanceDto>(`/invoices/customers/${customerId}/balance`),
    ]);
    setOpenInvoices(open);
    setCustomerBalance(balance);
    setAllocations({});
  }

  function autoAllocateOldest() {
    let remaining = Number(payAmount) || 0;
    const next: Record<string, string> = {};
    for (const inv of openInvoices) {
      if (remaining <= 0) break;
      const due = Number(inv.balanceDue);
      const alloc = Math.min(remaining, due);
      if (alloc > 0) {
        next[inv.id] = alloc.toFixed(2);
        remaining -= alloc;
      }
    }
    setAllocations(next);
  }

  async function saveInvoice(e?: FormEvent) {
    e?.preventDefault();
    setInvoiceModalError("");
    const lines = blocksToPayload(workBlocks);
    if (!invoiceCustomerId) {
      setInvoiceModalError("Select a customer.");
      return;
    }
    if (lines.length === 0) {
      setInvoiceModalError(
        "In at least one work item, add a labour or part line with a description and unit price.",
      );
      return;
    }
    if (invoicePreview.amountGross <= 0) {
      setInvoiceModalError("Invoice total must be greater than zero.");
      return;
    }
    const deposit = depositPreview;
    if (deposit < 0) {
      setInvoiceModalError("Deposit cannot be negative.");
      return;
    }
    if (deposit > invoicePreview.amountGross + 0.009) {
      setInvoiceModalError("Deposit cannot exceed the invoice total.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await apiFetch("/invoices", {
        method: "POST",
        body: JSON.stringify({
          customerId: invoiceCustomerId,
          vehicleRegistration: vehicleRegistration.trim() || undefined,
          lines,
          depositAmount: deposit > 0 ? deposit : undefined,
          notes: invoiceNotes || undefined,
          sendImmediately: sendOnCreate,
        }),
      });
      setMessage(sendOnCreate ? "Invoice created and sent." : "Draft invoice saved.");
      setInvoiceModal(false);
      setInvoiceModalError("");
      await load();
    } catch (err) {
      setInvoiceModalError(err instanceof ApiError ? err.message : "Could not create invoice");
    } finally {
      setSaving(false);
    }
  }

  async function savePayment(e: FormEvent) {
    e.preventDefault();
    const amount = Number(payAmount);
    const allocRows = Object.entries(allocations)
      .map(([invoiceId, amt]) => ({ invoiceId, amount: Number(amt) }))
      .filter((a) => a.amount > 0);
    const allocSum = allocRows.reduce((s, a) => s + a.amount, 0);

    if (!payCustomerId || !payAccountId || amount <= 0 || allocRows.length === 0) {
      setError("Customer, account, amount, and at least one allocation are required.");
      return;
    }
    if (allocSum > amount + 0.01) {
      setError("Allocations exceed payment amount.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      await apiFetch("/invoices/payments", {
        method: "POST",
        body: JSON.stringify({
          customerId: payCustomerId,
          paymentAccountId: payAccountId,
          amount,
          valueDate: payDate,
          method: payMethod,
          reference: payReference || undefined,
          allocations: allocRows,
        }),
      });
      setMessage("Payment recorded and allocated.");
      setPaymentModal(false);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not record payment");
    } finally {
      setSaving(false);
    }
  }

  async function sendInvoice(id: string) {
    try {
      await apiFetch(`/invoices/${id}/send`, { method: "POST" });
      setMessage("Invoice sent.");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Send failed");
    }
  }

  async function undoAllocation(id: string) {
    try {
      await apiFetch(`/invoices/allocations/${id}`, { method: "DELETE" });
      setMessage("Allocation removed; invoice statuses updated.");
      setConfirmUndoAlloc(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Undo failed");
    }
  }

  async function handleDownloadPdf(invoice: InvoiceDto) {
    setError("");
    try {
      await downloadAuthenticatedPdf(invoice.id, `${invoice.invoiceNumber}.pdf`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not download PDF");
    }
  }

  const invoiceColumns: TableColumn<InvoiceDto>[] = useMemo(() => {
    const cols: TableColumn<InvoiceDto>[] = [
      {
        id: "number",
        header: "Invoice",
        searchText: (r) =>
          `${r.invoiceNumber} ${r.customerName} ${r.vehicleRegistration ?? ""}`,
        cell: (r) => (
          <div>
            <p className="font-medium">{r.invoiceNumber}</p>
            <p className="text-xs text-[var(--muted)]">
              {r.customerName}
              {r.vehicleRegistration ? ` · ${r.vehicleRegistration}` : ""}
            </p>
          </div>
        ),
      },
      {
        id: "status",
        header: "Status",
        searchText: (r) => STATUS_LABEL[r.status],
        cell: (r) => STATUS_LABEL[r.status],
      },
      {
        id: "total",
        header: "Total (inc VAT)",
        align: "right",
        cell: (r) => <span className="font-mono text-sm">{formatMoney(r.amountGross)}</span>,
      },
      {
        id: "due",
        header: "Balance due",
        align: "right",
        cell: (r) => <span className="font-mono text-sm">{formatMoney(r.balanceDue)}</span>,
      },
      {
        id: "dueDate",
        header: "Due",
        cell: (r) => r.dueDate ?? "—",
      },
    ];

    cols.push({
      id: "actions",
      header: "",
      align: "right",
      cell: (r) => {
        const actions: { label: string; onClick: () => void }[] = [
          { label: "View", onClick: () => setViewInvoice(r) },
          { label: "Download PDF", onClick: () => void handleDownloadPdf(r) },
        ];
        if (canWrite && r.status === "DRAFT") {
          actions.push({ label: "Send", onClick: () => void sendInvoice(r.id) });
        }
        return (
          <TableRowActionsMenu
            triggerLabel={`Actions for ${r.invoiceNumber}`}
            actions={actions}
          />
        );
      },
    });
    return cols;
  }, [canWrite]);

  const paymentColumns: TableColumn<CustomerPaymentDto>[] = useMemo(() => {
    const cols: TableColumn<CustomerPaymentDto>[] = [
      {
        id: "date",
        header: "Date",
        cell: (r) => r.valueDate,
      },
      {
        id: "customer",
        header: "Customer",
        searchText: (r) => r.customerName,
        cell: (r) => r.customerName,
      },
      {
        id: "amount",
        header: "Amount",
        align: "right",
        cell: (r) => <span className="font-mono">{formatMoney(r.amount)}</span>,
      },
      {
        id: "account",
        header: "Account",
        cell: (r) => r.paymentAccountName,
      },
      {
        id: "alloc",
        header: "Allocated",
        cell: (r) =>
          r.allocations
            .filter((a) => !a.deletedAt)
            .map((a) => `${a.invoiceNumber}: ${formatMoney(a.amount)}`)
            .join(" · ") || "—",
      },
    ];

    if (isOwner) {
      cols.push({
        id: "undo",
        header: "",
        align: "right",
        cell: (r) => {
          const active = r.allocations.filter((a) => !a.deletedAt);
          if (active.length === 0) return null;
          return (
            <TableRowActionsMenu
              triggerLabel="Undo allocation"
              actions={active.map((a) => ({
                label: `Undo ${a.invoiceNumber} (${formatMoney(a.amount)})`,
                variant: "danger" as const,
                onClick: () => setConfirmUndoAlloc(a.id),
              }))}
            />
          );
        },
      });
    }
    return cols;
  }, [isOwner]);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Invoices</h1>
          <p className="text-sm text-[var(--muted)]">
            Customer invoices, PDF download, and multi-invoice payments.
          </p>
        </div>
        {canWrite && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setInvoiceCustomerId("");
                setVehicleRegistration("");
                setCustomerVehicles([]);
                setWorkBlocks([emptyInvoiceWorkBlock()]);
                setInvoiceNotes("");
                setDepositAmount("");
                setSendOnCreate(true);
                setInvoiceModalError("");
                setInvoiceModal(true);
              }}
              className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium"
            >
              New invoice
            </button>
            <button
              type="button"
              onClick={() => {
                setPayCustomerId("");
                setPayAccountId(accounts[0]?.id ?? "");
                setPayAmount("");
                setPayMethod("BANK_TRANSFER");
                setPayDate(todayIso());
                setPayReference("");
                setOpenInvoices([]);
                setAllocations({});
                setCustomerBalance(null);
                setPaymentModal(true);
              }}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white"
            >
              Record payment
            </button>
          </div>
        )}
      </div>

      {message && <p className="mb-3 text-sm text-green-700 dark:text-green-400">{message}</p>}
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      <TabBar
        tabs={[
          { id: "invoices", label: "Invoices" },
          { id: "payments", label: "Payments" },
        ]}
        active={tab}
        onChange={(id) => setTab(id as Tab)}
      />

      <div className="mt-4">
        {tab === "invoices" ? (
          <SearchableTable<InvoiceDto>
            columns={invoiceColumns}
            rows={invoices}
            getRowId={(r) => r.id}
            searchPlaceholder="Invoice number or customer…"
            countLabel={(f, t) => `${f} of ${t} invoices`}
            emptyLabel="No invoices yet"
          />
        ) : (
          <SearchableTable<CustomerPaymentDto>
            columns={paymentColumns}
            rows={payments}
            getRowId={(r) => r.id}
            searchPlaceholder="Customer or reference…"
            countLabel={(f, t) => `${f} of ${t} payments`}
            emptyLabel="No payments yet"
          />
        )}
      </div>

      <Modal
        title="New invoice"
        open={invoiceModal}
        onClose={() => setInvoiceModal(false)}
        size="lg"
        fixedHeight
        allowFullscreen
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void saveInvoice();
          }}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="shrink-0 space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Customer</label>
              <SearchableSelect
                value={invoiceCustomerId}
                onChange={setInvoiceCustomerId}
                options={customerOptions}
                placeholder="Select customer…"
                searchPlaceholder="Search customers…"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--muted)]">
                Vehicle registration (optional)
              </label>
              {customerVehicles.length > 0 && (
                <div className="mb-2">
                  <SearchableSelect
                    value=""
                    onChange={(v) => v && setVehicleRegistration(v)}
                    options={[
                      { value: "", label: "Choose from customer vehicles…" },
                      ...customerVehicles.map((v) => ({
                        value: v.registration,
                        label: v.label,
                      })),
                    ]}
                    searchPlaceholder="Search registrations…"
                  />
                </div>
              )}
              <input
                value={vehicleRegistration}
                onChange={(e) => setVehicleRegistration(normalizeRegistration(e.target.value))}
                placeholder="e.g. AB12CDE"
                className={inputClass}
              />
            </div>
          </div>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto py-3 pr-1">
            <InvoiceWorkBlocks
              blocks={workBlocks}
              onChange={setWorkBlocks}
              disabled={saving}
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={sendOnCreate}
                onChange={(e) => setSendOnCreate(e.target.checked)}
              />
              Send immediately (not draft)
            </label>
            <div className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                Deposit (optional)
              </p>
              <label className="mb-1 block text-xs text-[var(--muted)]">
                Amount already paid by customer (£)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                placeholder="0.00"
                className={inputClass}
                disabled={saving}
              />
              <p className="mt-1 text-xs text-[var(--muted)]">
                Record a deposit taken before this invoice. Balance due is total minus deposit.
              </p>
            </div>
            <textarea
              value={invoiceNotes}
              onChange={(e) => setInvoiceNotes(e.target.value)}
              placeholder="Notes (optional)"
              rows={2}
              className={inputClass}
            />
          </div>

          <div className="shrink-0 space-y-2 border-t border-[var(--border)] pt-3">
            {invoiceModalError && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
                {invoiceModalError}
              </p>
            )}
            <div className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-[var(--muted)]">Net</span>
                <span className="font-mono">{formatMoney(invoicePreview.amountNet.toFixed(2))}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-[var(--muted)]">VAT</span>
                <span className="font-mono">{formatMoney(invoicePreview.vatAmount.toFixed(2))}</span>
              </div>
              <div className="mt-1 flex justify-between gap-4 border-t border-[var(--border)] pt-1 font-semibold">
                <span>Invoice total</span>
                <span className="font-mono">{formatMoney(invoicePreview.amountGross.toFixed(2))}</span>
              </div>
              {depositPreview > 0 && (
                <div className="flex justify-between gap-4 text-[var(--muted)]">
                  <span>Deposit</span>
                  <span className="font-mono">−{formatMoney(depositPreview.toFixed(2))}</span>
                </div>
              )}
              <div className="mt-1 flex justify-between gap-4 border-t border-[var(--border)] pt-1 font-semibold text-accent">
                <span>Balance due</span>
                <span className="font-mono">{formatMoney(balancePreview.toFixed(2))}</span>
              </div>
            </div>
          </div>

          <div className="flex shrink-0 justify-end gap-2 pt-3">
            <button
              type="button"
              onClick={() => setInvoiceModal(false)}
              className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void saveInvoice()}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {saving ? "Saving…" : "Create"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal title="Record payment" open={paymentModal} onClose={() => setPaymentModal(false)} size="lg" autoHeight>
        <form onSubmit={(e) => void savePayment(e)} className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Customer</label>
            <SearchableSelect
              value={payCustomerId}
              onChange={(v) => {
                setPayCustomerId(v);
                void loadPaymentContext(v).catch(() => setError("Could not load open invoices"));
              }}
              options={customerOptions}
              placeholder="Select customer…"
              searchPlaceholder="Search customers…"
              required
            />
          </div>
          {customerBalance && (
            <p className="rounded-lg bg-[var(--background)] px-3 py-2 text-xs text-[var(--muted)]">
              Balance due:{" "}
              <strong className="text-[var(--foreground)]">
                {formatMoney(customerBalance.balanceDue)}
              </strong>
            </p>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Amount received (£)</label>
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
              <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Bank / cash account</label>
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
              <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Payment method</label>
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
              <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Payment date</label>
              <input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} required className={inputClass} />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Reference</label>
            <input value={payReference} onChange={(e) => setPayReference(e.target.value)} className={inputClass} />
          </div>
          {openInvoices.length > 0 && (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold">Allocate to invoices</p>
                <button type="button" className="text-xs text-accent" onClick={autoAllocateOldest}>
                  Auto-allocate oldest first
                </button>
              </div>
              <ul className="max-h-48 space-y-2 overflow-y-auto text-sm">
                {openInvoices.map((inv) => (
                  <li key={inv.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--border)] p-2">
                    <span className="min-w-[120px] font-medium">{inv.invoiceNumber}</span>
                    <span className="text-[var(--muted)]">Due {formatMoney(inv.balanceDue)}</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="£"
                      value={allocations[inv.id] ?? ""}
                      onChange={(e) =>
                        setAllocations((a) => ({ ...a, [inv.id]: e.target.value }))
                      }
                      className={`${inputClass} ml-auto max-w-[120px]`}
                    />
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setPaymentModal(false)} className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
              {saving ? "Saving…" : "Record payment"}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={confirmUndoAlloc !== null}
        title="Undo allocation?"
        description="Invoice status will be recalculated. The bank ledger entry for the full payment is not auto-reversed."
        confirmLabel="Undo"
        variant="danger"
        onConfirm={() => confirmUndoAlloc && void undoAllocation(confirmUndoAlloc)}
        onCancel={() => setConfirmUndoAlloc(null)}
      />

      <Modal
        title={viewInvoice ? viewInvoice.invoiceNumber : "Invoice"}
        open={viewInvoice !== null}
        onClose={() => setViewInvoice(null)}
        size="lg"
      >
        {viewInvoice && (
          <div className="space-y-4 text-sm">
            <div className="grid gap-2 sm:grid-cols-2">
              <p>
                <span className="text-[var(--muted)]">Customer </span>
                {viewInvoice.customerName}
              </p>
              <p>
                <span className="text-[var(--muted)]">Status </span>
                {STATUS_LABEL[viewInvoice.status]}
              </p>
              {viewInvoice.vehicleRegistration && (
                <p>
                  <span className="text-[var(--muted)]">Vehicle </span>
                  <span className="font-mono">{viewInvoice.vehicleRegistration}</span>
                </p>
              )}
              {viewInvoice.issueDate && (
                <p>
                  <span className="text-[var(--muted)]">Issued </span>
                  {viewInvoice.issueDate}
                </p>
              )}
              {viewInvoice.dueDate && (
                <p>
                  <span className="text-[var(--muted)]">Due </span>
                  {viewInvoice.dueDate}
                </p>
              )}
            </div>

            {viewInvoice.notes && (
              <p className="rounded-lg bg-[var(--background)] p-3 text-[var(--muted)]">
                {viewInvoice.notes}
              </p>
            )}

            <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
              <table className="w-full min-w-[32rem] text-left text-sm">
                <thead className="bg-[var(--background)] text-xs text-[var(--muted)]">
                  <tr>
                    <th className="px-3 py-2 font-medium">Description</th>
                    <th className="px-3 py-2 text-right font-medium">Qty</th>
                    <th className="px-3 py-2 text-right font-medium">Unit (ex VAT)</th>
                    <th className="px-3 py-2 text-right font-medium">Line total (inc VAT)</th>
                  </tr>
                </thead>
                <tbody>
                  {viewInvoice.lines.map((line) => (
                    <tr key={line.id} className="border-t border-[var(--border)]">
                      <td className="px-3 py-2">
                        <span className="text-xs uppercase text-[var(--muted)]">
                          {line.lineType === "LABOUR" ? "Labour" : "Parts"}
                        </span>
                        <p>{line.description}</p>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{line.quantity}</td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums">
                        {formatMoney(line.unitPriceNet)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums">
                        {formatMoney(line.amountGross)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <dl className="ml-auto max-w-xs space-y-1 text-right">
              <div className="flex justify-between gap-4">
                <dt className="text-[var(--muted)]">Net</dt>
                <dd className="font-mono tabular-nums">{formatMoney(viewInvoice.amountNet)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-[var(--muted)]">VAT</dt>
                <dd className="font-mono tabular-nums">{formatMoney(viewInvoice.vatAmount)}</dd>
              </div>
              <div className="flex justify-between gap-4 font-semibold">
                <dt>Total (inc VAT)</dt>
                <dd className="font-mono tabular-nums">{formatMoney(viewInvoice.amountGross)}</dd>
              </div>
              {Number(viewInvoice.depositAmount) > 0 && (
                <div className="flex justify-between gap-4">
                  <dt className="text-[var(--muted)]">Deposit</dt>
                  <dd className="font-mono tabular-nums">{formatMoney(viewInvoice.depositAmount)}</dd>
                </div>
              )}
              {Number(viewInvoice.amountPaid) > 0 && (
                <div className="flex justify-between gap-4">
                  <dt className="text-[var(--muted)]">Paid</dt>
                  <dd className="font-mono tabular-nums">{formatMoney(viewInvoice.amountPaid)}</dd>
                </div>
              )}
              <div className="flex justify-between gap-4 border-t border-[var(--border)] pt-1">
                <dt className="text-[var(--muted)]">Balance due</dt>
                <dd className="font-mono tabular-nums">{formatMoney(viewInvoice.balanceDue)}</dd>
              </div>
            </dl>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setViewInvoice(null)}
                className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => void handleDownloadPdf(viewInvoice)}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white"
              >
                Download PDF
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
