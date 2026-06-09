import type { Part, PartFitment, Supplier } from "@prisma/client";
import { partIsLowStock, type PartDto, type PartFitmentDto } from "@mygaragepro/shared";

type PartRow = Part & {
  supplier?: Pick<Supplier, "name"> | null;
  fitments?: PartFitment[];
};

export function toPartFitmentDto(row: PartFitment): PartFitmentDto {
  return {
    id: row.id,
    make: row.make,
    model: row.model,
    yearFrom: row.yearFrom,
    yearTo: row.yearTo,
    notes: row.notes,
  };
}

export function toPartDto(row: PartRow): PartDto {
  const qty = row.quantityOnHand.toString();
  const min = row.minQuantity.toString();
  return {
    id: row.id,
    partNumber: row.partNumber,
    description: row.description,
    category: row.category,
    fitmentType: row.fitmentType,
    fitments: (row.fitments ?? []).map(toPartFitmentDto),
    quantityOnHand: qty,
    minQuantity: min,
    costPriceNet: row.costPriceNet.toString(),
    sellPriceNet: row.sellPriceNet.toString(),
    supplierId: row.supplierId,
    supplierName: row.supplier?.name ?? null,
    location: row.location,
    notes: row.notes,
    status: row.status,
    isLowStock: partIsLowStock(qty, min),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
