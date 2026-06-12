"use client";

import {
  SupplierForm,
  emptyDraftSupplier,
  toDraftSupplier,
} from "@/components/suppliers/supplier-form";
import { ModuleGate } from "@/components/layout/module-gate";
import { useSession } from "@/components/providers/session-provider";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Modal } from "@/components/ui/modal";
import { SearchableTable, type TableColumn } from "@/components/ui/searchable-table";
import { TableRowActionsMenu } from "@/components/ui/table-row-actions-menu";
import { apiFetch, ApiError } from "@/lib/api-client";
import type { SupplierDto } from "@mygaragepro/shared";
import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

export default function SuppliersPage() {
  const { hasPermission } = useSession();
  const canWrite = hasPermission("suppliers.write");

  const [rows, setRows] = useState<SupplierDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [includeInactive, setIncludeInactive] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [draft, setDraft] = useState(emptyDraftSupplier());
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
            <Link href={`/suppliers/${s.id}`} className="font-medium text-accent hover:underline">
              {s.name}
            </Link>
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
        header: "VAT no.",
        searchText: (s) => s.vatNumber ?? "",
        cell: (s) => s.vatNumber ?? "—",
      },
      {
        id: "credit",
        header: "Credit",
        cell: (s) => (
          <span className="tabular-nums font-medium">
            £{Number(s.creditBalance).toFixed(2)}
          </span>
        ),
      },
    ];

    if (canWrite) {
      cols.push({
        id: "actions",
        header: "Actions",
        align: "right",
        cell: (s) => (
          <TableRowActionsMenu
            triggerLabel={`Actions for ${s.name}`}
            actions={[
              { label: "View", href: `/suppliers/${s.id}` },
              {
                label: "Edit",
                onClick: () => {
                  setDraft(toDraftSupplier(s));
                  setModalOpen(true);
                },
              },
              {
                label: s.status === "INACTIVE" ? "Activate" : "Deactivate",
                variant: s.status === "INACTIVE" ? "default" : "danger",
                onClick: () => {
                  setConfirmTarget(s);
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
      setDraft(emptyDraftSupplier());
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
                setDraft(emptyDraftSupplier());
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
        <SupplierForm
          draft={draft}
          setDraft={setDraft}
          onSubmit={saveSupplier}
          saving={saving}
          onCancel={() => setModalOpen(false)}
        />
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
