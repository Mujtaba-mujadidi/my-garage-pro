export type TyreStatus = "ACTIVE" | "INACTIVE";

export type TyreCondition = "NEW" | "PART_WORN";

export type TyreMovementType = "RECEIPT" | "SALE" | "CONSUMPTION" | "RETURN" | "ADJUSTMENT";

export type JobTyreUsageStatus = "CONSUMED" | "RETURNED";

export type TyreTaskPriceTier = "CUSTOMER" | "TRADE" | "CUSTOM";

export type CreateRepairTaskTyreInput = {
  tyreId: string;
  quantity: number;
  priceTier: TyreTaskPriceTier;
  /** Unit price ex VAT per tyre, incl. fitting — required when priceTier is CUSTOM. */
  sellPriceNet?: number;
};

export const TYRE_CONDITION_LABEL: Record<TyreCondition, string> = {
  NEW: "New",
  PART_WORN: "Part worn",
};

export type TyreDto = {
  id: string;
  /** Tyre code — typically auto-generated from size (no spaces). */
  skuCode: string;
  brand: string | null;
  model: string | null;
  size: string;
  loadIndex: string | null;
  speedRating: string | null;
  condition: TyreCondition;
  quantityOnHand: string;
  minQuantity: string;
  costPriceNet: string;
  sellPriceNet: string;
  tradeSellPriceNet: string;
  fittingChargeNet: string;
  supplierId: string | null;
  supplierName: string | null;
  location: string | null;
  notes: string | null;
  status: TyreStatus;
  isLowStock: boolean;
  displayLabel: string;
  createdAt: string;
  updatedAt: string;
};

export type JobTyreUsageDto = {
  id: string;
  repairJobId: string;
  repairTaskId: string | null;
  repairTaskTitle: string | null;
  tyreId: string;
  skuCode: string;
  tyreLabel: string;
  quantity: string;
  costPriceNet: string;
  sellPriceNet: string;
  fittingChargeNet: string;
  lineSellTotalNet: string;
  status: JobTyreUsageStatus;
  consumedAt: string;
  returnedAt: string | null;
};

export function tyreIsLowStock(quantityOnHand: string | number, minQuantity: string | number) {
  return Number(quantityOnHand) <= Number(minQuantity);
}

export function formatTyreLabel(tyre: {
  brand?: string | null;
  model?: string | null;
  size: string;
  loadIndex?: string | null;
  speedRating?: string | null;
}) {
  const spec = [tyre.size, tyre.loadIndex, tyre.speedRating].filter(Boolean).join(" ");
  const name = [tyre.brand, tyre.model].filter(Boolean).join(" ");
  return name ? `${name} — ${spec}` : spec;
}

/** Letters and digits only — no spaces or special characters. */
export function sanitizeTyreCode(value: string): string {
  return value.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

/** Tyre code from size: digits and letters only. e.g. 205/55 R16 → 20555R16 */
export function generateTyreCodeFromSize(size: string): string {
  return sanitizeTyreCode(size);
}

/** Base tyre code; appends brand letters/digits when provided (helps uniqueness). */
export function previewTyreCode(size: string, brand?: string | null): string {
  const base = generateTyreCodeFromSize(size);
  if (!brand?.trim()) return base;
  const suffix = sanitizeTyreCode(brand).slice(0, 16);
  return suffix ? `${base}${suffix}` : base;
}
