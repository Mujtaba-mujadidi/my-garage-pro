"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { PermissionGate } from "@/components/layout/permission-gate";
import { apiFetch, ApiError } from "@/lib/api-client";
import type { TeamUserDto } from "@mygaragepro/shared";

type RoleOption = { id: string; name: string; slug: string };

type EditState = {
  user: TeamUserDto;
  displayName: string;
  email: string;
  garageRoleId: string;
  status: "ACTIVE" | "DISABLED";
  password: string;
};

export default function UsersPage() {
  const [users, setUsers] = useState<TeamUserDto[]>([]);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("demo");
  const [garageRoleId, setGarageRoleId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [edit, setEdit] = useState<EditState | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const [userRows, roleList] = await Promise.all([
      apiFetch<TeamUserDto[]>("/users"),
      apiFetch<RoleOption[]>("/users/roles"),
    ]);
    setUsers(userRows);
    setRoles(roleList);
    setGarageRoleId((current) => {
      if (current) return current;
      const mechanic = roleList.find((r) => r.slug === "mechanic");
      return mechanic?.id ?? roleList[0]?.id ?? "";
    });
  }, []);

  useEffect(() => {
    void load().catch(() => setError("Could not load users"));
  }, [load]);

  function openEdit(user: TeamUserDto) {
    setEdit({
      user,
      displayName: user.displayName,
      email: user.email,
      garageRoleId: user.garageRoleId ?? roles[0]?.id ?? "",
      status: user.status === "DISABLED" ? "DISABLED" : "ACTIVE",
      password: "",
    });
    setError("");
  }

  function closeEdit() {
    setEdit(null);
    setError("");
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setMessage("");
    setError("");
    try {
      await apiFetch("/users", {
        method: "POST",
        body: JSON.stringify({ email, displayName, password, garageRoleId }),
      });
      setEmail("");
      setDisplayName("");
      setMessage("User created.");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Create failed");
    }
  }

  async function onSaveEdit(e: FormEvent) {
    e.preventDefault();
    if (!edit) return;
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const body: Record<string, string> = {
        displayName: edit.displayName.trim(),
        email: edit.email.trim(),
      };
      if (edit.user.role === "STAFF") {
        body.garageRoleId = edit.garageRoleId;
        body.status = edit.status;
      }
      if (edit.password.trim()) {
        body.password = edit.password;
      }
      await apiFetch(`/users/${edit.user.id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      setMessage(
        edit.user.role === "STAFF" && edit.garageRoleId !== edit.user.garageRoleId
          ? "User updated. They should sign out and back in if their role changed."
          : "User updated.",
      );
      closeEdit();
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Update failed");
    } finally {
      setSaving(false);
    }
  }

  const isStaff = (u: TeamUserDto) => u.role === "STAFF";

  return (
    <PermissionGate permission="users.read">
      <h1 className="mb-6 text-2xl font-bold text-[var(--foreground)]">Team users</h1>
      {message && <p className="mb-4 text-sm text-green-700 dark:text-green-400">{message}</p>}
      {error && !edit && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <ul className="mb-8 space-y-2">
        {users.map((u) => (
          <li
            key={u.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm"
          >
            <div className="min-w-0 flex-1">
              <span className="font-medium">{u.displayName}</span>
              {u.status === "DISABLED" && (
                <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700 dark:bg-red-950 dark:text-red-300">
                  Disabled
                </span>
              )}
              <p className="text-[var(--muted)]">{u.email}</p>
            </div>
            <span className="rounded-full bg-[var(--background)] px-2 py-0.5 text-xs">
              {u.role === "OWNER" ? "Owner" : (u.garageRoleName ?? u.role)}
            </span>
            <PermissionGate permission="users.write">
              <button
                type="button"
                onClick={() => openEdit(u)}
                className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs hover:bg-[var(--background)]"
              >
                Edit
              </button>
            </PermissionGate>
          </li>
        ))}
      </ul>

      <PermissionGate permission="users.write">
        <form
          onSubmit={onCreate}
          className="max-w-md space-y-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4"
        >
          <h2 className="text-sm font-semibold">Add user</h2>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Display name"
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
            required
          />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
            required
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
            required
          />
          <select
            value={garageRoleId}
            onChange={(e) => setGarageRoleId(e.target.value)}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
            required
          >
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
          <button type="submit" className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white">
            Create user
          </button>
        </form>
      </PermissionGate>

      {edit && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl">
            <h2 className="mb-4 text-lg font-semibold">Edit team member</h2>
            <form onSubmit={onSaveEdit} className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Display name</label>
                <input
                  value={edit.displayName}
                  onChange={(e) => setEdit({ ...edit, displayName: e.target.value })}
                  required
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Email</label>
                <input
                  type="email"
                  value={edit.email}
                  onChange={(e) => setEdit({ ...edit, email: e.target.value })}
                  required
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                />
              </div>
              {isStaff(edit.user) && (
                <>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Role</label>
                    <select
                      value={edit.garageRoleId}
                      onChange={(e) => setEdit({ ...edit, garageRoleId: e.target.value })}
                      className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                      required
                    >
                      {roles.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Status</label>
                    <select
                      value={edit.status}
                      onChange={(e) =>
                        setEdit({
                          ...edit,
                          status: e.target.value as "ACTIVE" | "DISABLED",
                        })
                      }
                      className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                    >
                      <option value="ACTIVE">Active</option>
                      <option value="DISABLED">Disabled</option>
                    </select>
                  </div>
                </>
              )}
              {edit.user.role === "OWNER" && (
                <p className="text-xs text-[var(--muted)]">
                  Owner name and email can be updated. Role and status cannot be changed here.
                </p>
              )}
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--muted)]">
                  New password (optional)
                </label>
                <input
                  type="password"
                  value={edit.password}
                  onChange={(e) => setEdit({ ...edit, password: e.target.value })}
                  placeholder="Leave blank to keep current"
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeEdit}
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
