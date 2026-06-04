"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  CreateGarageForm,
  defaultCreateGarageForm,
} from "@/components/admin/create-garage-form";
import { GarageEditModal } from "@/components/admin/garage-edit-modal";
import { GaragesTable } from "@/components/admin/garages-table";
import { PermissionGate } from "@/components/layout/permission-gate";
import { useSession } from "@/components/providers/session-provider";
import { Modal } from "@/components/ui/modal";
import { apiFetch, ApiError } from "@/lib/api-client";
import type { AuditLogDto, CreateGarageRequestDto, GarageAccountDto } from "@mygaragepro/shared";

export default function AdminPage() {
  const { session, loading: sessionLoading } = useSession();

  const [garages, setGarages] = useState<GarageAccountDto[]>([]);
  const [audit, setAudit] = useState<AuditLogDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [createForm, setCreateForm] = useState<CreateGarageRequestDto>(defaultCreateGarageForm);
  const [showCreate, setShowCreate] = useState(false);
  const [editGarageId, setEditGarageId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const editGarage =
    editGarageId !== null ? garages.find((g) => g.id === editGarageId) ?? null : null;

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!session?.accessToken) return;
      const silent = opts?.silent === true;
      if (!silent) setLoading(true);
      setError("");
      try {
        const [g, a] = await Promise.all([
          apiFetch<GarageAccountDto[]>("/platform/garages"),
          apiFetch<AuditLogDto[]>("/platform/audit?limit=30"),
        ]);
        setGarages(g);
        setAudit(a);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Failed to load platform data");
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [session?.accessToken],
  );

  useEffect(() => {
    if (sessionLoading || !session?.accessToken) return;
    void load();
  }, [load, session?.accessToken, sessionLoading]);

  function openCreate() {
    setCreateForm(defaultCreateGarageForm());
    setError("");
    setShowCreate(true);
  }

  function closeCreate() {
    setShowCreate(false);
    setError("");
  }

  function openEdit(garage: GarageAccountDto) {
    setEditGarageId(garage.id);
    setError("");
  }

  function closeEdit() {
    setEditGarageId(null);
    setError("");
  }

  async function createGarage(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const created = await apiFetch<GarageAccountDto>("/platform/garages", {
        method: "POST",
        body: JSON.stringify({
          ...createForm,
          vatNumber: createForm.vatNumber?.trim() || undefined,
        }),
      });
      setMessage(
        `Garage "${created.name}" created. Owner can sign in at ${created.ownerEmail ?? createForm.ownerEmail} with the temporary password (must change on first login).`,
      );
      closeCreate();
      await load({ silent: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Create failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <PermissionGate permission="platform.garage.manage">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mb-1 text-xs text-[var(--muted)]">
            Home / <span className="text-accent">Super Admin</span>
          </p>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Platform admin</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Manage garage accounts, enabled modules, and platform activity.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
        >
          Add garage
        </button>
      </div>

      {message && <p className="mb-4 text-sm text-green-700 dark:text-green-400">{message}</p>}
      {error && !showCreate && !editGarageId && (
        <p className="mb-4 text-sm text-red-600">{error}</p>
      )}

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold text-[var(--foreground)]">Garages</h2>
        {loading ? (
          <p className="text-sm text-[var(--muted)]">Loading garages…</p>
        ) : (
          <GaragesTable garages={garages} onEdit={openEdit} />
        )}
      </section>

      <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <h2 className="mb-3 text-sm font-semibold">Recent audit log</h2>
        <ul className="max-h-80 space-y-2 overflow-y-auto text-xs">
          {audit.map((row) => (
            <li key={row.id} className="rounded-lg bg-[var(--background)] px-3 py-2">
              <span className="font-mono text-accent">{row.action}</span>
              <span className="text-[var(--muted)]"> · {row.userEmail ?? "system"}</span>
              {row.garageName && <span className="text-[var(--muted)]"> · {row.garageName}</span>}
              <br />
              <span className="text-[var(--muted)]">{new Date(row.createdAt).toLocaleString()}</span>
            </li>
          ))}
        </ul>
      </section>

      <Modal title="Register garage" open={showCreate} onClose={closeCreate} size="lg">
        <CreateGarageForm
          value={createForm}
          onChange={setCreateForm}
          onSubmit={createGarage}
          onCancel={closeCreate}
          saving={saving}
          error={error}
        />
      </Modal>

      <GarageEditModal
        garage={editGarage}
        open={editGarageId !== null && editGarage !== null}
        onClose={closeEdit}
        onUpdated={() => void load({ silent: true })}
        onMessage={setMessage}
      />
    </PermissionGate>
  );
}
