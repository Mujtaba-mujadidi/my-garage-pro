"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { PermissionGate } from "@/components/layout/permission-gate";
import { useSession } from "@/components/providers/session-provider";
import { PermissionEditor } from "@/components/settings/permission-editor";
import { GarageRolesTable } from "@/components/settings/garage-roles-table";
import { Modal } from "@/components/ui/modal";
import { apiFetch, ApiError } from "@/lib/api-client";
import type {
  GaragePermission,
  GarageRoleDto,
  GarageRoleListDto,
  PermissionGroup,
} from "@mygaragepro/shared";

type ModalMode = { type: "edit"; role: GarageRoleDto } | { type: "create" } | null;

export default function RolePermissionsPage() {
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

  function openEdit(role: GarageRoleDto) {
    setModal({ type: "edit", role });
    setRoleName(role.name);
    setPermissions([...role.permissions]);
    setError("");
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
    <PermissionGate permission="permissions.manage">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mb-1 text-xs text-[var(--muted)]">
            Home /{" "}
            <Link href="/settings" className="hover:text-accent">
              Settings
            </Link>{" "}
            / <span className="text-accent">Roles & access</span>
          </p>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Roles & access</h1>
          <p className="mt-1 max-w-2xl text-sm text-[var(--muted)]">
            Create roles for your team and choose what each can access. Default roles: Manager,
            Mechanic, and Staff. The owner always has full access.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
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
          onEdit={openEdit}
          onDelete={(role) => void deleteRole(role)}
        />
      ) : null}

      <Modal title={modalTitle} open={modal !== null} onClose={closeModal} size="lg">
        {modal && (
          <form onSubmit={saveModal} className="space-y-4">
            <div>
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
            <PermissionEditor
              groups={groups}
              permissions={permissions}
              onChange={setPermissions}
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex justify-end gap-2 pt-2">
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
    </PermissionGate>
  );
}
