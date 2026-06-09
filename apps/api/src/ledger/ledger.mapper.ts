import type { LedgerEntry, PaymentAccount } from "@prisma/client";
import type { LedgerEntryDto, PaymentAccountDto } from "@mygaragepro/shared";

export function decimalToString(value: { toString(): string }): string {
  return value.toString();
}

export function toPaymentAccountDto(
  row: PaymentAccount,
  balance: { toString(): string },
): PaymentAccountDto {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    openingBalance: decimalToString(row.openingBalance),
    balance: decimalToString(balance),
    isActive: row.isActive,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt.toISOString(),
  };
}

type EntryWithAccount = LedgerEntry & {
  paymentAccount: Pick<PaymentAccount, "name">;
  createdBy?: { displayName: string } | null;
};

export function toLedgerEntryDto(row: EntryWithAccount): LedgerEntryDto {
  return {
    id: row.id,
    paymentAccountId: row.paymentAccountId,
    paymentAccountName: row.paymentAccount.name,
    direction: row.direction,
    status: row.status,
    valueDate: row.valueDate.toISOString().slice(0, 10),
    postedAt: row.postedAt?.toISOString() ?? null,
    amountNet: decimalToString(row.amountNet),
    vatAmount: decimalToString(row.vatAmount),
    amountGross: decimalToString(row.amountGross),
    category: row.category,
    supplierId: row.supplierId,
    notes: row.notes,
    reversesEntryId: row.reversesEntryId,
    createdById: row.createdById,
    createdByName: row.createdBy?.displayName ?? null,
    checkedById: row.checkedById,
    approvedById: row.approvedById,
    voidedById: row.voidedById,
    checkedAt: row.checkedAt?.toISOString() ?? null,
    voidedAt: row.voidedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}
