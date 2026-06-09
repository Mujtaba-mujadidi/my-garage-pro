"use client";

import { SearchableTable, type TableColumn } from "@/components/ui/searchable-table";
import { TableRowActionsMenu } from "@/components/ui/table-row-actions-menu";
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
      cell: (r) => {
        const actions = [
          { label: "Edit", onClick: () => onEdit(r) },
          ...(!r.isDefault
            ? [
                {
                  label: "Delete",
                  variant: "danger" as const,
                  onClick: () => onDelete(r),
                },
              ]
            : []),
        ];
        return (
          <TableRowActionsMenu
            triggerLabel={`Actions for ${r.name}`}
            actions={actions}
          />
        );
      },
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
