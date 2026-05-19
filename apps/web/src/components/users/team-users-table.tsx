"use client";

import type { TeamUserDto } from "@mygaragepro/shared";
import { useMemo, useState } from "react";

type Props = {
  users: TeamUserDto[];
  canWrite: boolean;
  onEdit: (user: TeamUserDto) => void;
};

const PAGE_SIZE = 25;

function roleLabel(u: TeamUserDto) {
  if (u.role === "OWNER") return "Owner";
  return u.garageRoleName ?? u.role;
}

export function TeamUsersTable({ users, canWrite, onEdit }: Props) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => {
      const haystack = [u.displayName, u.email, roleLabel(u), u.status].join(" ").toLowerCase();
      return haystack.includes(q);
    });
  }, [users, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageRows = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
        <label className="flex min-w-[200px] flex-1 items-center gap-2 text-sm text-[var(--muted)]">
          <span className="shrink-0">Search</span>
          <input
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            placeholder="Name, email, role…"
            className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-1.5 text-sm text-[var(--foreground)]"
          />
        </label>
        <p className="text-xs text-[var(--muted)]">
          {filtered.length} of {users.length} member{users.length === 1 ? "" : "s"}
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-[var(--background)] text-[var(--foreground)]">
            <tr>
              <th className="px-4 py-3 font-semibold">Name</th>
              <th className="px-4 py-3 font-semibold">Email</th>
              <th className="px-4 py-3 font-semibold">Role</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              {canWrite && <th className="px-4 py-3 text-right font-semibold">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 ? (
              <tr>
                <td
                  colSpan={canWrite ? 5 : 4}
                  className="px-4 py-8 text-center text-[var(--muted)]"
                >
                  {users.length === 0 ? "No team members yet" : "No matching team members"}
                </td>
              </tr>
            ) : (
              pageRows.map((u) => (
                <tr
                  key={u.id}
                  className="border-t border-[var(--border)] hover:bg-[var(--background)]"
                >
                  <td className="px-4 py-3 font-medium">{u.displayName}</td>
                  <td className="px-4 py-3">{u.email}</td>
                  <td className="px-4 py-3">{roleLabel(u)}</td>
                  <td className="px-4 py-3">
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
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => onEdit(u)}
                        className="rounded-lg border border-[var(--border)] px-3 py-1 text-xs font-medium hover:bg-[var(--background)]"
                      >
                        Edit
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {filtered.length > PAGE_SIZE && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border)] px-4 py-3 text-xs text-[var(--muted)]">
          <span>
            Page {safePage + 1} of {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={safePage === 0}
              onClick={() => setPage((p) => p - 1)}
              className="rounded border border-[var(--border)] px-2 py-1 disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={safePage >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
              className="rounded border border-[var(--border)] px-2 py-1 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
