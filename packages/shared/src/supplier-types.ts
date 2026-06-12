import type { LedgerEntryStatus } from "./ledger-types";
import type { JobPartSource, JobPartUsageStatus } from "./part-types";

export type SupplierStatus = "ACTIVE" | "INACTIVE";

export type SupplierCreditTransactionType = "REFUND_CREDIT" | "APPLIED_PAYMENT" | "ADJUSTMENT";

export type SupplierRefundType = "CREDIT" | "PAYMENT";

export type SupplierDto = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  postcode: string | null;
  vatNumber: string | null;
  notes: string | null;
  creditBalance: string;
  status: SupplierStatus;
  deletedAt: string | null;
  createdAt: string;
};

export type SupplierCreditTransactionDto = {
  id: string;
  supplierId: string;
  type: SupplierCreditTransactionType;
  amount: string;
  balanceAfter: string;
  jobPartUsageId: string | null;
  ledgerEntryId: string | null;
  notes: string | null;
  createdAt: string;
};

export const SUPPLIER_CREDIT_TRANSACTION_LABEL: Record<SupplierCreditTransactionType, string> = {
  REFUND_CREDIT: "Refund credited",
  APPLIED_PAYMENT: "Credit applied",
  ADJUSTMENT: "Adjustment",
};

export type SupplierPartOrderDto = {
  id: string;
  partNumber: string;
  partDescription: string;
  quantity: string;
  costAmountGross: string;
  costVatAmount: string;
  status: JobPartUsageStatus;
  source: JobPartSource;
  supplierRef: string | null;
  repairJobId: string | null;
  repairJobNumber: string | null;
  bodyworkJobId: string | null;
  bodyworkJobNumber: string | null;
  orderedAt: string;
  consumedAt: string | null;
  returnedAt: string | null;
};

export type SupplierPurchaseDto = {
  id: string;
  amountNet: string;
  vatAmount: string;
  amountGross: string;
  valueDate: string;
  status: LedgerEntryStatus;
  category: string | null;
  notes: string | null;
  repairJobId: string | null;
  repairJobNumber: string | null;
  bodyworkJobId: string | null;
  bodyworkJobNumber: string | null;
};

