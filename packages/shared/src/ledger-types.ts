import type { PaymentMethod } from "./invoice-types";

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

export type LedgerSourceModule =
  | "GENERAL"
  | "TRANSFER"
  | "ADJUSTMENT"
  | "INVOICES"
  | "REPAIR"
  | "BODYWORK"
  | "PARTS"
  | "TYRES"
  | "PCO";

export const LEDGER_SOURCE_MODULE_LABEL: Record<LedgerSourceModule, string> = {
  GENERAL: "General",
  TRANSFER: "Transfer",
  ADJUSTMENT: "Adjustment",
  INVOICES: "Invoices",
  REPAIR: "Repair",
  BODYWORK: "Bodywork",
  PARTS: "Parts",
  TYRES: "Tyres",
  PCO: "PCO",
};

export type LedgerEntryDto = {
  id: string;
  paymentAccountId: string;
  paymentAccountName: string;
  paymentMethod: PaymentMethod | null;
  direction: LedgerEntryDirection;
  status: LedgerEntryStatus;
  sourceModule: LedgerSourceModule;
  valueDate: string;
  postedAt: string | null;
  amountNet: string;
  vatAmount: string;
  amountGross: string;
  category: string | null;
  supplierId: string | null;
  customerId: string | null;
  customerName: string | null;
  repairJobId: string | null;
  repairJobNumber: string | null;
  bodyworkJobId: string | null;
  bodyworkJobNumber: string | null;
  pcoBookingId: string | null;
  pcoBookingNumber: string | null;
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
