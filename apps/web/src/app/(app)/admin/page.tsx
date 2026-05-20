"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  CreateGarageForm,
  defaultCreateGarageForm,
} from "@/components/admin/create-garage-form";
import { GaragesTable } from "@/components/admin/garages-table";
import { ModuleSaveConfirmBody } from "@/components/admin/module-save-confirm-body";
import { ModuleToggleList } from "@/components/admin/module-toggle-list";
import { PermissionGate } from "@/components/layout/permission-gate";
import { useSession } from "@/components/providers/session-provider";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Modal } from "@/components/ui/modal";
import { apiFetch, ApiError } from "@/lib/api-client";
import { modulesEqual, toggleModuleList } from "@/lib/module-utils";
import type {
  AuditLogDto,
  CreateGarageRequestDto,
  GarageAccountDto,
  ModuleKey,
} from "@mygaragepro/shared";

export default function AdminPage() {
  const { session, loading: sessionLoading } = useSession();

  const [garages, setGarages] = useState<GarageAccountDto[]>([]);
  const [audit, setAudit] = useState<AuditLogDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [createForm, setCreateForm] = useState<CreateGarageRequestDto>(defaultCreateGarageForm);
  const [showCreate, setShowCreate] = useState(false);
  const [editGarage, setEditGarage] = useState<GarageAccountDto | null>(null);
  /** Snapshot when modal opened — dirty check must not follow live `garages` during refetch. */
  const [baselineModules, setBaselineModules] = useState<ModuleKey[]>([]);
  const [draftModules, setDraftModules] = useState<ModuleKey[]>([]);
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

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

  /** Depend only on the token — not the whole session object — so toggles in the modal do not re-trigger a full reload when session identity updates. */
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
    const snap = [...garage.enabledModules];
    setEditGarage(garage);
    setBaselineModules(snap);
    setDraftModules(snap);
    setShowSaveConfirm(false);
    setShowDiscardConfirm(false);
    setError("");
  }

  function closeEdit() {
    setEditGarage(null);
    setBaselineModules([]);
    setDraftModules([]);
    setShowSaveConfirm(false);
    setShowDiscardConfirm(false);
    setError("");
  }

  function requestCloseEdit() {
    if (modulesDirty) {
      setShowDiscardConfirm(true);
      return;
    }
    closeEdit();
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

  function handleDraftToggle(moduleKey: ModuleKey, enabled: boolean) {
    setDraftModules((current) => toggleModuleList(current, moduleKey, enabled));
    setError("");
  }

  async function saveModules() {
    if (!editGarage) return;
    setSaving(true);
    setError("");
    try {
      await apiFetch(`/platform/garages/${editGarage.id}/modules`, {
        method: "PATCH",
        body: JSON.stringify({ enabledModules: draftModules }),
      });
      setMessage(`Modules saved for ${editGarage.name}.`);
      setShowSaveConfirm(false);
      closeEdit();
      await load({ silent: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Module update failed");
    } finally {
      setSaving(false);
    }
  }

  async function setGarageStatus(garage: GarageAccountDto, action: "suspend" | "activate") {
    setError("");
    try {
      await apiFetch(`/platform/garages/${garage.id}/${action}`, { method: "PATCH" });
      setMessage(action === "suspend" ? "Garage suspended." : "Garage activated.");
      await load({ silent: true });
      closeEdit();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Status update failed");
    }
  }

  const editRow = editGarage
    ? garages.find((g) => g.id === editGarage.id) ?? editGarage
    : null;

  const modulesDirty =
    editGarage !== null && !modulesEqual(draftModules, baselineModules);

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
      {error && !showCreate && !editRow && (
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

      <Modal
        title={editRow ? `Edit: ${editRow.name}` : "Edit garage"}
        open={editRow !== null}
        onClose={requestCloseEdit}
        size="lg"
      >
        {editRow && (
          <div className="space-y-4">
            <div className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-3 text-sm">
              <p className="font-medium text-[var(--foreground)]">{editRow.directorOwnerName}</p>
              <p className="mt-1 text-xs text-[var(--muted)]">{editRow.address}</p>
              <p className="mt-1 text-xs text-[var(--muted)]">
                Contact: {editRow.contactNumber} · Phone: {editRow.phoneNumber}
                {editRow.vatNumber ? ` · VAT: ${editRow.vatNumber}` : ""}
              </p>
              {editRow.ownerEmail && (
                <p className="mt-1 text-xs">
                  Owner login: <span className="font-mono text-accent">{editRow.ownerEmail}</span>
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <div>
                <p className="font-mono text-xs text-[var(--muted)]">{editRow.slug}</p>
                <p className="mt-1 text-[var(--muted)]">Status: {editRow.status}</p>
              </div>
              {editRow.status === "ACTIVE" ? (
                <button
                  type="button"
                  onClick={() => void setGarageStatus(editRow, "suspend")}
                  className="rounded-lg border border-red-300 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                >
                  Suspend garage
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void setGarageStatus(editRow, "activate")}
                  className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs hover:bg-[var(--background)]"
                >
                  Activate garage
                </button>
              )}
            </div>

            <div>
              <p className="mb-2 text-sm font-semibold text-[var(--foreground)]">
                Enabled modules
              </p>
              <p className="mb-3 text-xs text-[var(--muted)]">
                Turn modules on or off, then click <strong className="text-[var(--foreground)]">Save</strong>{" "}
                to apply. Staff only see modules that are enabled here and that their role can
                access.
              </p>
              <ModuleToggleList
                enabledModules={draftModules}
                onToggle={handleDraftToggle}
                disabled={saving}
              />
              {modulesDirty && (
                <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
                  You have unsaved module changes.
                </p>
              )}
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex flex-wrap justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={requestCloseEdit}
                disabled={saving}
                className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => setShowSaveConfirm(true)}
                disabled={saving || !modulesDirty}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                Save
              </button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={showSaveConfirm && editRow !== null}
        title="Save module changes?"
        icon="💾"
        description={
          editRow && (
            <ModuleSaveConfirmBody
              garageName={editRow.name}
              before={baselineModules}
              after={draftModules}
            />
          )
        }
        confirmLabel="Save changes"
        cancelLabel="Keep editing"
        loading={saving}
        onConfirm={() => void saveModules()}
        onCancel={() => setShowSaveConfirm(false)}
      />

      <ConfirmDialog
        open={showDiscardConfirm}
        title="Discard unsaved changes?"
        variant="danger"
        icon="⚠"
        description="Your module toggles have not been saved. If you leave now, those changes will be lost."
        confirmLabel="Discard changes"
        cancelLabel="Keep editing"
        onConfirm={closeEdit}
        onCancel={() => setShowDiscardConfirm(false)}
      />
    </PermissionGate>
  );
}
