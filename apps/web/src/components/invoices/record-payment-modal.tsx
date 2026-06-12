"use client";

import {
  PaymentBalanceHint,
  paymentBalanceStatus,
} from "@/components/finance/payment-balance-hint";
import { Modal } from "@/components/ui/modal";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { apiFetch, ApiError } from "@/lib/api-client";
import type {
  CustomerBalanceDto,
  InvoiceDto,
  PaymentAccountDto,
  PaymentMethod,
} from "@mygaragepro/shared";
import { defaultPaymentMethodForAccount } from "@mygaragepro/shared";
import { FormEvent, useEffect, useMemo, useState } from "react";

const PAYMENT_METHOD_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: "BANK_TRANSFER", label: "Bank transfer" },
  { value: "CARD", label: "Card" },
  { value: "CASH", label: "Cash" },
  { value: "CHEQUE", label: "Cheque" },
  { value: "OTHER", label: "Other" },
];

type PaymentSplitDraft = {
  key: string;
  paymentAccountId: string;
  method: PaymentMethod;
  amount: string;
};

function emptyPaymentSplit(accountId = "", accounts: PaymentAccountDto[] = []): PaymentSplitDraft {
  const account = accounts.find((a) => a.id === accountId);
  return {
    key: crypto.randomUUID(),
    paymentAccountId: accountId,
    method: account ? defaultPaymentMethodForAccount(account.type) : "BANK_TRANSFER",
    amount: "",
  };
}

function formatMoney(value: string) {
  const n = Number(value);
  if (Number.isNaN(n)) return value;
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(n);
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

const inputClass =
  "w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm";

type Props = {
  open: boolean;
  onClose: () => void;
  onSuccess?: (message: string) => void;
  /** When set, customer is fixed and the selector is hidden */
  fixedCustomerId?: string;
  fixedCustomerName?: string;
  customerOptions?: { value: string; label: string }[];
};

export function RecordPaymentModal({
  open,
  onClose,
  onSuccess,
  fixedCustomerId,
  fixedCustomerName,
  customerOptions = [],
}: Props) {
  const [accounts, setAccounts] = useState<PaymentAccountDto[]>([]);
  const [payCustomerId, setPayCustomerId] = useState("");
  const [paySplits, setPaySplits] = useState<PaymentSplitDraft[]>([emptyPaymentSplit()]);
  const [payDate, setPayDate] = useState(todayIso());
  const [payReference, setPayReference] = useState("");
  const [openInvoices, setOpenInvoices] = useState<InvoiceDto[]>([]);
  const [allocations, setAllocations] = useState<Record<string, string>>({});
  const [customerBalance, setCustomerBalance] = useState<CustomerBalanceDto | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [addSplitNotice, setAddSplitNotice] = useState(false);

  const accountOptions = useMemo(
    () =>
      accounts.map((a) => ({
        value: a.id,
        label: `${a.name} (${a.type})`,
      })),
    [accounts],
  );

  const payTotal = useMemo(
    () => paySplits.reduce((sum, s) => sum + (Number(s.amount) || 0), 0),
    [paySplits],
  );

  const balanceDue = useMemo(() => {
    if (customerBalance) return Number(customerBalance.balanceDue) || 0;
    return openInvoices.reduce((sum, inv) => sum + (Number(inv.balanceDue) || 0), 0);
  }, [customerBalance, openInvoices]);

  const balanceStatus = useMemo(
    () => (balanceDue > 0 ? paymentBalanceStatus(payTotal, balanceDue) : null),
    [payTotal, balanceDue],
  );

  function handleAddPaymentSplit() {
    const status = balanceDue > 0 ? paymentBalanceStatus(payTotal, balanceDue) : null;
    setAddSplitNotice(true);

    if (status?.kind === "remaining") {
      const next = emptyPaymentSplit(accounts[0]?.id ?? "", accounts);
      next.amount = status.remaining.toFixed(2);
      setPaySplits((rows) => [...rows, next]);
      return;
    }

    setPaySplits((rows) => [...rows, emptyPaymentSplit(accounts[0]?.id ?? "", accounts)]);
  }

  async function loadPaymentContext(customerId: string) {
    if (!customerId) {
      setOpenInvoices([]);
      setCustomerBalance(null);
      setAllocations({});
      return;
    }
    const [openInvs, balance] = await Promise.all([
      apiFetch<InvoiceDto[]>(`/invoices/customers/${customerId}/open`),
      apiFetch<CustomerBalanceDto>(`/invoices/customers/${customerId}/balance`),
    ]);
    setOpenInvoices(openInvs);
    setCustomerBalance(balance);
    setAllocations({});
  }

  function autoAllocateOldest() {
    let remaining = payTotal;
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

  useEffect(() => {
    if (!open) return;
    setError("");
    setAddSplitNotice(false);
    setPayDate(todayIso());
    setPayReference("");
    setAllocations({});
    const customerId = fixedCustomerId ?? "";
    setPayCustomerId(customerId);
    if (customerId) {
      void loadPaymentContext(customerId).catch(() =>
        setError("Could not load open invoices"),
      );
    } else {
      setOpenInvoices([]);
      setCustomerBalance(null);
    }
    void apiFetch<PaymentAccountDto[]>("/ledger/accounts")
      .then((accts) => {
        setAccounts(accts);
        setPaySplits([emptyPaymentSplit(accts[0]?.id ?? "", accts)]);
      })
      .catch(() => {
        setAccounts([]);
        setPaySplits([emptyPaymentSplit()]);
      });
  }, [open, fixedCustomerId]);

  async function savePayment(e: FormEvent) {
    e.preventDefault();
    const splitRows = paySplits
      .map((s) => ({
        paymentAccountId: s.paymentAccountId,
        method: s.method,
        amount: Number(s.amount),
      }))
      .filter((s) => s.paymentAccountId && s.amount > 0);
    const allocRows = Object.entries(allocations)
      .map(([invoiceId, amt]) => ({ invoiceId, amount: Number(amt) }))
      .filter((a) => a.amount > 0);
    const allocSum = allocRows.reduce((s, a) => s + a.amount, 0);
    const total = splitRows.reduce((s, r) => s + r.amount, 0);
    const customerId = fixedCustomerId ?? payCustomerId;

    if (!customerId || splitRows.length === 0 || allocRows.length === 0) {
      setError("Customer, at least one payment line, and invoice allocation are required.");
      return;
    }
    if (allocSum > total + 0.01) {
      setError("Allocations exceed total payment received.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      await apiFetch("/invoices/payments", {
        method: "POST",
        body: JSON.stringify({
          customerId,
          valueDate: payDate,
          reference: payReference || undefined,
          allocations: allocRows,
          splits: splitRows.length > 1 ? splitRows : undefined,
          paymentAccountId: splitRows.length === 1 ? splitRows[0].paymentAccountId : undefined,
          amount: splitRows.length === 1 ? splitRows[0].amount : undefined,
          method: splitRows.length === 1 ? splitRows[0].method : undefined,
        }),
      });
      onSuccess?.(
        splitRows.length > 1
          ? "Split payment recorded and allocated."
          : "Payment recorded and allocated.",
      );
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not record payment");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title="Record payment"
      open={open}
      onClose={onClose}
      size="xl"
      fixedHeight
      fixedHeightPx={720}
      allowFullscreen
    >
      <form onSubmit={(e) => void savePayment(e)} className="flex min-h-0 flex-1 flex-col gap-3">
        <div className="shrink-0 space-y-3">
          {fixedCustomerId ? (
            <div>
              <p className="mb-1 text-xs font-medium text-[var(--muted)]">Customer</p>
              <p className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm">
                {fixedCustomerName ?? fixedCustomerId}
              </p>
            </div>
          ) : (
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
          )}
          {customerBalance && (
            <p className="rounded-lg bg-[var(--background)] px-3 py-2 text-xs text-[var(--muted)]">
              Balance due:{" "}
              <strong className="text-[var(--foreground)]">
                {formatMoney(customerBalance.balanceDue)}
              </strong>
            </p>
          )}
        </div>

        <div className="flex min-h-[14rem] flex-1 flex-col overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--background)] p-3">
          <div className="mb-2 flex shrink-0 items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              Payment received
            </p>
            <button
              type="button"
              className="text-xs font-medium text-accent"
              onClick={handleAddPaymentSplit}
            >
              + Add method / account
            </button>
          </div>
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
            {paySplits.map((split) => (
              <div
                key={split.key}
                className="grid gap-2 rounded-lg border border-[var(--border)] bg-[var(--background)] p-3 sm:grid-cols-[1fr_1fr_1fr_auto]"
              >
                <div>
                  <label className="mb-1 block text-xs text-[var(--muted)]">Amount (£)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={split.amount}
                    onChange={(e) => {
                      setAddSplitNotice(false);
                      setPaySplits((rows) =>
                        rows.map((r) =>
                          r.key === split.key ? { ...r, amount: e.target.value } : r,
                        ),
                      );
                    }}
                    required
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-[var(--muted)]">Method</label>
                  <select
                    value={split.method}
                    onChange={(e) =>
                      setPaySplits((rows) =>
                        rows.map((r) =>
                          r.key === split.key
                            ? { ...r, method: e.target.value as PaymentMethod }
                            : r,
                        ),
                      )
                    }
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
                  <label className="mb-1 block text-xs text-[var(--muted)]">Account</label>
                  <SearchableSelect
                    value={split.paymentAccountId}
                    onChange={(v) => {
                      const account = accounts.find((a) => a.id === v);
                      setPaySplits((rows) =>
                        rows.map((r) =>
                          r.key === split.key
                            ? {
                                ...r,
                                paymentAccountId: v,
                                method: account
                                  ? defaultPaymentMethodForAccount(account.type)
                                  : r.method,
                              }
                            : r,
                        ),
                      );
                    }}
                    options={accountOptions}
                    searchPlaceholder="Search accounts…"
                    required
                  />
                </div>
                {paySplits.length > 1 && (
                  <div className="flex items-end">
                    <button
                      type="button"
                      className="rounded-lg border border-[var(--border)] px-2 py-2 text-xs"
                      onClick={() => {
                        setAddSplitNotice(false);
                        setPaySplits((rows) => rows.filter((r) => r.key !== split.key));
                      }}
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="mt-2 shrink-0 border-t border-[var(--border)] pt-2">
            <p className="text-xs text-[var(--muted)]">
              Total received:{" "}
              <strong className="text-[var(--foreground)]">{formatMoney(payTotal.toFixed(2))}</strong>
              {paySplits.length > 1 ? " (split across methods/accounts)" : ""}
              {balanceDue > 0 && (
                <>
                  {" "}
                  · Balance due{" "}
                  <strong className="text-[var(--foreground)]">
                    {formatMoney(balanceDue.toFixed(2))}
                  </strong>
                </>
              )}
            </p>
            {balanceStatus && (
              <div className="mt-2">
                <PaymentBalanceHint
                  status={balanceStatus}
                  addSplitNotice={addSplitNotice && paySplits.length > 1}
                />
              </div>
            )}
          </div>
        </div>

        <div className="shrink-0 space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Payment date</label>
            <input
              type="date"
              value={payDate}
              onChange={(e) => setPayDate(e.target.value)}
              required
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Reference</label>
            <input
              value={payReference}
              onChange={(e) => setPayReference(e.target.value)}
              className={inputClass}
            />
          </div>
          {openInvoices.length > 0 && (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold">Allocate to invoices</p>
                <button type="button" className="text-xs text-accent" onClick={autoAllocateOldest}>
                  Auto-allocate oldest first
                </button>
              </div>
              <ul className="space-y-2 text-sm">
                {openInvoices.map((inv) => (
                  <li
                    key={inv.id}
                    className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--border)] p-2"
                  >
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
        </div>
        <div className="shrink-0 space-y-2 border-t border-[var(--border)] pt-3">
          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
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
        </div>
      </form>
    </Modal>
  );
}
