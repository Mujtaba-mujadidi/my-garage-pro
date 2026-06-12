"use client";

import { useSession } from "@/components/providers/session-provider";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Modal } from "@/components/ui/modal";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { SearchableTable, type TableColumn } from "@/components/ui/searchable-table";
import { TableRowActionsMenu } from "@/components/ui/table-row-actions-menu";
import { apiFetch, ApiError } from "@/lib/api-client";
import {
  emptyStockPaymentDraft,
  stockPurchaseApiPayloadFromBuyPrice,
  type StockPaymentDraft,
} from "@/components/finance/stock-purchase-fields";
import { TyreStockPurchaseFields } from "@/components/tyres/tyre-stock-purchase-fields";
import type { CustomerDto, PaymentAccountDto, SupplierDto, TyreDto } from "@mygaragepro/shared";
import {
  UK_STANDARD_VAT_PERCENT,
  defaultPaymentMethodForAccount,
  grossFromNet,
  previewTyreCode,
} from "@mygaragepro/shared";
import { FormEvent, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

type DraftTyre = {
  id?: string;
  skuCode: string;
  size: string;
  brand: string;
  supplierId: string;
  costPriceNet: string;
  sellPriceNet: string;
  tradeSellPriceNet: string;
  minQuantity: string;
  quantityOnHand: string;
};

type DraftSupplier = {
  name: string;
  email: string;
  phone: string;
};

function emptyDraft(): DraftTyre {
  return {
    skuCode: "",
    size: "",
    brand: "",
    supplierId: "",
    costPriceNet: "",
    sellPriceNet: "",
    tradeSellPriceNet: "",
    minQuantity: "",
    quantityOnHand: "",
  };
}

function emptySupplierDraft(): DraftSupplier {
  return { name: "", email: "", phone: "" };
}

function toDraft(t: TyreDto): DraftTyre {
  return {
    id: t.id,
    skuCode: t.skuCode,
    size: t.size,
    brand: t.brand ?? "",
    supplierId: t.supplierId ?? "",
    costPriceNet: t.costPriceNet,
    sellPriceNet: t.sellPriceNet,
    tradeSellPriceNet: t.tradeSellPriceNet,
    minQuantity: t.minQuantity,
    quantityOnHand: t.quantityOnHand,
  };
}

function formatGbp(amount: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(amount);
}

const inputClass =
  "w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm";

const readOnlyClass =
  "w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--muted)]";

function FormSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3 border-t border-[var(--border)] pt-4 first:border-t-0 first:pt-0">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--foreground)]">{title}</h3>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </section>
  );
}

export function TyresPageContent() {
  const { hasPermission } = useSession();
  const canWrite = hasPermission("tyres.write");
  const canSell = canWrite && hasPermission("invoices.write");
  const canCreateSupplier = hasPermission("suppliers.write");

  const [rows, setRows] = useState<TyreDto[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierDto[]>([]);
  const [customers, setCustomers] = useState<CustomerDto[]>([]);
  const [accounts, setAccounts] = useState<PaymentAccountDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [lowStockOnly, setLowStockOnly] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [draft, setDraft] = useState<DraftTyre>(emptyDraft());
  const [saving, setSaving] = useState(false);

  const [supplierModalOpen, setSupplierModalOpen] = useState(false);
  const [supplierDraft, setSupplierDraft] = useState<DraftSupplier>(emptySupplierDraft());
  const [supplierSaving, setSupplierSaving] = useState(false);
  const [supplierNotice, setSupplierNotice] = useState("");

  const [receiveOpen, setReceiveOpen] = useState(false);
  const [receiveTarget, setReceiveTarget] = useState<TyreDto | null>(null);
  const [receiveQty, setReceiveQty] = useState("1");
  const [receiveBuyPrice, setReceiveBuyPrice] = useState("");
  const [receiveIncludeVat, setReceiveIncludeVat] = useState(false);
  const [receivePayment, setReceivePayment] = useState<StockPaymentDraft>(
    emptyStockPaymentDraft([]),
  );
  const [createPayment, setCreatePayment] = useState<StockPaymentDraft>(
    emptyStockPaymentDraft([]),
  );
  const [buyPriceIncludesVat, setBuyPriceIncludesVat] = useState(false);

  const [saleOpen, setSaleOpen] = useState(false);
  const [saleTyre, setSaleTyre] = useState<TyreDto | null>(null);
  const [saleCustomerId, setSaleCustomerId] = useState("");
  const [saleQty, setSaleQty] = useState("1");
  const [salePrice, setSalePrice] = useState("");
  const [salePayNow, setSalePayNow] = useState(false);
  const [saleAccountId, setSaleAccountId] = useState("");

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<TyreDto | null>(null);

  const previewCode = useMemo(() => {
    if (draft.id) return draft.skuCode;
    if (!draft.size.trim()) return "";
    return previewTyreCode(draft.size, draft.brand || null);
  }, [draft.id, draft.skuCode, draft.size, draft.brand]);

  const unitBuyPrice = Number(draft.costPriceNet) || 0;
  const openingQty = Number(draft.quantityOnHand) || 0;

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = lowStockOnly ? "?lowStock=true" : "";
      setRows(await apiFetch<TyreDto[]>(`/tyres${params}`));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load tyres");
    } finally {
      setLoading(false);
    }
  }, [lowStockOnly]);

  const loadSuppliers = useCallback(async () => {
    const data = await apiFetch<SupplierDto[]>("/suppliers").catch(() => []);
    setSuppliers(data);
    return data;
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!canWrite) return;
    void loadSuppliers();
    void Promise.all([
      apiFetch<CustomerDto[]>("/customers").catch(() => []),
      apiFetch<PaymentAccountDto[]>("/ledger/accounts").catch(() => []),
    ]).then(([c, a]) => {
      setCustomers(c);
      setAccounts(a);
      setCreatePayment(emptyStockPaymentDraft(a));
      setReceivePayment(emptyStockPaymentDraft(a));
    });
  }, [canWrite, loadSuppliers]);

  const supplierOptions = useMemo(
    () => [{ value: "", label: "No supplier" }, ...suppliers.map((s) => ({ value: s.id, label: s.name }))],
    [suppliers],
  );
  const customerOptions = useMemo(
    () => customers.map((c) => ({ value: c.id, label: c.displayName })),
    [customers],
  );
  const accountOptions = useMemo(
    () => accounts.map((a) => ({ value: a.id, label: a.name })),
    [accounts],
  );

  const columns: TableColumn<TyreDto>[] = useMemo(() => {
    const cols: TableColumn<TyreDto>[] = [
      {
        id: "code",
        header: "Tyre code",
        searchText: (t) => [t.skuCode, t.size, t.brand ?? ""].join(" "),
        cell: (t) => (
          <div>
            <div className="font-medium">{t.skuCode}</div>
            <div className="text-xs text-[var(--muted)]">{t.size}</div>
          </div>
        ),
      },
      {
        id: "brand",
        header: "Brand",
        cell: (t) => t.brand ?? "—",
      },
      {
        id: "stock",
        header: "On hand",
        cell: (t) => (
          <span className={t.isLowStock ? "font-semibold text-amber-700 dark:text-amber-300" : "tabular-nums"}>
            {t.quantityOnHand}
            {t.isLowStock && (
              <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                Low
              </span>
            )}
          </span>
        ),
      },
      {
        id: "reorder",
        header: "Reorder",
        cell: (t) => <span className="tabular-nums">{t.minQuantity}</span>,
      },
      {
        id: "cost",
        header: "Cost (ex VAT)",
        cell: (t) => formatGbp(Number(t.costPriceNet)),
      },
      {
        id: "retail",
        header: "Customer (incl. fitting)",
        cell: (t) => formatGbp(Number(t.sellPriceNet)),
      },
      {
        id: "trade",
        header: "Trade (incl. fitting)",
        cell: (t) => formatGbp(Number(t.tradeSellPriceNet)),
      },
    ];

    if (canWrite) {
      cols.push({
        id: "actions",
        header: "",
        align: "right",
        cell: (t) => (
          <TableRowActionsMenu
            triggerLabel={`Actions for ${t.skuCode}`}
            actions={[
              ...(canSell
                ? [
                    {
                      label: "Counter sale",
                      onClick: () => {
                        setSaleTyre(t);
                        setSaleCustomerId("");
                        setSaleQty("1");
                        setSalePrice(t.sellPriceNet);
                        setSalePayNow(false);
                        setSaleAccountId(accounts[0]?.id ?? "");
                        setSaleOpen(true);
                      },
                    },
                  ]
                : []),
              {
                label: "Receive stock",
                onClick: () => {
                  setReceiveTarget(t);
                  setReceiveQty("1");
                  setReceiveBuyPrice(t.costPriceNet);
                  setReceiveIncludeVat(false);
                  setReceivePayment(emptyStockPaymentDraft(accounts));
                  setReceiveOpen(true);
                },
              },
              {
                label: "Edit",
                onClick: () => {
                  setDraft(toDraft(t));
                  setModalOpen(true);
                },
              },
              {
                label: t.status === "INACTIVE" ? "Activate" : "Deactivate",
                variant: t.status === "INACTIVE" ? "default" : "danger",
                onClick: () => {
                  setConfirmTarget(t);
                  setConfirmOpen(true);
                },
              },
            ]}
          />
        ),
      });
    }

    return cols;
  }, [canWrite, canSell, accounts]);

  async function saveNewSupplier(e: FormEvent) {
    e.preventDefault();
    if (!supplierDraft.name.trim()) return;
    setSupplierSaving(true);
    setSupplierNotice("");
    try {
      const supplier = await apiFetch<SupplierDto>("/suppliers", {
        method: "POST",
        body: JSON.stringify({
          name: supplierDraft.name.trim(),
          email: supplierDraft.email.trim() || undefined,
          phone: supplierDraft.phone.trim() || undefined,
        }),
      });
      const refreshed = await loadSuppliers();
      const list = refreshed.some((s) => s.id === supplier.id)
        ? refreshed
        : [...refreshed, supplier].sort((a, b) => a.name.localeCompare(b.name));
      setSuppliers(list);
      setDraft((d) => ({ ...d, supplierId: supplier.id }));
      setSupplierModalOpen(false);
      setSupplierDraft(emptySupplierDraft());
    } catch (err) {
      setSupplierNotice(err instanceof ApiError ? err.message : "Could not save supplier");
    } finally {
      setSupplierSaving(false);
    }
  }

  async function saveTyre(e: FormEvent) {
    e.preventDefault();
    if (!draft.size.trim()) {
      setError("Tyre size is required");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const isCreate = !draft.id;
      const qty = Number(draft.quantityOnHand) || 0;
      const purchaseFromBuyPrice =
        isCreate && qty > 0
          ? stockPurchaseApiPayloadFromBuyPrice({
              unitBuyPrice,
              includesVat: buyPriceIncludesVat,
              quantity: qty,
              supplierId: draft.supplierId,
              payment: createPayment,
            })
          : null;

      const payload = {
        size: draft.size.trim(),
        brand: draft.brand.trim() || undefined,
        supplierId: draft.supplierId || undefined,
        costPriceNet: purchaseFromBuyPrice
          ? purchaseFromBuyPrice.costPriceNet
          : Number(draft.costPriceNet) || 0,
        sellPriceNet: Number(draft.sellPriceNet) || 0,
        tradeSellPriceNet: Number(draft.tradeSellPriceNet) || 0,
        minQuantity: Number(draft.minQuantity) || 0,
        quantityOnHand: qty,
        ...(purchaseFromBuyPrice
          ? (({ costPriceNet: _c, ...purchase }) => purchase)(purchaseFromBuyPrice)
          : {}),
      };

      if (draft.id) {
        const { quantityOnHand: _q, ...updatePayload } = payload;
        await apiFetch(`/tyres/${draft.id}`, { method: "PATCH", body: JSON.stringify(updatePayload) });
      } else {
        await apiFetch("/tyres", { method: "POST", body: JSON.stringify(payload) });
      }

      setModalOpen(false);
      setDraft(emptyDraft());
      setBuyPriceIncludesVat(false);
      setCreatePayment(emptyStockPaymentDraft(accounts));
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function confirmReceive(e: FormEvent) {
    e.preventDefault();
    if (!receiveTarget) return;
    setSaving(true);
    try {
      const qty = Number(receiveQty) || 0;
      const unitPrice = Number(receiveBuyPrice) || 0;
      const purchase = stockPurchaseApiPayloadFromBuyPrice({
        unitBuyPrice: unitPrice,
        includesVat: receiveIncludeVat,
        quantity: qty,
        supplierId: receiveTarget.supplierId ?? "",
        payment: receivePayment,
      });
      const { costPriceNet: _c, ...purchasePayload } = purchase;
      await apiFetch(`/tyres/${receiveTarget.id}/receive`, {
        method: "POST",
        body: JSON.stringify({
          quantity: qty,
          ...purchasePayload,
        }),
      });
      setReceiveOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Receive failed");
    } finally {
      setSaving(false);
    }
  }

  async function confirmSale(e: FormEvent) {
    e.preventDefault();
    if (!saleTyre || !saleCustomerId) return;
    setSaving(true);
    try {
      const account = accounts.find((a) => a.id === saleAccountId);
      await apiFetch("/tyres/sale", {
        method: "POST",
        body: JSON.stringify({
          customerId: saleCustomerId,
          tyreId: saleTyre.id,
          quantity: Number(saleQty),
          sellPriceNet: Number(salePrice) || undefined,
          paymentAccountId: salePayNow && saleAccountId ? saleAccountId : undefined,
          method: account ? defaultPaymentMethodForAccount(account.type) : undefined,
        }),
      });
      setSaleOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Sale failed");
    } finally {
      setSaving(false);
    }
  }

  async function confirmToggleStatus() {
    if (!confirmTarget) return;
    setSaving(true);
    try {
      const path =
        confirmTarget.status === "INACTIVE"
          ? `/tyres/${confirmTarget.id}/activate`
          : `/tyres/${confirmTarget.id}/deactivate`;
      await apiFetch(path, { method: "PATCH" });
      setConfirmOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Update failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="mb-1 text-xs text-[var(--muted)]">
            Home / <span className="text-accent">Tyre stock</span>
          </p>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Tyre stock</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Inventory levels, counter sales, and job fitting. Sell prices include fitting.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-[var(--muted)]">
            <input
              type="checkbox"
              checked={lowStockOnly}
              onChange={(e) => setLowStockOnly(e.target.checked)}
              className="h-4 w-4 rounded border border-[var(--border)]"
            />
            Low stock only
          </label>

          {canWrite && (
            <button
              type="button"
              onClick={() => {
                setDraft(emptyDraft());
                setBuyPriceIncludesVat(false);
                setCreatePayment(emptyStockPaymentDraft(accounts));
                setModalOpen(true);
              }}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
            >
              Add tyre SKU
            </button>
          )}
        </div>
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      {loading && <p className="mb-4 text-sm text-[var(--muted)]">Loading…</p>}

      <SearchableTable
        rows={rows}
        columns={columns}
        getRowId={(r) => r.id}
        searchPlaceholder="Search code, size, brand…"
        emptyLabel={loading ? "Loading…" : "No tyres in stock yet"}
        countLabel={(f, t) => `${f} of ${t} SKUs`}
      />

      <Modal
        title={draft.id ? "Edit tyre" : "Add tyre SKU"}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        size="lg"
      >
        <form onSubmit={(e) => void saveTyre(e)} className="space-y-1">
          <FormSection title="Details">
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Tyre size</label>
              <input
                value={draft.size}
                onChange={(e) => setDraft((d) => ({ ...d, size: e.target.value }))}
                required
                placeholder="205/55R16"
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Tyre code</label>
              <input
                value={draft.id ? draft.skuCode : previewCode}
                readOnly
                className={readOnlyClass}
                placeholder="Auto-generated from size"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Brand (optional)</label>
              <input
                value={draft.brand}
                onChange={(e) => setDraft((d) => ({ ...d, brand: e.target.value }))}
                placeholder="e.g. Michelin"
                className={inputClass}
              />
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between gap-2">
                <label className="text-xs font-medium text-[var(--muted)]">Supplier</label>
                {canCreateSupplier && (
                  <button
                    type="button"
                    onClick={() => {
                      setSupplierDraft(emptySupplierDraft());
                      setSupplierNotice("");
                      setSupplierModalOpen(true);
                    }}
                    className="text-xs font-medium text-accent hover:underline"
                  >
                    New supplier
                  </button>
                )}
              </div>
              <SearchableSelect
                value={draft.supplierId}
                onChange={(v) => setDraft((d) => ({ ...d, supplierId: v }))}
                options={supplierOptions}
                searchPlaceholder="Search suppliers…"
              />
            </div>
          </FormSection>
          {!draft.id && (
            <p className="text-[10px] text-[var(--muted)]">
              Tyre code is auto-generated from size (letters and digits only). Brand is appended if needed for
              uniqueness.
            </p>
          )}

          <FormSection title="Stock">
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Reorder level</label>
              <input
                type="number"
                min="0"
                step="1"
                value={draft.minQuantity}
                onChange={(e) => setDraft((d) => ({ ...d, minQuantity: e.target.value }))}
                className={inputClass}
              />
            </div>
            {!draft.id && (
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Opening stock</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={draft.quantityOnHand}
                  onChange={(e) => setDraft((d) => ({ ...d, quantityOnHand: e.target.value }))}
                  className={inputClass}
                />
              </div>
            )}
          </FormSection>

          {!draft.id ? (
            <TyreStockPurchaseFields
              unitBuyPrice={draft.costPriceNet}
              onUnitBuyPriceChange={(value) =>
                setDraft((d) => ({ ...d, costPriceNet: value }))
              }
              includeVat={buyPriceIncludesVat}
              onIncludeVatChange={setBuyPriceIncludesVat}
              quantity={openingQty}
              payment={createPayment}
              onPaymentChange={setCreatePayment}
              accounts={accounts}
            />
          ) : (
            <FormSection title="Cost">
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--muted)]">
                  Unit cost (ex VAT)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={draft.costPriceNet}
                  onChange={(e) => setDraft((d) => ({ ...d, costPriceNet: e.target.value }))}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--muted)]">
                  Unit cost (inc VAT)
                </label>
                <input
                  value={
                    unitBuyPrice > 0
                      ? formatGbp(grossFromNet(unitBuyPrice, UK_STANDARD_VAT_PERCENT))
                      : ""
                  }
                  readOnly
                  placeholder="—"
                  className={readOnlyClass}
                />
              </div>
            </FormSection>
          )}

          <FormSection title="Sell">
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--muted)]">
                Est. customer price, incl. fitting (ex VAT)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={draft.sellPriceNet}
                onChange={(e) => setDraft((d) => ({ ...d, sellPriceNet: e.target.value }))}
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--muted)]">
                Est. trade price, incl. fitting (ex VAT)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={draft.tradeSellPriceNet}
                onChange={(e) => setDraft((d) => ({ ...d, tradeSellPriceNet: e.target.value }))}
                className={inputClass}
              />
            </div>
          </FormSection>

          <div className="flex justify-end gap-2 border-t border-[var(--border)] pt-4">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              Save
            </button>
          </div>
        </form>
      </Modal>

      {canCreateSupplier && (
        <Modal
          title="New supplier"
          open={supplierModalOpen}
          onClose={() => setSupplierModalOpen(false)}
          autoHeight
        >
          {supplierNotice && <p className="mb-3 text-sm text-red-600">{supplierNotice}</p>}
          <form onSubmit={(e) => void saveNewSupplier(e)} className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Name</label>
              <input
                value={supplierDraft.name}
                onChange={(e) => setSupplierDraft((d) => ({ ...d, name: e.target.value }))}
                required
                className={inputClass}
                placeholder="Supplier name"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Email (optional)</label>
              <input
                type="email"
                value={supplierDraft.email}
                onChange={(e) => setSupplierDraft((d) => ({ ...d, email: e.target.value }))}
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Phone (optional)</label>
              <input
                value={supplierDraft.phone}
                onChange={(e) => setSupplierDraft((d) => ({ ...d, phone: e.target.value }))}
                className={inputClass}
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSupplierModalOpen(false)}
                className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={supplierSaving}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {supplierSaving ? "Saving…" : "Save supplier"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      <Modal
        title={receiveTarget ? `Receive stock — ${receiveTarget.skuCode}` : "Receive stock"}
        open={receiveOpen}
        onClose={() => {
          if (!saving) setReceiveOpen(false);
        }}
        size="lg"
      >
        <form onSubmit={(e) => void confirmReceive(e)} className="space-y-1">
          <p className="mb-2 text-sm text-[var(--muted)]">{receiveTarget?.displayLabel}</p>

          <FormSection title="Stock">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Quantity</label>
              <input
                type="number"
                min="0.001"
                step="1"
                value={receiveQty}
                onChange={(e) => setReceiveQty(e.target.value)}
                required
                className={inputClass}
              />
            </div>
          </FormSection>

          <TyreStockPurchaseFields
            unitBuyPrice={receiveBuyPrice}
            onUnitBuyPriceChange={setReceiveBuyPrice}
            includeVat={receiveIncludeVat}
            onIncludeVatChange={setReceiveIncludeVat}
            quantity={Number(receiveQty) || 0}
            payment={receivePayment}
            onPaymentChange={setReceivePayment}
            accounts={accounts}
          />

          <div className="flex justify-end gap-2 border-t border-[var(--border)] pt-4">
            <button
              type="button"
              disabled={saving}
              onClick={() => setReceiveOpen(false)}
              className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {saving ? "Receiving…" : "Receive"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal title="Counter sale" open={saleOpen} onClose={() => setSaleOpen(false)}>
        <form onSubmit={(e) => void confirmSale(e)} className="space-y-3">
          <p className="text-sm text-[var(--muted)]">{saleTyre?.displayLabel}</p>
          <SearchableSelect
            value={saleCustomerId}
            onChange={setSaleCustomerId}
            options={customerOptions}
            placeholder="Customer…"
            searchPlaceholder="Search…"
            required
          />
          <input
            type="number"
            min="1"
            step="1"
            value={saleQty}
            onChange={(e) => setSaleQty(e.target.value)}
            required
            className={inputClass}
          />
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--muted)]">
              Sell price per tyre (ex VAT)
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={salePrice}
              onChange={(e) => setSalePrice(e.target.value)}
              className={inputClass}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={salePayNow}
              onChange={(e) => setSalePayNow(e.target.checked)}
              className="h-4 w-4 rounded border border-[var(--border)]"
            />
            Record payment now
          </label>
          {salePayNow && (
            <SearchableSelect
              value={saleAccountId}
              onChange={setSaleAccountId}
              options={accountOptions}
              searchPlaceholder="Account…"
              required
            />
          )}
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white"
          >
            Complete sale
          </button>
        </form>
      </Modal>

      <ConfirmDialog
        open={confirmOpen}
        title={confirmTarget?.status === "INACTIVE" ? "Activate tyre?" : "Deactivate tyre?"}
        description="Inactive SKUs are hidden from job fitting and counter sales."
        confirmLabel={confirmTarget?.status === "INACTIVE" ? "Activate" : "Deactivate"}
        variant={confirmTarget?.status === "INACTIVE" ? "default" : "danger"}
        loading={saving}
        onConfirm={() => void confirmToggleStatus()}
        onCancel={() => {
          if (!saving) setConfirmOpen(false);
        }}
      />
    </>
  );
}
