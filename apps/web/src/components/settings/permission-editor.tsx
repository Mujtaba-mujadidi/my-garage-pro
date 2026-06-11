"use client";

import { STICKY_TABLE_HEAD_CLASS, TableScroll } from "@/components/ui/table-scroll";
import type { GaragePermission, PermissionGroup, RoleAccessLevel } from "@mygaragepro/shared";
import {
  roleAccessLevelForGroup,
  workshopViewRolePermissions,
  type WorkshopModuleKey,
} from "@mygaragepro/shared";

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

function applyAccessLevel(
  current: GaragePermission[],
  group: PermissionGroup,
  level: RoleAccessLevel,
): GaragePermission[] {
  let next = toggle(current, group.read, false);
  if (group.write) next = toggle(next, group.write, false);
  if (group.id === "repair" || group.id === "bodywork") {
    for (const perm of workshopViewRolePermissions(group.id as WorkshopModuleKey)) {
      next = toggle(next, perm, false);
    }
  }
  if (level === "view") {
    if (group.id === "repair" || group.id === "bodywork") {
      for (const perm of workshopViewRolePermissions(group.id as WorkshopModuleKey)) {
        next = toggle(next, perm, true);
      }
    } else {
      next = toggle(next, group.read, true);
    }
  } else if (level === "full" && group.write) {
    next = toggle(next, group.read, true);
    next = toggle(next, group.write, true);
  }
  return next;
}

const radioClass = "h-4 w-4 accent-[var(--accent)]";

function AccessRadios({
  group,
  permissions,
  onChange,
}: {
  group: PermissionGroup;
  permissions: GaragePermission[];
  onChange: (level: RoleAccessLevel) => void;
}) {
  const level = roleAccessLevelForGroup(group, permissions);
  const name = `access-${group.id}`;

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
      <label className="flex cursor-pointer items-center gap-2 whitespace-nowrap">
        <input
          type="radio"
          name={name}
          checked={level === "none"}
          onChange={() => onChange("none")}
          className={radioClass}
        />
        No access
      </label>
      <label className="flex cursor-pointer items-center gap-2 whitespace-nowrap">
        <input
          type="radio"
          name={name}
          checked={level === "view"}
          onChange={() => onChange("view")}
          className={radioClass}
        />
        View
      </label>
      {group.write && (
        <label className="flex cursor-pointer items-center gap-2 whitespace-nowrap">
          <input
            type="radio"
            name={name}
            checked={level === "full"}
            onChange={() => onChange("full")}
            className={radioClass}
          />
          Full access
        </label>
      )}
    </div>
  );
}

export function PermissionEditor({ groups, permissions, onChange }: Props) {
  function setGroupLevel(group: PermissionGroup, level: RoleAccessLevel) {
    onChange(applyAccessLevel(permissions, group, level));
  }

  if (groups.length === 0) {
    return (
      <p className="text-sm text-[var(--muted)]">
        No module access options are available. Ask your platform admin to enable modules for
        this garage.
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-[var(--border)]">
      <TableScroll>
      <table className="w-full text-sm">
        <thead className={STICKY_TABLE_HEAD_CLASS}>
          <tr className="border-b border-[var(--border)]">
            <th className="px-3 py-2 text-left text-xs font-semibold text-[var(--muted)]">
              Module
            </th>
            <th className="px-3 py-2 text-left text-xs font-semibold text-[var(--muted)]">
              Access
            </th>
          </tr>
        </thead>
        <tbody>
          {groups.map((group, i) => (
            <tr
              key={group.id}
              className={
                i % 2 === 0 ? "bg-[var(--surface)]" : "bg-[var(--background)]/60"
              }
            >
              <td className="px-3 py-2 align-middle" title={group.description}>
                <span className="font-medium text-[var(--foreground)]">{group.label}</span>
              </td>
              <td className="px-3 py-2 align-middle">
                <AccessRadios
                  group={group}
                  permissions={permissions}
                  onChange={(level) => setGroupLevel(group, level)}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </TableScroll>
    </div>
  );
}
