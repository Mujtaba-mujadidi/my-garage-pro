"use client";

import { STICKY_TABLE_HEAD_CLASS, TableScroll } from "@/components/ui/table-scroll";
import { useMemo, useState, type ReactNode } from "react";

export type TableColumn<T> = {
  id: string;
  header: string;
  align?: "left" | "right";
  cell: (row: T) => ReactNode;
  searchText?: (row: T) => string;
};

type SearchableTableProps<T> = {
  rows: T[];
  columns: TableColumn<T>[];
  getRowId: (row: T) => string;
  searchPlaceholder?: string;
  countLabel?: (filtered: number, total: number) => string;
  emptyLabel?: string;
  noMatchLabel?: string;
  pageSize?: number;
  minWidth?: string;
};

const DEFAULT_PAGE_SIZE = 25;

export function SearchableTable<T>({
  rows,
  columns,
  getRowId,
  searchPlaceholder = "Search…",
  countLabel = (filtered, total) => `${filtered} of ${total}`,
  emptyLabel = "No records yet",
  noMatchLabel = "No matching records",
  pageSize = DEFAULT_PAGE_SIZE,
  minWidth = "640px",
}: SearchableTableProps<T>) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => {
      const haystack = columns
        .map((col) => col.searchText?.(row) ?? "")
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [rows, search, columns]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  const pageRows = filtered.slice(safePage * pageSize, safePage * pageSize + pageSize);

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
            placeholder={searchPlaceholder}
            className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-1.5 text-sm text-[var(--foreground)]"
          />
        </label>
        <p className="text-xs text-[var(--muted)]">{countLabel(filtered.length, rows.length)}</p>
      </div>

      <TableScroll>
        <table className="w-full text-left text-sm" style={{ minWidth }}>
          <thead className={`${STICKY_TABLE_HEAD_CLASS} text-[var(--foreground)]`}>
            <tr>
              {columns.map((col) => (
                <th
                  key={col.id}
                  className={`px-4 py-3 font-semibold ${col.align === "right" ? "text-right" : ""}`}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center text-[var(--muted)]">
                  {rows.length === 0 ? emptyLabel : noMatchLabel}
                </td>
              </tr>
            ) : (
              pageRows.map((row) => (
                <tr
                  key={getRowId(row)}
                  className="border-t border-[var(--border)] hover:bg-[var(--background)]"
                >
                  {columns.map((col) => (
                    <td
                      key={col.id}
                      className={`px-4 py-3 ${col.align === "right" ? "text-right" : ""}`}
                    >
                      {col.cell(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </TableScroll>

      {filtered.length > pageSize && (
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
