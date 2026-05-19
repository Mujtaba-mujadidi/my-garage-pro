"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { PermissionGate } from "@/components/layout/permission-gate";
import { PermissionEditor } from "@/components/settings/permission-editor";
import { apiFetch, ApiError } from "@/lib/api-client";
import type {
  GaragePermission,
  GarageRoleDto,
  GarageRoleListDto,
  PermissionGroup,
} from "@mygaragepro/shared";

type ModalMode = { type: "edit"; role: GarageRoleDto } | { type: "create" } | null;

export default function RolePermissionsPage() {
  const [data, setData] = useState<GarageRoleListDto | null>(null);
  const [modal, setModal] = useState<ModalMode>(null);
  const [roleName, setRoleName] = useState("");
  const [permissions, setPermissions] = useState<GaragePermission[]>([]);
  const [groups, setGroups] = useState<PermissionGroup[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const list = await apiFetch<GarageRoleListDto>("/settings/garage-roles");
    setData(list);
    setGroups(list.groups);
  }, []);

  useEffect(() => {
    void load().catch(() => setError("Could not load roles"));
  }, [load]);

  function openEdit(role: GarageRoleDto) {
    setModal({ type: "edit", role });
    setRoleName(role.name);
    setPermissions([...role.permissions]);
  }

  function openCreate() {
    setModal({ type: "create" });
    setRoleName("");
    setPermissions([]);
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

  function permissionSummary(role: GarageRoleDto) {
    if (role.permissions.length === 0) return "No access";
    if (role.permissions.length >= 8) return "Broad access";
    return `${role.permissions.length} permission(s)`;
  }

  return (
    <PermissionGate permission="permissions.manage">
      <p className="mb-2 text-xs text-[var(--muted)]">
        Home /{" "}
        <Link href="/settings" className="hover:text-accent">
          Settings
        </Link>{" "}
        / <span className="text-accent">Roles & access</span>
      </p>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Roles & access</h1>
          <p className="mt-1 max-w-2xl text-sm text-[var(--muted)]">
            Create roles for your team and choose what each can access. Default roles: Manager,
            Mechanic, and Staff. The owner always has full access.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white"
        >
          Add role
        </button>
      </div>

      {message && <p className="mb-4 text-sm text-green-700 dark:text-green-400">{message}</p>}
      {error && !modal && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {!data ? (
        <p className="text-sm text-[var(--muted)]">Loading…</p>
      ) : (
        <ul className="space-y-2">
          {data.roles.map((role) => (
            <li
              key={role.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{role.name}</span>
                  {role.isDefault && (
                    <span className="rounded-full bg-[var(--background)] px-2 py-0.5 text-xs text-[var(--muted)]">
                      Default
                    </span>
                  )}
                </div>
                <p className="text-xs text-[var(--muted)]">
                  {permissionSummary(role)} · {role.userCount} user(s)
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => openEdit(role)}
                  className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm hover:bg-[var(--background)]"
                >
                  Edit access
                </button>
                {!role.isDefault && (
                  <button
                    type="button"
                    onClick={() => void deleteRole(role)}
                    className="rounded-lg border border-red-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                  >
                    Delete
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {modal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="role-modal-title"
        >
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl">
            <h2 id="role-modal-title" className="mb-4 text-lg font-semibold">
              {modal.type === "create" ? "New role" : `Edit: ${modal.role.name}`}
            </h2>
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
          </div>
        </div>
      )}
    </PermissionGate>
  );
}
