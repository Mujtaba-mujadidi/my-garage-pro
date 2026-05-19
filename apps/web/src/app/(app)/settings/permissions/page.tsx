"use client";

import Link from "next/link";
import { Fragment, useCallback, useEffect, useState } from "react";
import { PermissionGate } from "@/components/layout/permission-gate";
import { apiFetch, ApiError } from "@/lib/api-client";
import type {
  ConfigurableRole,
  GaragePermission,
  PermissionGroup,
  RolePermissionMatrixDto,
} from "@mygaragepro/shared";

const ROLE_LABELS: Record<ConfigurableRole, string> = {
  MANAGER: "Manager",
  MECHANIC: "Mechanic",
  ACCOUNTANT: "Accountant",
  READ_ONLY: "Read only",
};

function cloneGrants(grants: RolePermissionMatrixDto["grants"]) {
  return Object.fromEntries(
    Object.entries(grants).map(([role, perms]) => [role, [...perms]]),
  ) as RolePermissionMatrixDto["grants"];
}

function togglePermission(
  grants: RolePermissionMatrixDto["grants"],
  role: ConfigurableRole,
  permission: GaragePermission,
  enabled: boolean,
): RolePermissionMatrixDto["grants"] {
  const next = cloneGrants(grants);
  const set = new Set(next[role]);
  if (enabled) set.add(permission);
  else set.delete(permission);
  next[role] = [...set];
  return next;
}

export default function RolePermissionsPage() {
  const [matrix, setMatrix] = useState<RolePermissionMatrixDto | null>(null);
  const [grants, setGrants] = useState<RolePermissionMatrixDto["grants"] | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const data = await apiFetch<RolePermissionMatrixDto>("/settings/role-permissions");
    setMatrix(data);
    setGrants(cloneGrants(data.grants));
  }, []);

  useEffect(() => {
    void load().catch(() => setError("Could not load role permissions"));
  }, [load]);

  function setGroupAccess(
    role: ConfigurableRole,
    group: PermissionGroup,
    level: "read" | "write",
    enabled: boolean,
  ) {
    if (!grants) return;
    let next = grants;
    if (level === "read") {
      next = togglePermission(next, role, group.read, enabled);
      if (!enabled && group.write) {
        next = togglePermission(next, role, group.write, false);
      }
    } else if (group.write) {
      next = togglePermission(next, role, group.write, enabled);
      if (enabled) {
        next = togglePermission(next, role, group.read, true);
      }
    }
    setGrants(next);
  }

  function hasRead(role: ConfigurableRole, group: PermissionGroup) {
    return grants?.[role]?.includes(group.read) ?? false;
  }

  function hasWrite(role: ConfigurableRole, group: PermissionGroup) {
    return group.write ? (grants?.[role]?.includes(group.write) ?? false) : false;
  }

  async function save() {
    if (!grants) return;
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const updated = await apiFetch<RolePermissionMatrixDto>("/settings/role-permissions", {
        method: "PUT",
        body: JSON.stringify({ grants }),
      });
      setMatrix(updated);
      setGrants(cloneGrants(updated.grants));
      setMessage("Permissions saved. Staff must sign out and back in for changes to apply.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save permissions");
    } finally {
      setSaving(false);
    }
  }

  return (
    <PermissionGate permission="permissions.manage">
      <p className="mb-2 text-xs text-[var(--muted)]">
        Home /{" "}
        <Link href="/settings" className="hover:text-accent">
          Settings
        </Link>{" "}
        / <span className="text-accent">Staff permissions</span>
      </p>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Staff permissions</h1>
          <p className="mt-1 max-w-2xl text-sm text-[var(--muted)]">
            Choose what each role can access in your garage. The owner always has full access.
            Mechanics start with no access until you grant it.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving || !grants}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>

      {message && <p className="mb-4 text-sm text-green-700 dark:text-green-400">{message}</p>}
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {!matrix || !grants ? (
        <p className="text-sm text-[var(--muted)]">Loading…</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--surface)]">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--background)]">
                <th className="px-4 py-3 font-semibold">Module</th>
                {matrix.roles.map((role) => (
                  <th key={role} colSpan={2} className="px-2 py-3 text-center font-semibold">
                    {ROLE_LABELS[role]}
                  </th>
                ))}
              </tr>
              <tr className="border-b border-[var(--border)] text-xs text-[var(--muted)]">
                <th className="px-4 py-2" />
                {matrix.roles.map((role) => (
                  <Fragment key={role}>
                    <th className="px-2 py-2 text-center font-normal">View</th>
                    <th className="px-2 py-2 text-center font-normal">Full</th>
                  </Fragment>
                ))}
              </tr>
            </thead>
            <tbody>
              {matrix.groups.map((group) => (
                <tr key={group.id} className="border-b border-[var(--border)] last:border-0">
                  <td className="px-4 py-3">
                    <div className="font-medium">{group.label}</div>
                    <div className="text-xs text-[var(--muted)]">{group.description}</div>
                  </td>
                  {matrix.roles.map((role) => (
                    <Fragment key={role}>
                      <td className="px-2 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={hasRead(role, group)}
                          onChange={(e) => setGroupAccess(role, group, "read", e.target.checked)}
                          aria-label={`${ROLE_LABELS[role]} view ${group.label}`}
                          className="h-4 w-4 rounded border-[var(--border)] accent-[var(--accent)]"
                        />
                      </td>
                      <td className="px-2 py-3 text-center">
                        {group.write ? (
                          <input
                            type="checkbox"
                            checked={hasWrite(role, group)}
                            onChange={(e) => setGroupAccess(role, group, "write", e.target.checked)}
                            aria-label={`${ROLE_LABELS[role]} full ${group.label}`}
                            className="h-4 w-4 rounded border-[var(--border)] accent-[var(--accent)]"
                          />
                        ) : (
                          <span className="text-[var(--muted)]">—</span>
                        )}
                      </td>
                    </Fragment>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PermissionGate>
  );
}
