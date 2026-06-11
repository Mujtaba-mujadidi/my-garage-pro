import type { Supplier, Tyre } from "@prisma/client";
import { formatTyreLabel, tyreIsLowStock, type TyreDto } from "@mygaragepro/shared";

type TyreRow = Tyre & {
  supplier?: Pick<Supplier, "name"> | null;
};

export function toTyreDto(row: TyreRow): TyreDto {
  const qty = row.quantityOnHand.toString();
  const min = row.minQuantity.toString();
  return {
    id: row.id,
    skuCode: row.skuCode,
    brand: row.brand,
    model: row.model,
    size: row.size,
    loadIndex: row.loadIndex,
    speedRating: row.speedRating,
    condition: row.condition,
    quantityOnHand: qty,
    minQuantity: min,
    costPriceNet: row.costPriceNet.toString(),
    sellPriceNet: row.sellPriceNet.toString(),
    tradeSellPriceNet: row.tradeSellPriceNet.toString(),
    fittingChargeNet: row.fittingChargeNet.toString(),
    supplierId: row.supplierId,
    supplierName: row.supplier?.name ?? null,
    location: row.location,
    notes: row.notes,
    status: row.status,
    isLowStock: tyreIsLowStock(qty, min),
    displayLabel: formatTyreLabel(row),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
