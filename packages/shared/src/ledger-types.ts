export type PaymentAccountType = "BANK" | "CASH";

export type PaymentAccountDto = {
  id: string;
  name: string;
  type: PaymentAccountType;
  openingBalance: string;
  balance: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
};

export type LedgerEntryDirection = "INCOME" | "EXPENSE";
export type LedgerEntryStatus = "PENDING" | "CHECKED" | "POSTED" | "VOID";

export type LedgerEntryDto = {
  id: string;
  paymentAccountId: string;
  paymentAccountName: string;
  direction: LedgerEntryDirection;
  status: LedgerEntryStatus;
  valueDate: string;
  postedAt: string | null;
  amountNet: string;
  vatAmount: string;
  amountGross: string;
  category: string | null;
  supplierId: string | null;
  notes: string | null;
  reversesEntryId: string | null;
  createdById: string;
  createdByName: string | null;
  checkedById: string | null;
  approvedById: string | null;
  voidedById: string | null;
  checkedAt: string | null;
  voidedAt: string | null;
  createdAt: string;
};
