"use client";

import { useSession } from "@/components/providers/session-provider";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Modal } from "@/components/ui/modal";
import { SearchableTable, type TableColumn } from "@/components/ui/searchable-table";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Select } from "@/components/ui/select";
import { TabBar } from "@/components/ui/tab-bar";
import { TableRowActionsMenu } from "@/components/ui/table-row-actions-menu";
import { apiFetch, ApiError } from "@/lib/api-client";
import type {
  LedgerEntryDto,
  LedgerEntryStatus,
  PaymentAccountDto,
  PaymentAccountType,
  SettingOptionDto,
} from "@mygaragepro/shared";
import {
  DEFAULT_VAT_RATE_OPTIONS,
  inferVatRatePercent,
  UK_STANDARD_VAT_PERCENT,
  vatFromInclusiveGross,
} from "@mygaragepro/shared";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type Tab = "accounts" | "entries";

type AccountDraft = {
  id?: string;
  name: string;
  type: PaymentAccountType;
  openingBalance: string;
  isActive: boolean;
};

type EntryDraft = {
  id?: string;
  direction: "INCOME" | "EXPENSE";
  paymentAccountId: string;
  valueDate: string;
  amountGross: string;
  vatAmount: string;
  includeVat: boolean;
  vatRatePercent: string;
  category: string;
  notes: string;
};

function recalcEntryVat(draft: EntryDraft): EntryDraft {
  if (!draft.includeVat) {
    return { ...draft, vatAmount: "0" };
  }
  const gross = Number(draft.amountGross);
  const rate = Number(draft.vatRatePercent);
  if (!Number.isFinite(gross) || gross <= 0 || !Number.isFinite(rate)) {
    return { ...draft, vatAmount: "0" };
  }
  return { ...draft, vatAmount: vatFromInclusiveGross(gross, rate).toFixed(2) };
}

function entryDraftFromRow(e: LedgerEntryDto): EntryDraft {
  const gross = Number(e.amountGross);
  const vat = Number(e.vatAmount);
  const includeVat = vat > 0;
  return {
    id: e.id,
    direction: e.direction,
    paymentAccountId: e.paymentAccountId,
    valueDate: e.valueDate,
    amountGross: e.amountGross,
    vatAmount: e.vatAmount,
    includeVat,
    vatRatePercent: includeVat ? inferVatRatePercent(gross, vat) : String(UK_STANDARD_VAT_PERCENT),
    category: e.category ?? "",
    notes: e.notes ?? "",
  };
}

const STATUS_LABEL: Record<LedgerEntryStatus, string> = {
  PENDING: "Pending",
  CHECKED: "Checked",
  POSTED: "Posted",
  VOID: "Void",
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function emptyAccountDraft(): AccountDraft {
  return { name: "", type: "BANK", openingBalance: "0", isActive: true };
}

function emptyEntryDraft(accounts: PaymentAccountDto[]): EntryDraft {
  return {
    direction: "EXPENSE",
    paymentAccountId: accounts[0]?.id ?? "",
    valueDate: todayIso(),
    amountGross: "",
    vatAmount: "0",
    includeVat: false,
    vatRatePercent: String(UK_STANDARD_VAT_PERCENT),
    category: "",
    notes: "",
  };
}

function formatMoney(value: string) {
  const n = Number(value);
  if (Number.isNaN(n)) return value;
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(n);
}

export function LedgerPageContent() {
  const { session, hasPermission } = useSession();
  const canWrite = hasPermission("ledger.write");
  const isOwner = session?.user.role === "OWNER";

  const [tab, setTab] = useState<Tab>("entries");
  const [accounts, setAccounts] = useState<PaymentAccountDto[]>([]);
  const [entries, setEntries] = useState<LedgerEntryDto[]>([]);
  const [categories, setCategories] = useState<SettingOptionDto[]>([]);
  const [vatRates, setVatRates] = useState<SettingOptionDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const [statusFilter, setStatusFilter] = useState<"" | LedgerEntryStatus>("");
  const [includeInactiveAccounts, setIncludeInactiveAccounts] = useState(false);

  const [accountModal, setAccountModal] = useState(false);
  const [accountDraft, setAccountDraft] = useState<AccountDraft>(emptyAccountDraft());

  const [entryModal, setEntryModal] = useState(false);
  const [entryDraft, setEntryDraft] = useState<EntryDraft>(emptyEntryDraft([]));

  const [confirmAction, setConfirmAction] = useState<
    | { kind: "check" | "approve" | "void" | "reverse"; entry: LedgerEntryDto }
    | null
  >(null);

  const accountSelectOptions = useMemo(
    () =>
      accounts.map((a) => ({
        value: a.id,
        label: `${a.name} (${a.type}) · ${formatMoney(a.balance)}`,
      })),
    [accounts],
  );

  const categorySelectOptions = useMemo(
    () => [
      { value: "", label: "— None —" },
      ...categories.map((c) => ({ value: c.label, label: c.label })),
    ],
    [categories],
  );

  const vatRateOptions = useMemo(() => {
    if (vatRates.length > 0) {
      return vatRates.map((r) => ({
        value: r.value,
        label: r.label,
      }));
    }
    return DEFAULT_VAT_RATE_OPTIONS.map((r) => ({ value: r.value, label: r.label }));
  }, [vatRates]);

  const entrySavePreview = useMemo(() => {
    const draft = recalcEntryVat(entryDraft);
    const gross = Number(draft.amountGross);
    if (!Number.isFinite(gross) || gross <= 0) return null;
    const vat = Number(draft.vatAmount) || 0;
    const net = (gross - vat).toFixed(2);
    return {
      gross: gross.toFixed(2),
      vat: vat.toFixed(2),
      net,
      hasVat: draft.includeVat && vat > 0,
    };
  }, [entryDraft]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const accountParams = includeInactiveAccounts ? "?includeInactive=true" : "";
      const entryParams = new URLSearchParams();
      if (statusFilter) entryParams.set("status", statusFilter);

      const [accountRows, entryRows, expenseCategories, vatRateOptions] = await Promise.all([
        apiFetch<PaymentAccountDto[]>(`/ledger/accounts${accountParams}`),
        apiFetch<LedgerEntryDto[]>(
          `/ledger/entries${entryParams.toString() ? `?${entryParams}` : ""}`,
        ),
        apiFetch<SettingOptionDto[]>("/settings?optionType=expense_category"),
        apiFetch<SettingOptionDto[]>("/settings?optionType=vat_rate"),
      ]);
      setAccounts(accountRows);
      setEntries(entryRows);
      setCategories(expenseCategories);
      setVatRates(vatRateOptions);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load ledger");
    } finally {
      setLoading(false);
    }
  }, [includeInactiveAccounts, statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveAccount(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload = {
        name: accountDraft.name.trim(),
        type: accountDraft.type,
        openingBalance: Number(accountDraft.openingBalance) || 0,
        isActive: accountDraft.isActive,
      };
      if (accountDraft.id) {
        await apiFetch(`/ledger/accounts/${accountDraft.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        setMessage("Account updated.");
      } else {
        await apiFetch("/ledger/accounts", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setMessage("Account created.");
      }
      setAccountModal(false);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function addExpenseCategory(label: string) {
    const row = await apiFetch<SettingOptionDto>("/ledger/categories", {
      method: "POST",
      body: JSON.stringify({ label }),
    });
    setCategories((prev) => {
      if (prev.some((c) => c.label.toLowerCase() === row.label.toLowerCase())) return prev;
      return [...prev, row].sort((a, b) => a.label.localeCompare(b.label));
    });
    setEntryDraft((d) => ({ ...d, category: row.label }));
    setMessage(`Category "${row.label}" added.`);
  }

  async function saveEntry(e: FormEvent) {
    e.preventDefault();
    if (!entryDraft.paymentAccountId) {
      setError("Select a payment account.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const draft = recalcEntryVat(entryDraft);
      const payload = {
        direction: draft.direction,
        paymentAccountId: draft.paymentAccountId,
        valueDate: draft.valueDate,
        amountGross: Number(draft.amountGross),
        vatAmount: Number(draft.vatAmount) || 0,
        category: entryDraft.category || undefined,
        notes: entryDraft.notes || undefined,
      };
      if (entryDraft.id) {
        await apiFetch(`/ledger/entries/${entryDraft.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        setMessage("Entry updated.");
      } else {
        await apiFetch("/ledger/entries", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setMessage("Entry submitted for approval.");
      }
      setEntryModal(false);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function runEntryAction() {
    if (!confirmAction) return;
    setSaving(true);
    setError("");
    const { kind, entry } = confirmAction;
    const paths = {
      check: `/ledger/entries/${entry.id}/check`,
      approve: `/ledger/entries/${entry.id}/approve`,
      void: `/ledger/entries/${entry.id}/void`,
      reverse: `/ledger/entries/${entry.id}/reverse`,
    };
    try {
      await apiFetch(paths[kind], { method: "POST" });
      setMessage(
        kind === "check"
          ? "Entry checked."
          : kind === "approve"
            ? "Entry posted."
            : kind === "void"
              ? "Entry voided."
              : "Reversal posted.",
      );
      setConfirmAction(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Action failed");
      setConfirmAction(null);
    } finally {
      setSaving(false);
    }
  }

  const accountColumns: TableColumn<PaymentAccountDto>[] = useMemo(() => {
    const cols: TableColumn<PaymentAccountDto>[] = [
      {
        id: "name",
        header: "Account",
        searchText: (a) => a.name,
        cell: (a) => (
          <div>
            <span className="font-medium">{a.name}</span>
            <span className="ml-2 text-xs text-[var(--muted)]">{a.type}</span>
          </div>
        ),
      },
      {
        id: "balance",
        header: "Balance",
        align: "right",
        searchText: (a) => a.balance,
        cell: (a) => <span className="font-mono text-sm">{formatMoney(a.balance)}</span>,
      },
      {
        id: "opening",
        header: "Opening",
        align: "right",
        cell: (a) => (
          <span className="text-xs text-[var(--muted)]">{formatMoney(a.openingBalance)}</span>
        ),
      },
    ];
    if (canWrite) {
      cols.push({
        id: "actions",
        header: "",
        align: "right",
        cell: (a) => (
          <TableRowActionsMenu
            triggerLabel={`Actions for ${a.name}`}
            actions={[
              {
                label: "Edit",
                onClick: () => {
                  setAccountDraft({
                    id: a.id,
                    name: a.name,
                    type: a.type,
                    openingBalance: a.openingBalance,
                    isActive: a.isActive,
                  });
                  setAccountModal(true);
                },
              },
            ]}
          />
        ),
      });
    }
    return cols;
  }, [canWrite]);

  const entryColumns: TableColumn<LedgerEntryDto>[] = useMemo(() => {
    const cols: TableColumn<LedgerEntryDto>[] = [
      {
        id: "date",
        header: "Date",
        searchText: (e) => e.valueDate,
        cell: (e) => e.valueDate,
      },
      {
        id: "account",
        header: "Account",
        searchText: (e) => e.paymentAccountName,
        cell: (e) => e.paymentAccountName,
      },
      {
        id: "type",
        header: "Type",
        cell: (e) => (
          <span className={e.direction === "INCOME" ? "text-green-700 dark:text-green-400" : ""}>
            {e.direction === "INCOME" ? "Income" : "Expense"}
          </span>
        ),
      },
      {
        id: "amount",
        header: "Amount",
        align: "right",
        cell: (e) => <span className="font-mono text-sm">{formatMoney(e.amountGross)}</span>,
      },
      {
        id: "status",
        header: "Status",
        cell: (e) => (
          <span
            className={`rounded-full px-2 py-0.5 text-xs ${
              e.status === "POSTED"
                ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300"
                : e.status === "VOID"
                  ? "bg-[var(--background)] text-[var(--muted)]"
                  : e.status === "CHECKED"
                    ? "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200"
                    : "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
            }`}
          >
            {STATUS_LABEL[e.status]}
          </span>
        ),
      },
      {
        id: "category",
        header: "Category",
        searchText: (e) => e.category ?? "",
        cell: (e) => e.category ?? "—",
      },
    ];

    if (canWrite) {
      cols.push({
        id: "actions",
        header: "",
        align: "right",
        cell: (e) => {
          const actions: { label: string; onClick: () => void; variant?: "danger" }[] = [];
          if (e.status === "PENDING") {
            actions.push({
              label: "Edit",
              onClick: () => {
                setEntryDraft(entryDraftFromRow(e));
                setEntryModal(true);
              },
            });
            actions.push({
              label: "Check",
              onClick: () => setConfirmAction({ kind: "check", entry: e }),
            });
            actions.push({
              label: "Void",
              variant: "danger",
              onClick: () => setConfirmAction({ kind: "void", entry: e }),
            });
          }
          if (e.status === "CHECKED" && isOwner) {
            actions.push({
              label: "Post",
              onClick: () => setConfirmAction({ kind: "approve", entry: e }),
            });
            actions.push({
              label: "Void",
              variant: "danger",
              onClick: () => setConfirmAction({ kind: "void", entry: e }),
            });
          }
          if (e.status === "POSTED" && isOwner && !e.reversesEntryId) {
            actions.push({
              label: "Reverse",
              variant: "danger",
              onClick: () => setConfirmAction({ kind: "reverse", entry: e }),
            });
          }
          if (actions.length === 0) return null;
          return (
            <TableRowActionsMenu
              triggerLabel={`Actions for ${e.valueDate} ${e.amountGross}`}
              actions={actions}
            />
          );
        },
      });
    }
    return cols;
  }, [canWrite, isOwner]);

  const inputClass =
    "w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)]";

  return (
    <>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mb-1 text-xs text-[var(--muted)]">
            Home / <span className="text-accent">Ledger</span>
          </p>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Ledger</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Bank & cash accounts, income and expenses with approval workflow.
          </p>
        </div>
        {canWrite && (
          <div className="flex flex-wrap gap-2">
            {tab === "accounts" && (
              <button
                type="button"
                onClick={() => {
                  setAccountDraft(emptyAccountDraft());
                  setAccountModal(true);
                }}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
              >
                Add account
              </button>
            )}
            {tab === "entries" && accounts.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setEntryDraft(emptyEntryDraft(accounts));
                  setEntryModal(true);
                }}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
              >
                New entry
              </button>
            )}
          </div>
        )}
      </div>

      {message && (
        <p className="mb-4 text-sm text-green-700 dark:text-green-400">{message}</p>
      )}
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <TabBar
        tabs={[
          { id: "entries", label: "Entries" },
          { id: "accounts", label: "Accounts" },
        ]}
        active={tab}
        onChange={setTab}
        className="mb-4"
      />

      {tab === "entries" && (
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <Select
            value={statusFilter}
            onChange={(v) => setStatusFilter(v as "" | LedgerEntryStatus)}
            placeholder="All statuses"
            options={[
              { value: "", label: "All statuses" },
              { value: "PENDING", label: "Pending" },
              { value: "CHECKED", label: "Checked" },
              { value: "POSTED", label: "Posted" },
              { value: "VOID", label: "Void" },
            ]}
            className="min-w-[10rem]"
          />
          <p className="text-xs text-[var(--muted)]">
            Pending → manager checks → owner posts. Posted entries are reversed, not edited.
          </p>
        </div>
      )}

      {tab === "accounts" && (
        <label className="mb-3 flex items-center gap-2 text-sm text-[var(--muted)]">
          <input
            type="checkbox"
            checked={includeInactiveAccounts}
            onChange={(e) => setIncludeInactiveAccounts(e.target.checked)}
          />
          Show inactive accounts
        </label>
      )}

      {loading ? (
        <p className="text-sm text-[var(--muted)]">Loading…</p>
      ) : tab === "accounts" ? (
        <SearchableTable
          rows={accounts}
          columns={accountColumns}
          getRowId={(a) => a.id}
          searchPlaceholder="Account name…"
          emptyLabel="No accounts yet — add a bank or cash account."
        />
      ) : accounts.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">Add a payment account before recording entries.</p>
      ) : (
        <SearchableTable
          rows={entries}
          columns={entryColumns}
          getRowId={(e) => e.id}
          searchPlaceholder="Category, notes, account…"
          emptyLabel="No ledger entries yet"
        />
      )}

      <Modal
        title={accountDraft.id ? "Edit account" : "Add account"}
        open={accountModal}
        onClose={() => setAccountModal(false)}
      >
        <form onSubmit={(e) => void saveAccount(e)} className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Name</label>
            <input
              value={accountDraft.name}
              onChange={(e) => setAccountDraft((d) => ({ ...d, name: e.target.value }))}
              required
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Type</label>
            <Select
              value={accountDraft.type}
              onChange={(v) => setAccountDraft((d) => ({ ...d, type: v as PaymentAccountType }))}
              options={[
                { value: "BANK", label: "Bank" },
                { value: "CASH", label: "Cash" },
              ]}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--muted)]">
              Opening balance (£)
            </label>
            <input
              type="number"
              step="0.01"
              value={accountDraft.openingBalance}
              onChange={(e) => setAccountDraft((d) => ({ ...d, openingBalance: e.target.value }))}
              className={inputClass}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={accountDraft.isActive}
              onChange={(e) => setAccountDraft((d) => ({ ...d, isActive: e.target.checked }))}
            />
            Active
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setAccountModal(false)}
              className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        title={entryDraft.id ? "Edit entry" : "New ledger entry"}
        open={entryModal}
        onClose={() => setEntryModal(false)}
        size="lg"
        autoHeight
      >
        <form onSubmit={(e) => void saveEntry(e)} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Type</label>
              <Select
                value={entryDraft.direction}
                onChange={(v) =>
                  setEntryDraft((d) => ({ ...d, direction: v as "INCOME" | "EXPENSE" }))
                }
                options={[
                  { value: "EXPENSE", label: "Expense" },
                  { value: "INCOME", label: "Income" },
                ]}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Account</label>
              <SearchableSelect
                value={entryDraft.paymentAccountId}
                onChange={(v) => setEntryDraft((d) => ({ ...d, paymentAccountId: v }))}
                required
                placeholder="Select account…"
                searchPlaceholder="Search accounts…"
                options={accountSelectOptions}
                aria-label="Payment account"
              />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Date</label>
              <input
                type="date"
                value={entryDraft.valueDate}
                onChange={(e) => setEntryDraft((d) => ({ ...d, valueDate: e.target.value }))}
                required
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Category</label>
              <SearchableSelect
                value={entryDraft.category}
                onChange={(v) => setEntryDraft((d) => ({ ...d, category: v }))}
                placeholder="Optional…"
                searchPlaceholder="Search or add category…"
                options={categorySelectOptions}
                allowCreate={canWrite}
                onCreate={async (label) => {
                  try {
                    await addExpenseCategory(label);
                  } catch (err) {
                    setError(err instanceof ApiError ? err.message : "Could not add category");
                    throw err;
                  }
                }}
                createHint={(q) => `Add category "${q}"`}
                aria-label="Expense category"
              />
              <p className="mt-1 text-xs text-[var(--muted)]">
                Defaults from setup; type a new name and choose Add, or manage all in Settings.
              </p>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--muted)]">
              {entryDraft.includeVat ? "Total amount (£, incl. VAT)" : "Amount (£, no VAT)"}
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={entryDraft.amountGross}
              onChange={(e) =>
                setEntryDraft((d) => recalcEntryVat({ ...d, amountGross: e.target.value }))
              }
              required
              className={inputClass}
            />
          </div>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={entryDraft.includeVat}
              onChange={(e) =>
                setEntryDraft((d) => recalcEntryVat({ ...d, includeVat: e.target.checked }))
              }
            />
            <span>
              <span className="font-medium">This amount includes VAT</span>
              <span className="mt-0.5 block text-xs text-[var(--muted)]">
                Most garage receipts are no VAT or cash with no VAT. Tick only when the total you
                paid includes VAT (e.g. supplier invoice). UK standard rate is 20%; change rate in
                Settings if needed.
              </span>
            </span>
          </label>
          <div
            className={`grid transition-[grid-template-rows] duration-300 ease-out ${
              entryDraft.includeVat ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
            }`}
          >
            <div className="min-h-0 overflow-hidden">
              <div className="grid gap-3 pb-1 pt-2 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-[var(--muted)]">
                    VAT rate
                  </label>
                  <Select
                    value={entryDraft.vatRatePercent}
                    onChange={(v) =>
                      setEntryDraft((d) => recalcEntryVat({ ...d, vatRatePercent: v }))
                    }
                    options={vatRateOptions}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-[var(--muted)]">
                    VAT (£, calculated)
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={entryDraft.vatAmount}
                    className={`${inputClass} bg-[var(--background)] text-[var(--muted)]`}
                  />
                </div>
              </div>
            </div>
          </div>
          {entrySavePreview ? (
            <div className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-xs">
              <p className="mb-2 font-semibold text-[var(--foreground)]">What will be saved</p>
              <dl className="space-y-1.5">
                <div className="flex justify-between gap-4">
                  <dt className="text-[var(--muted)]">
                    {entrySavePreview.hasVat ? "Total paid (incl. VAT)" : "Amount"}
                  </dt>
                  <dd className="font-mono font-medium text-[var(--foreground)]">
                    £{entrySavePreview.gross}
                  </dd>
                </div>
                {entrySavePreview.hasVat ? (
                  <div className="flex justify-between gap-4">
                    <dt className="text-[var(--muted)]">VAT</dt>
                    <dd className="font-mono font-medium text-[var(--foreground)]">
                      £{entrySavePreview.vat}
                    </dd>
                  </div>
                ) : null}
                <div className="flex justify-between gap-4 border-t border-[var(--border)] pt-1.5">
                  <dt className="text-[var(--muted)]">Net (ex VAT)</dt>
                  <dd className="font-mono font-semibold text-[var(--foreground)]">
                    £{entrySavePreview.net}
                  </dd>
                </div>
              </dl>
              <p className="mt-2 text-[var(--muted)]">
                All three values are stored. The entries list shows the{" "}
                <strong className="font-medium text-[var(--foreground)]">total</strong>
                {entrySavePreview.hasVat ? " (incl. VAT)" : ""}. When posted, the{" "}
                <strong className="font-medium text-[var(--foreground)]">net</strong> amount updates
                the account balance.
              </p>
            </div>
          ) : null}
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Notes</label>
            <textarea
              value={entryDraft.notes}
              onChange={(e) => setEntryDraft((d) => ({ ...d, notes: e.target.value }))}
              rows={2}
              className={inputClass}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setEntryModal(false)}
              className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {saving ? "Saving…" : entryDraft.id ? "Save" : "Submit"}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={confirmAction !== null}
        title={
          confirmAction?.kind === "check"
            ? "Check entry?"
            : confirmAction?.kind === "approve"
              ? "Post entry?"
              : confirmAction?.kind === "void"
                ? "Void entry?"
                : "Reverse posted entry?"
        }
        description={
          confirmAction ? (
            <span>
              {confirmAction.kind === "approve" && "This will update the account balance. "}
              {confirmAction.kind === "reverse" &&
                "A reversing entry will be posted immediately. "}
              <strong className="text-[var(--foreground)]">
                {formatMoney(confirmAction.entry.amountGross)}
              </strong>{" "}
              ({confirmAction.entry.direction === "INCOME" ? "Income" : "Expense"}) on{" "}
              {confirmAction.entry.paymentAccountName}.
            </span>
          ) : null
        }
        confirmLabel={
          confirmAction?.kind === "check"
            ? "Check"
            : confirmAction?.kind === "approve"
              ? "Post"
              : confirmAction?.kind === "void"
                ? "Void"
                : "Reverse"
        }
        variant={confirmAction?.kind === "void" || confirmAction?.kind === "reverse" ? "danger" : "default"}
        loading={saving}
        onCancel={() => !saving && setConfirmAction(null)}
        onConfirm={() => void runEntryAction()}
      />
    </>
  );
}
