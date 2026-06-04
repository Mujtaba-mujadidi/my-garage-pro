"use client";

import { ModuleGate } from "@/components/layout/module-gate";
import { useSession } from "@/components/providers/session-provider";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Modal } from "@/components/ui/modal";
import { SearchableTable, type TableColumn } from "@/components/ui/searchable-table";
import { apiFetch, ApiError } from "@/lib/api-client";
import type { SupplierDto } from "@mygaragepro/shared";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type DraftSupplier = {
  id?: string;
  name: string;
  email: string;
  phone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  postcode: string;
  vatNumber: string;
  notes: string;
};

function toDraft(s: SupplierDto): DraftSupplier {
  return {
    id: s.id,
    name: s.name ?? "",
    email: s.email ?? "",
    phone: s.phone ?? "",
    addressLine1: s.addressLine1 ?? "",
    addressLine2: s.addressLine2 ?? "",
    city: s.city ?? "",
    postcode: s.postcode ?? "",
    vatNumber: s.vatNumber ?? "",
    notes: s.notes ?? "",
  };
}

function emptyDraft(): DraftSupplier {
  return {
    name: "",
    email: "",
    phone: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    postcode: "",
    vatNumber: "",
    notes: "",
  };
}

export default function SuppliersPage() {
  const { hasPermission } = useSession();
  const canWrite = hasPermission("suppliers.write");

  const [rows, setRows] = useState<SupplierDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [includeInactive, setIncludeInactive] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [draft, setDraft] = useState<DraftSupplier>(emptyDraft());
  const [saving, setSaving] = useState(false);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<SupplierDto | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = includeInactive ? "?includeInactive=true" : "";
      const data = await apiFetch<SupplierDto[]>(`/suppliers${params}`);
      setRows(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load suppliers");
    } finally {
      setLoading(false);
    }
  }, [includeInactive]);

  useEffect(() => {
    void load();
  }, [load]);

  const columns: TableColumn<SupplierDto>[] = useMemo(() => {
    const cols: TableColumn<SupplierDto>[] = [
      {
        id: "name",
        header: "Supplier",
        searchText: (s) => s.name,
        cell: (s) => (
          <div className="flex items-center gap-2">
            <span className="font-medium text-[var(--foreground)]">{s.name}</span>
            {s.status === "INACTIVE" && (
              <span className="rounded-full bg-[var(--background)] px-2 py-0.5 text-[10px] text-[var(--muted)]">
                Inactive
              </span>
            )}
          </div>
        ),
      },
      {
        id: "contact",
        header: "Contact",
        searchText: (s) => [s.email ?? "", s.phone ?? ""].join(" "),
        cell: (s) => (
          <div className="text-xs text-[var(--muted)]">
            <div>{s.email ?? "—"}</div>
            <div>{s.phone ?? ""}</div>
          </div>
        ),
      },
      {
        id: "vat",
        header: "VAT",
        searchText: (s) => s.vatNumber ?? "",
        cell: (s) => s.vatNumber ?? "—",
      },
    ];

    if (canWrite) {
      cols.push({
        id: "actions",
        header: "Actions",
        align: "right",
        cell: (s) => (
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setDraft(toDraft(s));
                setModalOpen(true);
              }}
              className="rounded-lg border border-[var(--border)] px-3 py-1 text-xs font-medium hover:bg-[var(--background)]"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirmTarget(s);
                setConfirmOpen(true);
              }}
              className="rounded-lg border border-[var(--border)] px-3 py-1 text-xs font-medium hover:bg-[var(--background)]"
            >
              {s.status === "INACTIVE" ? "Activate" : "Deactivate"}
            </button>
          </div>
        ),
      });
    }

    return cols;
  }, [canWrite]);

  async function saveSupplier(e: FormEvent) {
    e.preventDefault();
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

      if (draft.id) {
        await apiFetch(`/suppliers/${draft.id}`, { method: "PATCH", body: JSON.stringify(payload) });
      } else {
        await apiFetch(`/suppliers`, { method: "POST", body: JSON.stringify(payload) });
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

  async function confirmToggleStatus() {
    if (!confirmTarget) return;
    setSaving(true);
    setError("");
    try {
      const path =
        confirmTarget.status === "INACTIVE"
          ? `/suppliers/${confirmTarget.id}/activate`
          : `/suppliers/${confirmTarget.id}/deactivate`;
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
    <ModuleGate moduleKey="suppliers">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="mb-1 text-xs text-[var(--muted)]">
            Home / <span className="text-accent">Suppliers</span>
          </p>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Suppliers</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">Contacts and supplier directory.</p>
        </div>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-[var(--muted)]">
            <input
              type="checkbox"
              checked={includeInactive}
              onChange={(e) => setIncludeInactive(e.target.checked)}
              className="h-4 w-4 rounded border border-[var(--border)]"
            />
            Show inactive
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
              Add supplier
            </button>
          )}
        </div>
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      {loading && <p className="mb-4 text-sm text-[var(--muted)]">Loading…</p>}

      <SearchableTable
        rows={rows}
        columns={columns}
        getRowId={(s) => s.id}
        searchPlaceholder="Supplier name, email, phone, VAT…"
        emptyLabel="No suppliers yet"
        noMatchLabel="No matching suppliers"
        minWidth="720px"
        countLabel={(filtered, total) =>
          `${filtered} of ${total} supplier${total === 1 ? "" : "s"}`
        }
      />

      <Modal
        title={draft.id ? "Edit supplier" : "Add supplier"}
        open={modalOpen}
        onClose={() => {
          if (!saving) setModalOpen(false);
        }}
        size="lg"
      >
        <form onSubmit={saveSupplier} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Supplier name</label>
              <input
                value={draft.name}
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                placeholder="e.g. Euro Car Parts"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Email</label>
              <input
                value={draft.email}
                onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                placeholder="accounts@supplier.com"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Phone</label>
              <input
                value={draft.phone}
                onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value }))}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                placeholder="020 7946 0123"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--muted)]">VAT number</label>
              <input
                value={draft.vatNumber}
                onChange={(e) => setDraft((d) => ({ ...d, vatNumber: e.target.value }))}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                placeholder="GB123456789"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Postcode</label>
              <input
                value={draft.postcode}
                onChange={(e) => setDraft((d) => ({ ...d, postcode: e.target.value }))}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                placeholder="SW1A 1AA"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Address line 1</label>
              <input
                value={draft.addressLine1}
                onChange={(e) => setDraft((d) => ({ ...d, addressLine1: e.target.value }))}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                placeholder="1 Supplier Street"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Address line 2</label>
              <input
                value={draft.addressLine2}
                onChange={(e) => setDraft((d) => ({ ...d, addressLine2: e.target.value }))}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                placeholder="Optional"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--muted)]">City</label>
              <input
                value={draft.city}
                onChange={(e) => setDraft((d) => ({ ...d, city: e.target.value }))}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                placeholder="London"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Notes</label>
              <textarea
                value={draft.notes}
                onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
                className="min-h-[90px] w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                placeholder="Account number, preferred contact, delivery instructions…"
              />
            </div>
          </div>

          <div className="flex flex-wrap justify-end gap-2 pt-1">
            <button
              type="button"
              disabled={saving}
              onClick={() => setModalOpen(false)}
              className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium hover:bg-[var(--background)] disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={confirmOpen && confirmTarget !== null}
        title={confirmTarget?.status === "INACTIVE" ? "Activate supplier?" : "Deactivate supplier?"}
        description={
          <span>
            {confirmTarget?.status === "INACTIVE" ? "Activate" : "Deactivate"}{" "}
            <strong className="text-[var(--foreground)]">{confirmTarget?.name}</strong>?
          </span>
        }
        confirmLabel={confirmTarget?.status === "INACTIVE" ? "Activate" : "Deactivate"}
        variant={confirmTarget?.status === "INACTIVE" ? "default" : "danger"}
        loading={saving}
        onCancel={() => {
          if (!saving) {
            setConfirmOpen(false);
            setConfirmTarget(null);
          }
        }}
        onConfirm={() => void confirmToggleStatus()}
      />
    </ModuleGate>
  );
}

