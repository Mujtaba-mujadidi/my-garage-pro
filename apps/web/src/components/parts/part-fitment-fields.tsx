"use client";

import {
  formatPartFitmentLabel,
  PART_FITMENT_TYPE_LABEL,
  type PartFitmentInput,
  type PartFitmentType,
} from "@mygaragepro/shared";

const inputClass =
  "w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm";

export type DraftFitmentRow = PartFitmentInput & { clientId: string };

type Props = {
  fitmentType: PartFitmentType;
  fitments: DraftFitmentRow[];
  onFitmentTypeChange: (type: PartFitmentType) => void;
  onFitmentsChange: (rows: DraftFitmentRow[]) => void;
};

// Incrementing ids avoid crypto.randomUUID() — unstable across SSR/client and triggers hydration warnings.
let nextFitmentRowId = 0;
function newFitmentRowId() {
  nextFitmentRowId += 1;
  return `fitment-row-${nextFitmentRowId}`;
}

function newRow(yearFrom?: number): DraftFitmentRow {
  return {
    clientId: newFitmentRowId(),
    make: "",
    model: "",
    // yearFrom is set in event handlers (client-only) to avoid SSR/client date mismatches.
    yearFrom: yearFrom ?? 2020,
    yearTo: null,
    notes: "",
  };
}

/** Blank row for the add-part form — only call from client event handlers. */
export function emptyFitmentRow(): DraftFitmentRow {
  return newRow(new Date().getFullYear());
}

/** Vehicle fitment section on the add/edit part form. */
export function PartFitmentFields({
  fitmentType,
  fitments,
  onFitmentTypeChange,
  onFitmentsChange,
}: Props) {
  function updateRow(clientId: string, patch: Partial<DraftFitmentRow>) {
    onFitmentsChange(fitments.map((r) => (r.clientId === clientId ? { ...r, ...patch } : r)));
  }

  function setFitmentType(type: PartFitmentType) {
    onFitmentTypeChange(type);
    // Switching to vehicle-specific always starts with one blank row for data entry.
    if (type === "VEHICLE_SPECIFIC" && fitments.length === 0) {
      onFitmentsChange([newRow(new Date().getFullYear())]);
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-[var(--border)] bg-[var(--background)]/50 p-3">
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
          Vehicle fitment
        </p>
        <div className="flex flex-wrap gap-4 text-sm">
          {(Object.keys(PART_FITMENT_TYPE_LABEL) as PartFitmentType[]).map((type) => (
            <label key={type} className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="fitmentType"
                checked={fitmentType === type}
                onChange={() => setFitmentType(type)}
                className="h-4 w-4 border border-[var(--border)]"
              />
              {PART_FITMENT_TYPE_LABEL[type]}
            </label>
          ))}
        </div>
        <p className="mt-2 text-xs text-[var(--muted)]">
          Universal parts (oil, gloves) appear on every job. Vehicle-specific parts are filtered by
          make and model when using stock on a repair job.
        </p>
      </div>

      {fitmentType === "VEHICLE_SPECIFIC" && (
        <>
          <div className="space-y-3">
            {fitments.map((row, index) => (
              <div
                key={row.clientId}
                className="grid gap-3 rounded-lg border border-[var(--border)] p-3 sm:grid-cols-6"
              >
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-medium text-[var(--muted)]">
                    Make {index === 0 && <span className="text-red-600">*</span>}
                  </label>
                  <input
                    value={row.make}
                    onChange={(e) => updateRow(row.clientId, { make: e.target.value })}
                    className={inputClass}
                    placeholder="Toyota"
                    required
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-medium text-[var(--muted)]">
                    Model {index === 0 && <span className="text-red-600">*</span>}
                  </label>
                  <input
                    value={row.model}
                    onChange={(e) => updateRow(row.clientId, { model: e.target.value })}
                    className={inputClass}
                    placeholder="Prius"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-[var(--muted)]">
                    Year from {index === 0 && <span className="text-red-600">*</span>}
                  </label>
                  <input
                    type="number"
                    min={1900}
                    max={2100}
                    value={row.yearFrom}
                    onChange={(e) =>
                      updateRow(row.clientId, { yearFrom: Number(e.target.value) || row.yearFrom })
                    }
                    className={inputClass}
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Year to</label>
                  <input
                    type="number"
                    min={1900}
                    max={2100}
                    value={row.yearTo ?? ""}
                    onChange={(e) =>
                      updateRow(row.clientId, {
                        yearTo: e.target.value ? Number(e.target.value) : null,
                      })
                    }
                    className={inputClass}
                    placeholder="Open"
                  />
                </div>
                <div className="sm:col-span-5">
                  <label className="mb-1 block text-xs font-medium text-[var(--muted)]">
                    Notes (trim, engine…)
                  </label>
                  <input
                    value={row.notes ?? ""}
                    onChange={(e) => updateRow(row.clientId, { notes: e.target.value })}
                    className={inputClass}
                    placeholder="Optional"
                  />
                </div>
                <div className="flex items-end sm:col-span-1">
                  <button
                    type="button"
                    disabled={fitments.length === 1}
                    onClick={() =>
                      onFitmentsChange(fitments.filter((r) => r.clientId !== row.clientId))
                    }
                    className="w-full rounded-lg border border-[var(--border)] px-2 py-2 text-xs text-[var(--muted)] hover:bg-[var(--surface)] disabled:opacity-40"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => onFitmentsChange([...fitments, newRow(new Date().getFullYear())])}
            className="text-xs font-medium text-accent hover:underline"
          >
            + Add another fitment
          </button>

          {fitments.some((r) => r.make.trim() && r.model.trim()) && (
            <div className="flex flex-wrap gap-2">
              {fitments
                .filter((r) => r.make.trim() && r.model.trim())
                .map((r) => (
                  <span
                    key={r.clientId}
                    className="rounded-full bg-accent/10 px-2.5 py-0.5 text-xs font-medium text-accent"
                  >
                    {formatPartFitmentLabel({
                      make: r.make.trim(),
                      model: r.model.trim(),
                      yearFrom: r.yearFrom,
                      yearTo: r.yearTo ?? null,
                    })}
                  </span>
                ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
