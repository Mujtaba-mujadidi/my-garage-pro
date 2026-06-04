"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useSession } from "@/components/providers/session-provider";
import { PermissionEditor } from "@/components/settings/permission-editor";
import { GarageRolesTable } from "@/components/settings/garage-roles-table";
import { Modal } from "@/components/ui/modal";
import { apiFetch, ApiError } from "@/lib/api-client";
import type {
  GaragePermission,
  GarageRoleDetailDto,
  GarageRoleDto,
  GarageRoleListDto,
  PermissionGroup,
} from "@mygaragepro/shared";

type ModalMode = { type: "edit"; role: GarageRoleDto } | { type: "create" } | null;

export function RolesAccessPanel() {
  const { session, loading: sessionLoading } = useSession();

  const [data, setData] = useState<GarageRoleListDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<ModalMode>(null);
  const [roleName, setRoleName] = useState("");
  const [permissions, setPermissions] = useState<GaragePermission[]>([]);
  const [groups, setGroups] = useState<PermissionGroup[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!session?.accessToken) return;
    setLoading(true);
    setError("");
    try {
      const list = await apiFetch<GarageRoleListDto>("/settings/garage-roles");
      setData(list);
      setGroups(list.groups);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load roles");
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken]);

  useEffect(() => {
    if (sessionLoading || !session) return;
    void load();
  }, [load, session, sessionLoading]);

  async function openEdit(role: GarageRoleDto) {
    setError("");
    setModal({ type: "edit", role });
    setRoleName(role.name);
    setPermissions([...role.permissions]);
    try {
      const detail = await apiFetch<GarageRoleDetailDto>(`/settings/garage-roles/${role.id}`);
      setGroups(detail.groups);
      setPermissions([...detail.permissions]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load role details");
      setPermissions([...role.permissions]);
      if (data?.groups) setGroups(data.groups);
    }
  }

  function openCreate() {
    setModal({ type: "create" });
    setRoleName("");
    setPermissions([]);
    setError("");
  }

  function closeModal() {
    setModal(null);
    setError("");
  }

  async function saveModal(e: FormEvent) {
    e.preventDefault();
    if (!modal) return;
    setSaving(true);
    setMessage("");
    setError("");
    try {
      if (modal.type === "create") {
        await apiFetch("/settings/garage-roles", {
          method: "POST",
          body: JSON.stringify({ name: roleName.trim(), permissions }),
        });
        setMessage("Role created.");
      } else {
        await apiFetch(`/settings/garage-roles/${modal.role.id}`, {
          method: "PUT",
          body: JSON.stringify({ name: roleName.trim(), permissions }),
        });
        setMessage("Role saved. Staff must sign out and back in for changes to apply.");
      }
      closeModal();
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function deleteRole(role: GarageRoleDto) {
    if (role.isDefault) return;
    if (!confirm(`Delete role "${role.name}"?`)) return;
    setError("");
    try {
      await apiFetch(`/settings/garage-roles/${role.id}`, { method: "DELETE" });
      setMessage(`Role "${role.name}" deleted.`);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Delete failed");
    }
  }

  const modalTitle =
    modal?.type === "create" ? "New role" : modal?.type === "edit" ? `Edit: ${modal.role.name}` : "";

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <p className="max-w-2xl text-sm text-[var(--muted)]">
          Create roles for your team and choose what each can access. Options match modules enabled
          for your garage. The owner always has full access.
        </p>
        <button
          type="button"
          onClick={openCreate}
          className="shrink-0 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
        >
          Add role
        </button>
      </div>

      {message && <p className="mb-4 text-sm text-green-700 dark:text-green-400">{message}</p>}
      {error && !modal && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {loading ? (
        <p className="text-sm text-[var(--muted)]">Loading roles…</p>
      ) : data ? (
        <GarageRolesTable
          roles={data.roles}
          groups={groups}
          onEdit={openEdit}
          onDelete={(role) => void deleteRole(role)}
        />
      ) : null}

      <Modal
        title={modalTitle}
        open={modal !== null}
        onClose={closeModal}
        size="lg"
        fixedHeight
      >
        {modal && (
          <form
            key={modal.type === "edit" ? modal.role.id : "create"}
            onSubmit={saveModal}
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className="shrink-0">
              <label className="mb-1 block text-xs font-medium text-[var(--muted)]">
                Role name
              </label>
              <input
                value={roleName}
                onChange={(e) => setRoleName(e.target.value)}
                required
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                placeholder="e.g. Workshop lead"
              />
            </div>
            <div className="mt-4 min-h-0 flex-1">
              <p className="mb-2 text-xs font-medium text-[var(--muted)]">Access</p>
              <div className="h-[22rem] overflow-y-auto pr-1">
                <PermissionEditor
                  groups={groups}
                  permissions={permissions}
                  onChange={setPermissions}
                />
              </div>
            </div>
            {error && <p className="mt-3 shrink-0 text-sm text-red-600">{error}</p>}
            <div className="mt-4 flex shrink-0 justify-end gap-2 border-t border-[var(--border)] pt-4">
              <button
                type="button"
                onClick={closeModal}
                className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
