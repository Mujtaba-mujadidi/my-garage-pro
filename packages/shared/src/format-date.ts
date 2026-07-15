/**
 * Display helpers for UK date formats.
 * API wire format stays ISO (`YYYY-MM-DD` / full ISO datetime).
 */

/** Parse a date-only `YYYY-MM-DD` without timezone shift. */
function partsFromIsoDate(iso: string): { day: string; month: string; year: string } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso.trim());
  if (!m) return null;
  return { year: m[1], month: m[2], day: m[3] };
}

/** Format as `DD/MM/YYYY`. Accepts `YYYY-MM-DD` or a full ISO datetime string. */
export function formatDateUk(iso: string | null | undefined): string {
  if (!iso) return "—";
  const parts = partsFromIsoDate(iso);
  if (parts) return `${parts.day}/${parts.month}/${parts.year}`;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/**
 * Format as `DD/MM/YYYY, HH:mm` (24h, en-GB).
 * For date-only values, returns `DD/MM/YYYY` with no time.
 */
export function formatDateTimeUk(iso: string | null | undefined): string {
  if (!iso) return "—";
  const trimmed = iso.trim();
  // Pure date-only — no time component to show
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return formatDateUk(trimmed);
  }
  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}
