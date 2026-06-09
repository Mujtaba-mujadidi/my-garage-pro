"use client";

import { ModuleGate } from "@/components/layout/module-gate";
import { useSession } from "@/components/providers/session-provider";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Modal } from "@/components/ui/modal";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { SearchableTable, type TableColumn } from "@/components/ui/searchable-table";
import { TableRowActionsMenu } from "@/components/ui/table-row-actions-menu";
import { apiFetch, ApiError } from "@/lib/api-client";
import {
  PartFitmentFields,
  emptyFitmentRow,
  type DraftFitmentRow,
} from "@/components/parts/part-fitment-fields";
import type { PartDto, PartFitmentType, SupplierDto } from "@mygaragepro/shared";
import { summarizePartFitments } from "@mygaragepro/shared";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type DraftPart = {
  id?: string;
  partNumber: string;
  description: string;
  category: string;
  fitmentType: PartFitmentType;
  fitments: DraftFitmentRow[];
  quantityOnHand: string;
  minQuantity: string;
  costPriceNet: string;
  sellPriceNet: string;
  supplierId: string;
  location: string;
  notes: string;
};

function toDraft(p: PartDto): DraftPart {
  return {
    id: p.id,
    partNumber: p.partNumber,
    description: p.description,
    category: p.category ?? "",
    fitmentType: p.fitmentType ?? "UNIVERSAL",
    fitments: (p.fitments ?? []).map((f) => ({
      clientId: f.id,
      make: f.make,
      model: f.model,
      yearFrom: f.yearFrom,
      yearTo: f.yearTo,
      notes: f.notes ?? "",
    })),
    quantityOnHand: p.quantityOnHand,
    minQuantity: p.minQuantity,
    costPriceNet: p.costPriceNet,
    sellPriceNet: p.sellPriceNet,
    supplierId: p.supplierId ?? "",
    location: p.location ?? "",
    notes: p.notes ?? "",
  };
}

function emptyDraft(): DraftPart {
  return {
    partNumber: "",
    description: "",
    category: "",
    fitmentType: "UNIVERSAL",
    fitments: [],
    quantityOnHand: "0",
    minQuantity: "0",
    costPriceNet: "0",
    sellPriceNet: "0",
    supplierId: "",
    location: "",
    notes: "",
  };
}

function formatGbp(amount: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(amount);
}

export default function PartsPage() {
  const { hasPermission } = useSession();
  const canWrite = hasPermission("parts.write");

  const [rows, setRows] = useState<PartDto[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [lowStockOnly, setLowStockOnly] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [draft, setDraft] = useState<DraftPart>(emptyDraft());
  const [saving, setSaving] = useState(false);

  const [receiveOpen, setReceiveOpen] = useState(false);
  const [receiveTarget, setReceiveTarget] = useState<PartDto | null>(null);
  const [receiveQty, setReceiveQty] = useState("1");
  const [receiveNotes, setReceiveNotes] = useState("");

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<PartDto | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = lowStockOnly ? "?lowStock=true" : "";
      const data = await apiFetch<PartDto[]>(`/parts${params}`);
      setRows(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load parts");
    } finally {
      setLoading(false);
    }
  }, [lowStockOnly]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!canWrite) return;
    void apiFetch<SupplierDto[]>("/suppliers")
      .then(setSuppliers)
      .catch(() => setSuppliers([]));
  }, [canWrite]);

  const supplierOptions = useMemo(
    () => [
      { value: "", label: "No supplier" },
      ...suppliers.map((s) => ({ value: s.id, label: s.name })),
    ],
    [suppliers],
  );

  const columns: TableColumn<PartDto>[] = useMemo(() => {
    const cols: TableColumn<PartDto>[] = [
      {
        id: "partNumber",
        header: "Part no.",
        searchText: (p) => [p.partNumber, p.description, p.category ?? ""].join(" "),
        cell: (p) => (
          <div>
            <div className="font-medium text-[var(--foreground)]">{p.partNumber}</div>
            <div className="text-xs text-[var(--muted)]">{p.description}</div>
          </div>
        ),
      },
      {
        id: "stock",
        header: "On hand",
        searchText: (p) => `${p.quantityOnHand} ${p.minQuantity}`,
        cell: (p) => (
          <div className="tabular-nums">
            <span className={p.isLowStock ? "font-semibold text-amber-700 dark:text-amber-300" : ""}>
              {p.quantityOnHand}
            </span>
            <span className="text-xs text-[var(--muted)]"> / min {p.minQuantity}</span>
            {p.isLowStock && (
              <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                Low
              </span>
            )}
          </div>
        ),
      },
      {
        id: "fitment",
        header: "Fitment",
        searchText: (p) =>
          summarizePartFitments(p.fitmentType ?? "UNIVERSAL", p.fitments ?? []),
        cell: (p) => (
          <span className="text-xs text-[var(--muted)]">
            {summarizePartFitments(p.fitmentType ?? "UNIVERSAL", p.fitments ?? [])}
          </span>
        ),
      },
      {
        id: "pricing",
        header: "Sell (ex VAT)",
        cell: (p) => formatGbp(Number(p.sellPriceNet)),
      },
      {
        id: "location",
        header: "Location",
        searchText: (p) => p.location ?? "",
        cell: (p) => p.location ?? "—",
      },
    ];

    if (canWrite) {
      cols.push({
        id: "actions",
        header: "Actions",
        align: "right",
        cell: (p) => (
          <TableRowActionsMenu
            triggerLabel={`Actions for ${p.partNumber}`}
            actions={[
              {
                label: "Receive stock",
                onClick: () => {
                  setReceiveTarget(p);
                  setReceiveQty("1");
                  setReceiveNotes("");
                  setReceiveOpen(true);
                },
              },
              {
                label: "Edit",
                onClick: () => {
                  setDraft(toDraft(p));
                  setModalOpen(true);
                },
              },
              {
                label: p.status === "INACTIVE" ? "Activate" : "Deactivate",
                variant: p.status === "INACTIVE" ? "default" : "danger",
                onClick: () => {
                  setConfirmTarget(p);
                  setConfirmOpen(true);
                },
              },
            ]}
          />
        ),
      });
    }

    return cols;
  }, [canWrite]);

  async function savePart(e: FormEvent) {
    e.preventDefault();
    if (draft.fitmentType === "VEHICLE_SPECIFIC") {
      const valid = draft.fitments.some(
        (r) => r.make.trim() && r.model.trim() && r.yearFrom > 0,
      );
      if (!valid) {
        setError("Add at least one vehicle fitment (make, model, year from).");
        return;
      }
    }
    setSaving(true);
    setError("");
    try {
      const payload = {
        partNumber: draft.partNumber,
        description: draft.description,
        category: draft.category || undefined,
        fitmentType: draft.fitmentType,
        fitments:
          draft.fitmentType === "VEHICLE_SPECIFIC"
            ? draft.fitments.map((r) => ({
                make: r.make.trim(),
                model: r.model.trim(),
                yearFrom: r.yearFrom,
                yearTo: r.yearTo ?? undefined,
                notes: r.notes?.trim() || undefined,
              }))
            : [],
        quantityOnHand: Number(draft.quantityOnHand) || 0,
        minQuantity: Number(draft.minQuantity) || 0,
        costPriceNet: Number(draft.costPriceNet) || 0,
        sellPriceNet: Number(draft.sellPriceNet) || 0,
        supplierId: draft.supplierId || undefined,
        location: draft.location || undefined,
        notes: draft.notes || undefined,
      };

      if (draft.id) {
        const { quantityOnHand: _qty, ...updatePayload } = payload;
        await apiFetch(`/parts/${draft.id}`, {
          method: "PATCH",
          body: JSON.stringify(updatePayload),
        });
      } else {
        await apiFetch("/parts", { method: "POST", body: JSON.stringify(payload) });
      }

      setModalOpen(false);
      setDraft(emptyDraft());
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
    setError("");
    try {
      await apiFetch(`/parts/${receiveTarget.id}/receive`, {
        method: "POST",
        body: JSON.stringify({
          quantity: Number(receiveQty),
          notes: receiveNotes || undefined,
        }),
      });
      setReceiveOpen(false);
      setReceiveTarget(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Receive failed");
    } finally {
      setSaving(false);
    }
  }

  async function confirmToggleStatus() {
    if (!confirmTarget) return;
    setSaving(true);
    setError("");
    try {
      const path =
        confirmTarget.status === "INACTIVE"
          ? `/parts/${confirmTarget.id}/activate`
          : `/parts/${confirmTarget.id}/deactivate`;
      await apiFetch(path, { method: "PATCH" });
      setConfirmOpen(false);
      setConfirmTarget(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Update failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModuleGate moduleKey="parts">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="mb-1 text-xs text-[var(--muted)]">
            Home / <span className="text-accent">Parts stock</span>
          </p>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Parts stock</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Inventory levels, receive stock, and use parts on repair jobs.
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
                setModalOpen(true);
              }}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
            >
              Add part
            </button>
          )}
        </div>
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      {loading && <p className="mb-4 text-sm text-[var(--muted)]">Loading…</p>}

      <SearchableTable
        rows={rows}
        columns={columns}
        getRowId={(p) => p.id}
        searchPlaceholder="Part number, description, category…"
        emptyLabel="No parts yet"
        noMatchLabel="No matching parts"
        minWidth="800px"
        countLabel={(filtered, total) => `${filtered} of ${total} part${total === 1 ? "" : "s"}`}
      />

      <Modal
        title={draft.id ? "Edit part" : "Add part"}
        open={modalOpen}
        onClose={() => {
          if (!saving) setModalOpen(false);
        }}
        size="lg"
        fixedHeight
      >
        <form onSubmit={savePart} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Part number</label>
              <input
                value={draft.partNumber}
                onChange={(e) => setDraft((d) => ({ ...d, partNumber: e.target.value }))}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                placeholder="e.g. OIL-5W30-5L"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Category</label>
              <input
                value={draft.category}
                onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                placeholder="e.g. Filters"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Description</label>
              <input
                value={draft.description}
                onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                required
              />
            </div>
            {!draft.id && (
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--muted)]">
                  Opening quantity
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.001"
                  value={draft.quantityOnHand}
                  onChange={(e) => setDraft((d) => ({ ...d, quantityOnHand: e.target.value }))}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                />
              </div>
            )}
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Min quantity</label>
              <input
                type="number"
                min="0"
                step="0.001"
                value={draft.minQuantity}
                onChange={(e) => setDraft((d) => ({ ...d, minQuantity: e.target.value }))}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Cost (ex VAT)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={draft.costPriceNet}
                onChange={(e) => setDraft((d) => ({ ...d, costPriceNet: e.target.value }))}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Sell (ex VAT)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={draft.sellPriceNet}
                onChange={(e) => setDraft((d) => ({ ...d, sellPriceNet: e.target.value }))}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Supplier</label>
              <SearchableSelect
                value={draft.supplierId}
                onChange={(v) => setDraft((d) => ({ ...d, supplierId: v }))}
                options={supplierOptions}
                searchPlaceholder="Search suppliers…"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Location</label>
              <input
                value={draft.location}
                onChange={(e) => setDraft((d) => ({ ...d, location: e.target.value }))}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                placeholder="Shelf A1"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Notes</label>
              <textarea
                value={draft.notes}
                onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
                rows={2}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              />
            </div>
          </div>

          <PartFitmentFields
            fitmentType={draft.fitmentType}
            fitments={draft.fitments}
            onFitmentTypeChange={(fitmentType) =>
              setDraft((d) => ({
                ...d,
                fitmentType,
                fitments:
                  fitmentType === "VEHICLE_SPECIFIC" && d.fitments.length === 0
                    ? [emptyFitmentRow()]
                    : fitmentType === "UNIVERSAL"
                      ? []
                      : d.fitments,
              }))
            }
            onFitmentsChange={(fitments) => setDraft((d) => ({ ...d, fitments }))}
          />
          </div>
          <div className="flex shrink-0 justify-end gap-2 border-t border-[var(--border)] pt-3">
            <button
              type="button"
              disabled={saving}
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
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        title={receiveTarget ? `Receive stock — ${receiveTarget.partNumber}` : "Receive stock"}
        open={receiveOpen}
        onClose={() => {
          if (!saving) setReceiveOpen(false);
        }}
      >
        <form onSubmit={confirmReceive} className="space-y-4">
          <p className="text-sm text-[var(--muted)]">
            On hand: <span className="font-mono font-medium">{receiveTarget?.quantityOnHand}</span>
          </p>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Quantity</label>
            <input
              type="number"
              min="0.001"
              step="0.001"
              value={receiveQty}
              onChange={(e) => setReceiveQty(e.target.value)}
              required
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Notes</label>
            <input
              value={receiveNotes}
              onChange={(e) => setReceiveNotes(e.target.value)}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              placeholder="Delivery ref, supplier invoice…"
            />
          </div>
          <div className="flex justify-end gap-2">
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

      <ConfirmDialog
        open={confirmOpen}
        title={confirmTarget?.status === "INACTIVE" ? "Activate part?" : "Deactivate part?"}
        description={
          confirmTarget?.status === "INACTIVE"
            ? `${confirmTarget.partNumber} will be available for use on jobs again.`
            : `${confirmTarget?.partNumber} will be hidden from stock lists. Existing job usages are kept.`
        }
        confirmLabel={confirmTarget?.status === "INACTIVE" ? "Activate" : "Deactivate"}
        onConfirm={() => void confirmToggleStatus()}
        onCancel={() => {
          if (!saving) {
            setConfirmOpen(false);
            setConfirmTarget(null);
          }
        }}
        loading={saving}
      />
    </ModuleGate>
  );
}
