"use client";

import type { GaragePermission, PermissionGroup } from "@mygaragepro/shared";

type Props = {
  groups: PermissionGroup[];
  permissions: GaragePermission[];
  onChange: (permissions: GaragePermission[]) => void;
};

function toggle(
  current: GaragePermission[],
  permission: GaragePermission,
  enabled: boolean,
): GaragePermission[] {
  const set = new Set(current);
  if (enabled) set.add(permission);
  else set.delete(permission);
  return [...set];
}

export function PermissionEditor({ groups, permissions, onChange }: Props) {
  function setGroupAccess(group: PermissionGroup, level: "read" | "write", enabled: boolean) {
    let next = permissions;
    if (level === "read") {
      next = toggle(next, group.read, enabled);
      if (!enabled && group.write) next = toggle(next, group.write, false);
    } else if (group.write) {
      next = toggle(next, group.write, enabled);
      if (enabled) next = toggle(next, group.read, true);
    }
    onChange(next);
  }

  return (
    <div className="space-y-3">
      {groups.map((group) => (
        <div
          key={group.id}
          className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-3"
        >
          <div className="mb-2 text-sm font-medium">{group.label}</div>
          <p className="mb-2 text-xs text-[var(--muted)]">{group.description}</p>
          <div className="flex gap-6 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={permissions.includes(group.read)}
                onChange={(e) => setGroupAccess(group, "read", e.target.checked)}
                className="h-4 w-4 accent-[var(--accent)]"
              />
              View
            </label>
            {group.write && (
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={permissions.includes(group.write)}
                  onChange={(e) => setGroupAccess(group, "write", e.target.checked)}
                  className="h-4 w-4 accent-[var(--accent)]"
                />
                Full access
              </label>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
