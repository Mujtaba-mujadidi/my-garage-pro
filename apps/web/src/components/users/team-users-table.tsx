"use client";

import type { TeamUserDto } from "@mygaragepro/shared";
import DataTable from "datatables.net-dt";
import { useEffect, useRef } from "react";
import "datatables.net-dt/css/dataTables.dataTables.min.css";

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
  const tableRef = useRef<HTMLTableElement>(null);
  const dtRef = useRef<InstanceType<typeof DataTable> | null>(null);
  const usersRef = useRef(users);
  usersRef.current = users;

  useEffect(() => {
    if (!tableRef.current) return;

    dtRef.current?.destroy();
    dtRef.current = new DataTable(tableRef.current, {
      pageLength: 25,
      order: [[0, "asc"]],
      layout: {
        topStart: "search",
        topEnd: null,
        bottomStart: "info",
        bottomEnd: "paging",
      },
      columnDefs: canWrite ? [{ orderable: false, targets: -1 }] : [],
      language: {
        search: "Search team:",
        emptyTable: "No team members yet",
        zeroRecords: "No matching team members",
      },
    });

    return () => {
      dtRef.current?.destroy();
      dtRef.current = null;
    };
  }, [users, canWrite]);

  function handleTableClick(e: React.MouseEvent<HTMLDivElement>) {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-edit-user-id]");
    if (!btn?.dataset.editUserId) return;
    const user = usersRef.current.find((u) => u.id === btn.dataset.editUserId);
    if (user) onEdit(user);
  }

  return (
    <div
      className="team-users-datatable overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3"
      onClick={handleTableClick}
    >
      <table ref={tableRef} className="display w-full text-left text-sm">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Role</th>
            <th>Status</th>
            {canWrite && <th className="!text-right">Actions</th>}
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td className="font-medium">{u.displayName}</td>
              <td>{u.email}</td>
              <td>{roleLabel(u)}</td>
              <td>
                {u.status === "DISABLED" ? (
                  <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700 dark:bg-red-950 dark:text-red-300">
                    Disabled
                  </span>
                ) : (
                  <span className="rounded-full bg-[var(--background)] px-2 py-0.5 text-xs text-[var(--muted)]">
                    Active
                  </span>
                )}
              </td>
              {canWrite && (
                <td className="text-right">
                  <button
                    type="button"
                    data-edit-user-id={u.id}
                    className="rounded-lg border border-[var(--border)] px-3 py-1 text-xs font-medium hover:bg-[var(--background)]"
                  >
                    Edit
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
