/** How broadly a part can be used on vehicles. */
export type PartFitmentType = "UNIVERSAL" | "VEHICLE_SPECIFIC";

export const PART_FITMENT_TYPE_LABEL: Record<PartFitmentType, string> = {
  UNIVERSAL: "Universal (any vehicle)",
  VEHICLE_SPECIFIC: "Vehicle-specific",
};

/** One make / model / year-range row attached to a stock part. */
export type PartFitmentDto = {
  id: string;
  make: string;
  model: string;
  yearFrom: number;
  /** Null means "yearFrom onwards" (no upper bound). */
  yearTo: number | null;
  notes: string | null;
};

export type PartVehicleContext = {
  make?: string | null;
  model?: string | null;
  /** When omitted on a job, make/model match is enough (year range not checked). */
  year?: number | null;
};

export type PartFitmentInput = {
  make: string;
  model: string;
  yearFrom: number;
  yearTo?: number | null;
  notes?: string | null;
};

/** Human-readable label, e.g. "Toyota Prius 2010–2015". */
export function formatPartFitmentLabel(
  f: Pick<PartFitmentDto, "make" | "model" | "yearFrom" | "yearTo">,
): string {
  const vehicle = [f.make, f.model].filter(Boolean).join(" ");
  const years = f.yearTo != null ? `${f.yearFrom}–${f.yearTo}` : `${f.yearFrom}+`;
  return `${vehicle} ${years}`.trim();
}

/** Short summary for tables — first fitment plus count if there are more. */
export function summarizePartFitments(
  fitmentType: PartFitmentType | null | undefined,
  fitments: PartFitmentDto[] | null | undefined,
): string {
  const type = fitmentType ?? "UNIVERSAL";
  const rows = fitments ?? [];
  if (type === "UNIVERSAL") return "Universal";
  if (rows.length === 0) return "No fitment set";
  const first = formatPartFitmentLabel(rows[0]);
  if (rows.length === 1) return first;
  return `${first} +${rows.length - 1} more`;
}

function normalizeToken(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

/**
 * Returns true when a part may be used on the given vehicle.
 * Universal parts always match. Vehicle-specific parts need at least one fitment row
 * whose make/model (and year, when provided) overlap the job vehicle.
 */
export function partMatchesVehicle(
  part: {
    fitmentType?: PartFitmentType | null;
    fitments?: PartFitmentDto[] | null;
  },
  vehicle: PartVehicleContext,
): boolean {
  const fitmentType = part.fitmentType ?? "UNIVERSAL";
  const fitments = part.fitments ?? [];
  if (fitmentType === "UNIVERSAL") return true;
  if (fitments.length === 0) return false;

  const make = normalizeToken(vehicle.make);
  const model = normalizeToken(vehicle.model);
  if (!make || !model) return false;

  const year = vehicle.year ?? null;

  return fitments.some((f) => {
    if (normalizeToken(f.make) !== make || normalizeToken(f.model) !== model) return false;
    // Job has no year — accept any fitment row for that make/model.
    if (year == null) return true;
    if (year < f.yearFrom) return false;
    if (f.yearTo != null && year > f.yearTo) return false;
    return true;
  });
}
