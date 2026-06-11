export type InvoiceStatus = "DRAFT" | "SENT" | "PART_PAID" | "PAID" | "CANCELLED";
import type { PaymentAccountType } from "./ledger-types";

export type PaymentMethod = "BANK_TRANSFER" | "CARD" | "CASH" | "CHEQUE" | "OTHER";

export function defaultPaymentMethodForAccount(type: PaymentAccountType): PaymentMethod {
  return type === "CASH" ? "CASH" : "BANK_TRANSFER";
}

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  BANK_TRANSFER: "Bank transfer",
  CARD: "Card",
  CASH: "Cash",
  CHEQUE: "Cheque",
  OTHER: "Other",
};
export type InvoiceLineType = "LABOUR" | "PARTS" | "TYRES";

export type InvoiceLineDto = {
  id: string;
  lineType: InvoiceLineType;
  description: string;
  quantity: string;
  unitPriceNet: string;
  vatRatePercent: string;
  amountNet: string;
  vatAmount: string;
  amountGross: string;
  sortOrder: number;
};

export type InvoicePaymentLineDto = {
  allocationId: string;
  paymentId: string;
  valueDate: string;
  amount: string;
  method: PaymentMethod | null;
  paymentAccountName: string;
  reference: string | null;
};

export type InvoiceDto = {
  id: string;
  customerId: string;
  customerName: string;
  invoiceNumber: string;
  status: InvoiceStatus;
  issueDate: string | null;
  dueDate: string | null;
  amountNet: string;
  vatAmount: string;
  amountGross: string;
  depositAmount: string;
  amountPaid: string;
  balanceDue: string;
  vehicleRegistration: string | null;
  notes: string | null;
  lines: InvoiceLineDto[];
  labourLines: InvoiceLineDto[];
  partsLines: InvoiceLineDto[];
  /** Payments received against this invoice (may include split methods). */
  payments: InvoicePaymentLineDto[];
  createdAt: string;
};

export type CustomerBalanceDto = {
  customerId: string;
  customerName: string;
  totalInvoiced: string;
  totalPaid: string;
  balanceDue: string;
  creditUnallocated: string;
};

export type PaymentAllocationDto = {
  id: string;
  invoiceId: string;
  invoiceNumber: string;
  amount: string;
  deletedAt: string | null;
};

export type CustomerPaymentDto = {
  id: string;
  customerId: string;
  customerName: string;
  paymentAccountId: string;
  paymentAccountName: string;
  amount: string;
  allocatedAmount: string;
  unallocatedAmount: string;
  valueDate: string;
  method: PaymentMethod | null;
  reference: string | null;
  notes: string | null;
  allocations: PaymentAllocationDto[];
  createdAt: string;
};

export type InvoiceLineInput = {
  lineType: InvoiceLineType;
  description: string;
  quantity: number;
  unitPriceNet: number;
  vatRatePercent?: number;
};
