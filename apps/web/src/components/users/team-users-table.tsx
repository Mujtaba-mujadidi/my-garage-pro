"use client";

import { SearchableTable, type TableColumn } from "@/components/ui/searchable-table";
import type { TeamUserDto } from "@mygaragepro/shared";

type Props = {
  users: TeamUserDto[];
  canWrite: boolean;
  onEdit: (user: TeamUserDto) => void;
};

function roleLabel(u: TeamUserDto) {
  if (u.role === "OWNER") return "Owner";
  return u.garageRoleName ?? u.role;
}

export function TeamUsersTable({ users, canWrite, onEdit }: Props) {
  const columns: TableColumn<TeamUserDto>[] = [
    {
      id: "name",
      header: "Name",
      searchText: (u: TeamUserDto) => u.displayName,
      cell: (u: TeamUserDto) => <span className="font-medium">{u.displayName}</span>,
    },
    {
      id: "email",
      header: "Email",
      searchText: (u: TeamUserDto) => u.email,
      cell: (u: TeamUserDto) => u.email,
    },
    {
      id: "role",
      header: "Role",
      searchText: (u: TeamUserDto) => roleLabel(u),
      cell: (u: TeamUserDto) => roleLabel(u),
    },
    {
      id: "status",
      header: "Status",
      searchText: (u: TeamUserDto) => u.status,
      cell: (u: TeamUserDto) =>
        u.status === "DISABLED" ? (
          <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700 dark:bg-red-950 dark:text-red-300">
            Disabled
          </span>
        ) : (
          <span className="rounded-full bg-[var(--background)] px-2 py-0.5 text-xs text-[var(--muted)]">
            Active
          </span>
        ),
    },
  ];

  if (canWrite) {
    columns.push({
      id: "actions",
      header: "Actions",
      align: "right" as const,
      cell: (u: TeamUserDto) => (
        <button
          type="button"
          onClick={() => onEdit(u)}
          className="rounded-lg border border-[var(--border)] px-3 py-1 text-xs font-medium hover:bg-[var(--background)]"
        >
          Edit
        </button>
      ),
    });
  }

  return (
    <SearchableTable
      rows={users}
      columns={columns}
      getRowId={(u) => u.id}
      searchPlaceholder="Name, email, role…"
      countLabel={(filtered, total) =>
        `${filtered} of ${total} member${total === 1 ? "" : "s"}`
      }
      emptyLabel="No team members yet"
      noMatchLabel="No matching team members"
    />
  );
}
