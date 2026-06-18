import type { Customer, LedgerEntry, PaymentAccount } from "@prisma/client";
import type { LedgerEntryDto, LedgerSourceModule, PaymentAccountDto } from "@mygaragepro/shared";

function ledgerCustomerName(
  c: Pick<Customer, "type" | "firstName" | "lastName" | "companyName">,
): string {
  if (c.type === "BUSINESS" && c.companyName) return c.companyName;
  const parts = [c.firstName, c.lastName].filter(Boolean);
  return parts.length ? parts.join(" ") : "Unnamed customer";
}

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
  customer?: Pick<Customer, "type" | "firstName" | "lastName" | "companyName"> | null;
  repairJob?: { id: string; jobNumber: string } | null;
  bodyworkJob?: { id: string; jobNumber: string } | null;
  pcoBooking?: { id: string; bookingNumber: string } | null;
};

export function toLedgerEntryDto(row: EntryWithAccount): LedgerEntryDto {
  return {
    id: row.id,
    paymentAccountId: row.paymentAccountId,
    paymentAccountName: row.paymentAccount.name,
    paymentMethod: row.paymentMethod ?? null,
    direction: row.direction,
    status: row.status,
    sourceModule: row.sourceModule as LedgerSourceModule,
    valueDate: row.valueDate.toISOString().slice(0, 10),
    postedAt: row.postedAt?.toISOString() ?? null,
    amountNet: decimalToString(row.amountNet),
    vatAmount: decimalToString(row.vatAmount),
    amountGross: decimalToString(row.amountGross),
    category: row.category,
    supplierId: row.supplierId,
    customerId: row.customerId,
    customerName: row.customer ? ledgerCustomerName(row.customer) : null,
    repairJobId: row.repairJobId,
    repairJobNumber: row.repairJob?.jobNumber ?? null,
    bodyworkJobId: row.bodyworkJobId,
    bodyworkJobNumber: row.bodyworkJob?.jobNumber ?? null,
    pcoBookingId: row.pcoBookingId,
    pcoBookingNumber: row.pcoBooking?.bookingNumber ?? null,
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
