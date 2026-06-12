import type { Supplier } from "@prisma/client";
import type { SupplierDto } from "@mygaragepro/shared";

export function toSupplierDto(row: Supplier): SupplierDto {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    addressLine1: row.addressLine1,
    addressLine2: row.addressLine2,
    city: row.city,
    postcode: row.postcode,
    vatNumber: row.vatNumber,
    notes: row.notes,
    creditBalance: row.creditBalance.toString(),
    status: row.status,
    deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}

