/** Coerce JSON/form values to numbers for class-transformer (keeps integers valid). */
export function coerceToNumber(value: unknown): unknown {
  if (value === "" || value === null || value === undefined) return value;
  const n = Number(value);
  return Number.isFinite(n) ? n : value;
}

/** Coerce to a whole year (1900–2100 fitment fields). */
export function coerceToInt(value: unknown): unknown {
  const n = coerceToNumber(value);
  return typeof n === "number" ? Math.trunc(n) : n;
}
