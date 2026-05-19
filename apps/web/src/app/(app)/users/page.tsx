"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { PermissionGate } from "@/components/layout/permission-gate";
import { useSession } from "@/components/providers/session-provider";
import { Modal } from "@/components/ui/modal";
import { TeamUserFormFields, type RoleOption } from "@/components/users/team-user-form-fields";
import { TeamUsersTable } from "@/components/users/team-users-table";
import { apiFetch, ApiError } from "@/lib/api-client";
import type { TeamUserDto } from "@mygaragepro/shared";

type EditState = {
  user: TeamUserDto;
  displayName: string;
  email: string;
  garageRoleId: string;
  status: "ACTIVE" | "DISABLED";
  password: string;
};

const defaultCreate = {
  email: "",
  displayName: "",
  password: "demo",
  garageRoleId: "",
};

export default function UsersPage() {
  const { session, loading: sessionLoading, hasPermission } = useSession();
  const canWrite = hasPermission("users.write");

  const [users, setUsers] = useState<TeamUserDto[]>([]);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [create, setCreate] = useState(defaultCreate);
  const [showCreate, setShowCreate] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [edit, setEdit] = useState<EditState | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!session?.accessToken) return;
    setLoading(true);
    setError("");
    try {
      const [userRows, roleList] = await Promise.all([
        apiFetch<TeamUserDto[]>("/users"),
        apiFetch<RoleOption[]>("/users/roles"),
      ]);
      setUsers(userRows);
      setRoles(roleList);
      const mechanic = roleList.find((r) => r.slug === "mechanic");
      const defaultRoleId = mechanic?.id ?? roleList[0]?.id ?? "";
      setCreate((c) => ({ ...c, garageRoleId: c.garageRoleId || defaultRoleId }));
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? `${err.message} (${err.status})`
          : "Could not load users";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken]);

  useEffect(() => {
    if (sessionLoading || !session) return;
    void load();
  }, [load, session, sessionLoading]);

  function openCreate() {
    const mechanic = roles.find((r) => r.slug === "mechanic");
    setCreate({
      email: "",
      displayName: "",
      password: "demo",
      garageRoleId: mechanic?.id ?? roles[0]?.id ?? "",
    });
    setError("");
    setShowCreate(true);
  }

  function closeCreate() {
    setShowCreate(false);
    setError("");
  }

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
    setSaving(true);
    setMessage("");
    setError("");
    try {
      await apiFetch("/users", {
        method: "POST",
        body: JSON.stringify(create),
      });
      setMessage("User created.");
      closeCreate();
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Create failed");
    } finally {
      setSaving(false);
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

  return (
    <PermissionGate permission="users.read">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mb-1 text-xs text-[var(--muted)]">
            Home / <span className="text-accent">Team</span>
          </p>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Team users</h1>
        </div>
        {canWrite && (
          <button
            type="button"
            onClick={openCreate}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
          >
            Add user
          </button>
        )}
      </div>

      {message && <p className="mb-4 text-sm text-green-700 dark:text-green-400">{message}</p>}
      {error && !showCreate && !edit && (
        <p className="mb-4 text-sm text-red-600">{error}</p>
      )}

      {loading ? (
        <p className="text-sm text-[var(--muted)]">Loading team…</p>
      ) : (
        <TeamUsersTable users={users} canWrite={canWrite} onEdit={openEdit} />
      )}

      <Modal title="Add team member" open={showCreate} onClose={closeCreate}>
        <form onSubmit={onCreate} className="space-y-4">
          <TeamUserFormFields
            mode="create"
            displayName={create.displayName}
            email={create.email}
            password={create.password}
            garageRoleId={create.garageRoleId}
            status="ACTIVE"
            roles={roles}
            onDisplayNameChange={(v) => setCreate((c) => ({ ...c, displayName: v }))}
            onEmailChange={(v) => setCreate((c) => ({ ...c, email: v }))}
            onPasswordChange={(v) => setCreate((c) => ({ ...c, password: v }))}
            onGarageRoleIdChange={(v) => setCreate((c) => ({ ...c, garageRoleId: v }))}
            onStatusChange={() => {}}
          />
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
              {saving ? "Creating…" : "Create user"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal title="Edit team member" open={edit !== null} onClose={closeEdit}>
        {edit && (
          <form onSubmit={onSaveEdit} className="space-y-4">
            <TeamUserFormFields
              mode="edit"
              user={edit.user}
              displayName={edit.displayName}
              email={edit.email}
              password={edit.password}
              garageRoleId={edit.garageRoleId}
              status={edit.status}
              roles={roles}
              onDisplayNameChange={(v) => setEdit({ ...edit, displayName: v })}
              onEmailChange={(v) => setEdit({ ...edit, email: v })}
              onPasswordChange={(v) => setEdit({ ...edit, password: v })}
              onGarageRoleIdChange={(v) => setEdit({ ...edit, garageRoleId: v })}
              onStatusChange={(v) => setEdit({ ...edit, status: v })}
            />
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
        )}
      </Modal>
    </PermissionGate>
  );
}
