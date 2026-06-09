"use client";

import {
  CustomerForm,
  emptyDraft,
  type DraftCustomer,
} from "@/components/customers/customer-form";
import { ModuleGate } from "@/components/layout/module-gate";
import { useSession } from "@/components/providers/session-provider";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Modal } from "@/components/ui/modal";
import { SearchableTable, type TableColumn } from "@/components/ui/searchable-table";
import { TableRowActionsMenu } from "@/components/ui/table-row-actions-menu";
import { apiFetch, ApiError } from "@/lib/api-client";
import { buildCustomerPayload, toDraftCustomer } from "@/lib/customer-payload";
import type { CustomerDto } from "@mygaragepro/shared";
import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

export default function CustomersPage() {
  const { hasPermission } = useSession();
  const canWrite = hasPermission("customers.write");

  const [rows, setRows] = useState<CustomerDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [includeArchived, setIncludeArchived] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [draft, setDraft] = useState<DraftCustomer>(emptyDraft());
  const [saving, setSaving] = useState(false);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<CustomerDto | null>(null);
  const [confirmRestore, setConfirmRestore] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = includeArchived ? "?includeDeleted=true" : "";
      const data = await apiFetch<CustomerDto[]>(`/customers${params}`);
      setRows(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load customers");
    } finally {
      setLoading(false);
    }
  }, [includeArchived]);

  useEffect(() => {
    void load();
  }, [load]);

  const columns: TableColumn<CustomerDto>[] = useMemo(() => {
    const cols: TableColumn<CustomerDto>[] = [
      {
        id: "name",
        header: "Customer",
        searchText: (c) =>
          [c.displayName, c.firstName ?? "", c.lastName ?? "", c.companyName ?? ""].join(" "),
        cell: (c) => (
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2">
              <Link href={`/customers/${c.id}`} className="font-medium text-accent hover:underline">
                {c.displayName}
              </Link>
              {c.deletedAt && (
                <span className="rounded-full bg-[var(--background)] px-2 py-0.5 text-[10px] text-[var(--muted)]">
                  Archived
                </span>
              )}
            </div>
          </div>
        ),
      },
      {
        id: "type",
        header: "Type",
        searchText: (c) => c.type,
        cell: (c) => <span className="capitalize">{c.type.toLowerCase()}</span>,
      },
      {
        id: "contact",
        header: "Contact",
        searchText: (c) =>
          [c.email ?? "", c.phone ?? "", c.city ?? "", c.postcode ?? "", c.addressLine1 ?? ""].join(
            " ",
          ),
        cell: (c) => (
          <div className="text-xs text-[var(--muted)]">
            <div>{c.email ?? "—"}</div>
            <div>{c.phone ?? ""}</div>
            {(c.city || c.postcode) && (
              <div>
                {[c.city, c.postcode].filter(Boolean).join(", ")}
              </div>
            )}
          </div>
        ),
      },
      {
        id: "vehicles",
        header: "Vehicles",
        searchText: (c) => c.vehicles.map((v) => v.registration).join(" "),
        cell: (c) =>
          c.vehicles.length ? (
            <span className="font-mono text-xs">{c.vehicles.map((v) => v.registration).join(", ")}</span>
          ) : (
            "—"
          ),
      },
      {
        id: "account",
        header: "Account",
        searchText: (c) => (c.isAccountCustomer ? "account" : ""),
        cell: (c) =>
          c.isAccountCustomer ? (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-900 dark:bg-amber-950 dark:text-amber-100">
              Account
            </span>
          ) : (
            "—"
          ),
      },
    ];

    if (canWrite) {
      cols.push({
        id: "actions",
        header: "Actions",
        align: "right",
        cell: (c) => (
          <TableRowActionsMenu
            triggerLabel={`Actions for ${c.displayName}`}
            actions={[
              { label: "View", href: `/customers/${c.id}` },
              ...(!c.deletedAt
                ? [
                    {
                      label: "Edit",
                      onClick: () => {
                        setDraft(toDraftCustomer(c));
                        setModalOpen(true);
                      },
                    },
                  ]
                : []),
              {
                label: c.deletedAt ? "Restore" : "Archive",
                variant: c.deletedAt ? "default" : "danger",
                onClick: () => {
                  setConfirmTarget(c);
                  setConfirmRestore(Boolean(c.deletedAt));
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

  async function saveCustomer(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const isEdit = Boolean(draft.id);
    try {
      const payload = buildCustomerPayload(draft, isEdit);
      if (draft.id) {
        await apiFetch(`/customers/${draft.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch("/customers", {
          method: "POST",
          body: JSON.stringify(payload),
        });
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

  async function confirmArchiveAction() {
    if (!confirmTarget) return;
    setSaving(true);
    setError("");
    try {
      if (confirmRestore) {
        await apiFetch(`/customers/${confirmTarget.id}/restore`, { method: "POST" });
      } else {
        await apiFetch(`/customers/${confirmTarget.id}`, { method: "DELETE" });
      }
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
    <ModuleGate moduleKey="customers">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="mb-1 text-xs text-[var(--muted)]">
            Home / <span className="text-accent">Customers</span>
          </p>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Customers</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">Customer and vehicle records.</p>
        </div>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-[var(--muted)]">
            <input
              type="checkbox"
              checked={includeArchived}
              onChange={(e) => setIncludeArchived(e.target.checked)}
              className="h-4 w-4 rounded border border-[var(--border)]"
            />
            Show archived
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
              Add customer
            </button>
          )}
        </div>
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      {loading && <p className="mb-4 text-sm text-[var(--muted)]">Loading…</p>}

      <SearchableTable
        rows={rows}
        columns={columns}
        getRowId={(c) => c.id}
        searchPlaceholder="Name, company, email, phone, reg…"
        emptyLabel="No customers yet"
        noMatchLabel="No matching customers"
        minWidth="800px"
        countLabel={(filtered, total) =>
          `${filtered} of ${total} customer${total === 1 ? "" : "s"}`
        }
      />

      <Modal
        title={draft.id ? "Edit customer" : "Add customer"}
        open={modalOpen}
        onClose={() => {
          if (!saving) setModalOpen(false);
        }}
        size="lg"
      >
        <CustomerForm
          draft={draft}
          setDraft={setDraft}
          saving={saving}
          onSubmit={saveCustomer}
          onCancel={() => setModalOpen(false)}
        />
      </Modal>

      <ConfirmDialog
        open={confirmOpen && confirmTarget !== null}
        title={confirmRestore ? "Restore customer?" : "Archive customer?"}
        description={
          <span>
            {confirmRestore ? "Restore" : "Archive"}{" "}
            <strong className="text-[var(--foreground)]">{confirmTarget?.displayName}</strong>?
            {!confirmRestore && " They will be hidden from the active list."}
          </span>
        }
        confirmLabel={confirmRestore ? "Restore" : "Archive"}
        variant={confirmRestore ? "default" : "danger"}
        loading={saving}
        onCancel={() => {
          if (!saving) {
            setConfirmOpen(false);
            setConfirmTarget(null);
          }
        }}
        onConfirm={() => void confirmArchiveAction()}
      />
    </ModuleGate>
  );
}
