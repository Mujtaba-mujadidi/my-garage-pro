import type { SupplierCreditTransaction } from "@prisma/client";
import type { SupplierCreditTransactionDto } from "@mygaragepro/shared";

export function toSupplierCreditTransactionDto(
  row: SupplierCreditTransaction,
): SupplierCreditTransactionDto {
  return {
    id: row.id,
    supplierId: row.supplierId,
    type: row.type,
    amount: row.amount.toString(),
    balanceAfter: row.balanceAfter.toString(),
    jobPartUsageId: row.jobPartUsageId,
    ledgerEntryId: row.ledgerEntryId,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
  };
}
