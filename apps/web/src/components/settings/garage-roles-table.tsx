"use client";

import { SearchableTable, type TableColumn } from "@/components/ui/searchable-table";
import type { GarageRoleDto, PermissionGroup } from "@mygaragepro/shared";
import { summarizeRoleAccess } from "@mygaragepro/shared";

type Props = {
  roles: GarageRoleDto[];
  groups: PermissionGroup[];
  onEdit: (role: GarageRoleDto) => void;
  onDelete: (role: GarageRoleDto) => void;
};

export function GarageRolesTable({ roles, groups, onEdit, onDelete }: Props) {
  const columns: TableColumn<GarageRoleDto>[] = [
    {
      id: "name",
      header: "Role",
      searchText: (r) => r.name,
      cell: (r) => (
        <div className="flex items-center gap-2">
          <span className="font-medium">{r.name}</span>
          {r.isDefault && (
            <span className="rounded-full bg-[var(--background)] px-2 py-0.5 text-xs text-[var(--muted)]">
              Default
            </span>
          )}
        </div>
      ),
    },
    {
      id: "access",
      header: "Access",
      searchText: (r) => summarizeRoleAccess(r.permissions, groups),
      cell: (r) => (
        <span className="text-[var(--muted)]">
          {summarizeRoleAccess(r.permissions, groups)}
        </span>
      ),
    },
    {
      id: "users",
      header: "Users",
      searchText: (r) => String(r.userCount),
      cell: (r) => r.userCount,
    },
    {
      id: "actions",
      header: "Actions",
      align: "right",
      cell: (r) => (
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => onEdit(r)}
            className="rounded-lg border border-[var(--border)] px-3 py-1 text-xs font-medium hover:bg-[var(--background)]"
          >
            Edit
          </button>
          {!r.isDefault && (
            <button
              type="button"
              onClick={() => onDelete(r)}
              className="rounded-lg border border-red-300 px-3 py-1 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
            >
              Delete
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <SearchableTable
      rows={roles}
      columns={columns}
      getRowId={(r) => r.id}
      searchPlaceholder="Role name, access…"
      countLabel={(filtered, total) =>
        `${filtered} of ${total} role${total === 1 ? "" : "s"}`
      }
      emptyLabel="No roles yet"
      noMatchLabel="No matching roles"
    />
  );
}
