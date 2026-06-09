/** UK default standard rate (most garage goods & services). */
export const UK_STANDARD_VAT_PERCENT = 20;

export const DEFAULT_VAT_RATE_OPTIONS = [
  { label: "Standard VAT 20%", value: "20" },
  { label: "Reduced VAT 5%", value: "5" },
  { label: "Zero rated", value: "0" },
] as const;

/**
 * Extract VAT from a VAT-inclusive gross total.
 * Example: £120 at 20% → VAT £20, net £100.
 */
export function vatFromInclusiveGross(gross: number, ratePercent: number): number {
  if (ratePercent <= 0 || gross <= 0) return 0;
  return Math.round(((gross * ratePercent) / (100 + ratePercent)) * 100) / 100;
}

export function netFromInclusiveGross(gross: number, ratePercent: number): number {
  return Math.round((gross - vatFromInclusiveGross(gross, ratePercent)) * 100) / 100;
}

/** Guess configured rate when editing an entry that already has VAT. */
export function inferVatRatePercent(gross: number, vat: number): string {
  if (vat <= 0 || gross <= vat) return String(UK_STANDARD_VAT_PERCENT);
  const net = gross - vat;
  const implied = (vat / net) * 100;
  const candidates = [20, 5, 0];
  const nearest = candidates.reduce((best, r) =>
    Math.abs(implied - r) < Math.abs(implied - best) ? r : best,
  );
  return String(nearest);
}
