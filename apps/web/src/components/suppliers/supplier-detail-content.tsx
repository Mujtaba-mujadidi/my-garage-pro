"use client";

import {
  SupplierForm,
  emptyDraftSupplier,
  toDraftSupplier,
} from "@/components/suppliers/supplier-form";
import { useSession } from "@/components/providers/session-provider";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Modal } from "@/components/ui/modal";
import {
  STICKY_TABLE_HEAD_CLASS,
  TABLE_SCROLL_COMPACT_MAX_HEIGHT,
  TableScroll,
} from "@/components/ui/table-scroll";
import { apiFetch, ApiError } from "@/lib/api-client";
import type {
  LedgerEntryStatus,
  SupplierCreditTransactionDto,
  SupplierDto,
  SupplierPartOrderDto,
  SupplierPurchaseDto,
} from "@mygaragepro/shared";
import {
  JOB_PART_USAGE_STATUS_LABEL,
  SUPPLIER_CREDIT_TRANSACTION_LABEL,
} from "@mygaragepro/shared";
import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";

const LEDGER_STATUS_LABEL: Record<LedgerEntryStatus, string> = {
  PENDING: "Pending",
  CHECKED: "Checked",
  POSTED: "Posted",
  VOID: "Void",
};

function formatMoney(value: string) {
  const n = Number(value);
  if (Number.isNaN(n)) return value;
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(n);
}

function formatDateGb(iso: string) {
  const d = new Date(iso);
  const day = String(d.getUTCDate()).padStart(2, "0");
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const year = d.getUTCFullYear();
  return `${day}/${month}/${year}`;
}

function jobLink(
  repairJobId: string | null,
  repairJobNumber: string | null,
  bodyworkJobId: string | null,
  bodyworkJobNumber: string | null,
) {
  if (repairJobId && repairJobNumber) {
    return (
      <Link href={`/repair/${repairJobId}`} className="font-medium text-accent hover:underline">
        {repairJobNumber}
      </Link>
    );
  }
  if (bodyworkJobId && bodyworkJobNumber) {
    return (
      <Link href={`/bodywork/${bodyworkJobId}`} className="font-medium text-accent hover:underline">
        {bodyworkJobNumber}
      </Link>
    );
  }
  return "—";
}

type Props = { supplierId: string };

export function SupplierDetailContent({ supplierId }: Props) {
  const { hasPermission } = useSession();
  const canWrite = hasPermission("suppliers.write");

  const [supplier, setSupplier] = useState<SupplierDto | null>(null);
  const [partOrders, setPartOrders] = useState<SupplierPartOrderDto[]>([]);
  const [purchases, setPurchases] = useState<SupplierPurchaseDto[]>([]);
  const [creditHistory, setCreditHistory] = useState<SupplierCreditTransactionDto[]>([]);
  const [error, setError] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [draft, setDraft] = useState(emptyDraftSupplier());
  const [saving, setSaving] = useState(false);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmActivate, setConfirmActivate] = useState(false);

  const loadSupplier = useCallback(async () => {
    const data = await apiFetch<SupplierDto>(`/suppliers/${supplierId}`);
    setSupplier(data);
  }, [supplierId]);

  const loadRelated = useCallback(async () => {
    const [orders, ledgerPurchases, credits] = await Promise.all([
      apiFetch<SupplierPartOrderDto[]>(`/suppliers/${supplierId}/part-orders`),
      apiFetch<SupplierPurchaseDto[]>(`/suppliers/${supplierId}/purchases`),
      apiFetch<SupplierCreditTransactionDto[]>(`/suppliers/${supplierId}/credit-transactions`),
    ]);
    setPartOrders(orders);
    setPurchases(ledgerPurchases);
    setCreditHistory(credits);
  }, [supplierId]);

  const load = useCallback(async () => {
    setError("");
    try {
      await loadSupplier();
      await loadRelated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load supplier");
    }
  }, [loadSupplier, loadRelated]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveSupplier(e: FormEvent) {
    e.preventDefault();
    if (!draft.id) return;
    setSaving(true);
    setError("");
    try {
      const payload = {
        name: draft.name,
        email: draft.email || undefined,
        phone: draft.phone || undefined,
        addressLine1: draft.addressLine1 || undefined,
        addressLine2: draft.addressLine2 || undefined,
        city: draft.city || undefined,
        postcode: draft.postcode || undefined,
        vatNumber: draft.vatNumber || undefined,
        notes: draft.notes || undefined,
      };
      await apiFetch(`/suppliers/${draft.id}`, { method: "PATCH", body: JSON.stringify(payload) });
      setModalOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function confirmToggleStatus() {
    if (!supplier) return;
    setSaving(true);
    setError("");
    try {
      const path = confirmActivate
        ? `/suppliers/${supplier.id}/activate`
        : `/suppliers/${supplier.id}/deactivate`;
      await apiFetch(path, { method: "PATCH" });
      setConfirmOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Update failed");
    } finally {
      setSaving(false);
    }
  }

  if (!supplier && !error) {
    return <p className="text-sm text-[var(--muted)]">Loading…</p>;
  }

  if (!supplier) {
    return (
      <div>
        <p className="mb-4 text-sm text-red-600">{error}</p>
        <Link href="/suppliers" className="text-sm text-accent hover:underline">
          ← Back to suppliers
        </Link>
      </div>
    );
  }

  return (
    <>
      <p className="mb-2 text-xs text-[var(--muted)]">
        <Link href="/suppliers" className="hover:text-accent">
          Suppliers
        </Link>{" "}
        / <span className="text-accent">{supplier.name}</span>
      </p>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold">{supplier.name}</h1>
          {supplier.status === "INACTIVE" && (
            <span className="rounded-full bg-[var(--background)] px-2 py-0.5 text-xs text-[var(--muted)]">
              Inactive
            </span>
          )}
        </div>
        {canWrite && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setDraft(toDraftSupplier(supplier));
                setModalOpen(true);
              }}
              className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm font-medium hover:bg-[var(--background)]"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirmActivate(supplier.status === "INACTIVE");
                setConfirmOpen(true);
              }}
              className={
                supplier.status === "INACTIVE"
                  ? "rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white"
                  : "rounded-lg border border-red-300 px-3 py-1.5 text-sm text-red-600"
              }
            >
              {supplier.status === "INACTIVE" ? "Activate" : "Deactivate"}
            </button>
          </div>
        )}
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <section className="mb-6 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <h2 className="mb-3 text-sm font-semibold">Account credit</h2>
        <p className="text-2xl font-semibold tabular-nums">{formatMoney(supplier.creditBalance)}</p>
        {creditHistory.length > 0 ? (
          <TableScroll maxHeightClass={TABLE_SCROLL_COMPACT_MAX_HEIGHT} className="mt-4">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className={STICKY_TABLE_HEAD_CLASS}>
                <tr>
                  <th className="px-3 py-2 font-medium">Date</th>
                  <th className="px-3 py-2 font-medium">Type</th>
                  <th className="px-3 py-2 font-medium">Notes</th>
                  <th className="px-3 py-2 text-right font-medium">Amount</th>
                  <th className="px-3 py-2 text-right font-medium">Balance</th>
                </tr>
              </thead>
              <tbody>
                {creditHistory.map((tx) => (
                  <tr key={tx.id} className="border-t border-[var(--border)]">
                    <td className="px-3 py-2 text-[var(--muted)]">
                      {formatDateGb(tx.createdAt)}
                    </td>
                    <td className="px-3 py-2">{SUPPLIER_CREDIT_TRANSACTION_LABEL[tx.type]}</td>
                    <td className="px-3 py-2 text-[var(--muted)]">{tx.notes ?? "—"}</td>
                    <td
                      className={`px-3 py-2 text-right tabular-nums ${
                        Number(tx.amount) >= 0
                          ? "text-green-700 dark:text-green-400"
                          : "text-red-700 dark:text-red-400"
                      }`}
                    >
                      {Number(tx.amount) >= 0 ? "+" : ""}
                      {formatMoney(tx.amount)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatMoney(tx.balanceAfter)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        ) : (
          <p className="mt-3 text-sm text-[var(--muted)]">No credit movements yet.</p>
        )}
      </section>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 text-sm">
          <h2 className="mb-3 font-semibold">Contact</h2>
          <p>Email: {supplier.email ?? "—"}</p>
          <p>Phone: {supplier.phone ?? "—"}</p>
          <p>VAT: {supplier.vatNumber ?? "—"}</p>
          {(supplier.addressLine1 || supplier.city || supplier.postcode) && (
            <div className="mt-3">
              <p className="font-medium">Address</p>
              {supplier.addressLine1 && <p>{supplier.addressLine1}</p>}
              {supplier.addressLine2 && <p>{supplier.addressLine2}</p>}
              {(supplier.city || supplier.postcode) && (
                <p>{[supplier.city, supplier.postcode].filter(Boolean).join(", ")}</p>
              )}
            </div>
          )}
        </section>

        <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 text-sm">
          <h2 className="mb-3 font-semibold">Notes</h2>
          <p className="whitespace-pre-wrap text-[var(--muted)]">{supplier.notes ?? "—"}</p>
          <p className="mt-4 text-xs text-[var(--muted)]">
            Added {formatDateGb(supplier.createdAt)}
          </p>
        </section>
      </div>

      <section className="mb-6 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <h2 className="mb-3 text-sm font-semibold">Part orders</h2>
        {partOrders.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No part orders with this supplier yet.</p>
        ) : (
          <TableScroll maxHeightClass={TABLE_SCROLL_COMPACT_MAX_HEIGHT}>
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className={STICKY_TABLE_HEAD_CLASS}>
                <tr>
                  <th className="px-3 py-2 font-medium">Date</th>
                  <th className="px-3 py-2 font-medium">Part</th>
                  <th className="px-3 py-2 font-medium">Job</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 text-right font-medium">Qty</th>
                  <th className="px-3 py-2 text-right font-medium">Cost (inc VAT)</th>
                </tr>
              </thead>
              <tbody>
                {partOrders.map((order) => (
                  <tr key={order.id} className="border-t border-[var(--border)]">
                    <td className="px-3 py-2 text-[var(--muted)]">
                      {formatDateGb(order.orderedAt)}
                    </td>
                    <td className="px-3 py-2">
                      <div className="font-medium">{order.partNumber}</div>
                      <div className="text-xs text-[var(--muted)]">{order.partDescription}</div>
                      {order.supplierRef && (
                        <div className="text-xs text-[var(--muted)]">Ref: {order.supplierRef}</div>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {jobLink(
                        order.repairJobId,
                        order.repairJobNumber,
                        order.bodyworkJobId,
                        order.bodyworkJobNumber,
                      )}
                    </td>
                    <td className="px-3 py-2">{JOB_PART_USAGE_STATUS_LABEL[order.status]}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{order.quantity}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatMoney(order.costAmountGross)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        )}
      </section>

      <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <h2 className="mb-3 text-sm font-semibold">Purchases & payments</h2>
        {purchases.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No ledger purchases recorded for this supplier.</p>
        ) : (
          <TableScroll maxHeightClass={TABLE_SCROLL_COMPACT_MAX_HEIGHT}>
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className={STICKY_TABLE_HEAD_CLASS}>
                <tr>
                  <th className="px-3 py-2 font-medium">Date</th>
                  <th className="px-3 py-2 font-medium">Category</th>
                  <th className="px-3 py-2 font-medium">Job</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {purchases.map((purchase) => (
                  <tr key={purchase.id} className="border-t border-[var(--border)]">
                    <td className="px-3 py-2 text-[var(--muted)]">
                      {formatDateGb(purchase.valueDate)}
                    </td>
                    <td className="px-3 py-2">
                      <div>{purchase.category ?? "—"}</div>
                      {purchase.notes && (
                        <div className="text-xs text-[var(--muted)]">{purchase.notes}</div>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {jobLink(
                        purchase.repairJobId,
                        purchase.repairJobNumber,
                        purchase.bodyworkJobId,
                        purchase.bodyworkJobNumber,
                      )}
                    </td>
                    <td className="px-3 py-2">{LEDGER_STATUS_LABEL[purchase.status]}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatMoney(purchase.amountGross)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        )}
      </section>

      <Modal
        title="Edit supplier"
        open={modalOpen}
        onClose={() => {
          if (!saving) setModalOpen(false);
        }}
        size="lg"
      >
        <SupplierForm
          draft={draft}
          setDraft={setDraft}
          onSubmit={saveSupplier}
          saving={saving}
          onCancel={() => setModalOpen(false)}
        />
      </Modal>

      <ConfirmDialog
        open={confirmOpen}
        title={confirmActivate ? "Activate supplier?" : "Deactivate supplier?"}
        description={
          <span>
            {confirmActivate ? "Activate" : "Deactivate"}{" "}
            <strong className="text-[var(--foreground)]">{supplier.name}</strong>?
          </span>
        }
        confirmLabel={confirmActivate ? "Activate" : "Deactivate"}
        variant={confirmActivate ? "default" : "danger"}
        loading={saving}
        onCancel={() => {
          if (!saving) setConfirmOpen(false);
        }}
        onConfirm={() => void confirmToggleStatus()}
      />
    </>
  );
}
