export type InvoiceStatus = "DRAFT" | "SENT" | "PART_PAID" | "PAID" | "CANCELLED";
export type PaymentMethod = "BANK_TRANSFER" | "CARD" | "CASH" | "CHEQUE" | "OTHER";
export type InvoiceLineType = "LABOUR" | "PARTS";

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
