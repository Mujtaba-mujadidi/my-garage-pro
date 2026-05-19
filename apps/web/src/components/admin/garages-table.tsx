"use client";

import { SearchableTable, type TableColumn } from "@/components/ui/searchable-table";
import type { GarageAccountDto } from "@mygaragepro/shared";
import { MODULE_KEYS } from "@mygaragepro/shared";

type Props = {
  garages: GarageAccountDto[];
  onEdit: (garage: GarageAccountDto) => void;
};

function moduleSummary(g: GarageAccountDto) {
  const n = g.enabledModules.length;
  const total = MODULE_KEYS.length;
  if (n === 0) return "None";
  if (n >= total) return "All modules";
  return `${n} of ${total}`;
}

export function GaragesTable({ garages, onEdit }: Props) {
  const columns: TableColumn<GarageAccountDto>[] = [
    {
      id: "name",
      header: "Garage",
      searchText: (g) => g.name,
      cell: (g) => <span className="font-medium">{g.name}</span>,
    },
    {
      id: "slug",
      header: "Slug",
      searchText: (g) => g.slug,
      cell: (g) => <span className="font-mono text-xs text-[var(--muted)]">{g.slug}</span>,
    },
    {
      id: "status",
      header: "Status",
      searchText: (g) => g.status,
      cell: (g) =>
        g.status === "ACTIVE" ? (
          <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-800 dark:bg-green-950 dark:text-green-300">
            Active
          </span>
        ) : (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-300">
            {g.status}
          </span>
        ),
    },
    {
      id: "modules",
      header: "Modules",
      searchText: (g) => moduleSummary(g),
      cell: (g) => <span className="text-[var(--muted)]">{moduleSummary(g)}</span>,
    },
    {
      id: "actions",
      header: "Actions",
      align: "right",
      cell: (g) => (
        <button
          type="button"
          onClick={() => onEdit(g)}
          className="rounded-lg border border-[var(--border)] px-3 py-1 text-xs font-medium hover:bg-[var(--background)]"
        >
          Edit
        </button>
      ),
    },
  ];

  return (
    <SearchableTable
      rows={garages}
      columns={columns}
      getRowId={(g) => g.id}
      searchPlaceholder="Name, slug, status…"
      countLabel={(filtered, total) =>
        `${filtered} of ${total} garage${total === 1 ? "" : "s"}`
      }
      emptyLabel="No garages yet"
      noMatchLabel="No matching garages"
      minWidth="720px"
    />
  );
}
