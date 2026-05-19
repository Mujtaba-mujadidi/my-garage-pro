"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { GaragesTable } from "@/components/admin/garages-table";
import { PermissionGate } from "@/components/layout/permission-gate";
import { useSession } from "@/components/providers/session-provider";
import { Modal } from "@/components/ui/modal";
import { apiFetch, ApiError } from "@/lib/api-client";
import type { AuditLogDto, GarageAccountDto, ModuleKey } from "@mygaragepro/shared";
import { MODULE_KEYS, MODULE_LABELS } from "@mygaragepro/shared";

export default function AdminPage() {
  const { session, loading: sessionLoading } = useSession();

  const [garages, setGarages] = useState<GarageAccountDto[]>([]);
  const [audit, setAudit] = useState<AuditLogDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editGarage, setEditGarage] = useState<GarageAccountDto | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!session?.accessToken) return;
    setLoading(true);
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
      setLoading(false);
    }
  }, [session?.accessToken]);

  useEffect(() => {
    if (sessionLoading || !session) return;
    void load();
  }, [load, session, sessionLoading]);

  function openCreate() {
    setName("");
    setSlug("");
    setError("");
    setShowCreate(true);
  }

  function closeCreate() {
    setShowCreate(false);
    setError("");
  }

  function openEdit(garage: GarageAccountDto) {
    setEditGarage(garage);
    setError("");
  }

  function closeEdit() {
    setEditGarage(null);
    setError("");
  }

  async function createGarage(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");
    try {
      await apiFetch("/platform/garages", {
        method: "POST",
        body: JSON.stringify({ name, slug }),
      });
      setMessage("Garage created.");
      closeCreate();
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Create failed");
    } finally {
      setSaving(false);
    }
  }

  async function toggleModule(garageId: string, current: ModuleKey[], moduleKey: ModuleKey) {
    const next = current.includes(moduleKey)
      ? current.filter((m) => m !== moduleKey)
      : [...current, moduleKey];
    try {
      await apiFetch(`/platform/garages/${garageId}/modules`, {
        method: "PATCH",
        body: JSON.stringify({ enabledModules: next }),
      });
      await load();
      setEditGarage((prev) =>
        prev && prev.id === garageId ? { ...prev, enabledModules: next } : prev,
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Module update failed");
    }
  }

  async function setGarageStatus(garage: GarageAccountDto, action: "suspend" | "activate") {
    setError("");
    try {
      await apiFetch(`/platform/garages/${garage.id}/${action}`, { method: "PATCH" });
      setMessage(action === "suspend" ? "Garage suspended." : "Garage activated.");
      await load();
      closeEdit();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Status update failed");
    }
  }

  const editRow = editGarage
    ? garages.find((g) => g.id === editGarage.id) ?? editGarage
    : null;

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
      {error && !showCreate && !editGarage && (
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

      <Modal title="Add garage" open={showCreate} onClose={closeCreate}>
        <form onSubmit={createGarage} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--muted)]">
              Garage name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Acme Motors"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Slug</label>
            <input
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
              placeholder="acme-motors"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 font-mono text-sm"
              required
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={closeCreate}
              className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {saving ? "Creating…" : "Create garage"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        title={editRow ? `Edit: ${editRow.name}` : "Edit garage"}
        open={editRow !== null}
        onClose={closeEdit}
        size="lg"
      >
        {editRow && (
          <div className="space-y-4">
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
              <p className="mb-2 text-[11px] font-semibold uppercase text-[var(--muted)]">
                Modules
              </p>
              <div className="flex flex-wrap gap-1">
                {MODULE_KEYS.map((key) => {
                  const on = editRow.enabledModules.includes(key);
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() =>
                        void toggleModule(editRow.id, editRow.enabledModules, key)
                      }
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        on ? "bg-accent text-white" : "bg-[var(--background)] text-[var(--muted)]"
                      }`}
                    >
                      {MODULE_LABELS[key]}
                    </button>
                  );
                })}
              </div>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={closeEdit}
                className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </Modal>
    </PermissionGate>
  );
}
