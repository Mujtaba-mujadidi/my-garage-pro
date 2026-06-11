import type {
  Invoice,
  InvoiceLine,
  InvoiceLineType,
  CustomerPayment,
  PaymentAllocation,
} from "@prisma/client";
import type {
  CustomerPaymentDto,
  InvoiceDto,
  InvoiceLineDto,
  InvoicePaymentLineDto,
  PaymentAllocationDto,
  PaymentMethod,
} from "@mygaragepro/shared";
import { invoiceBalanceDue } from "@mygaragepro/shared";
import { allocatedTotal } from "./invoice-calculations";

function decimalToString(d: { toString(): string }) {
  return d.toString();
}

function toLineDto(row: InvoiceLine): InvoiceLineDto {
  return {
    id: row.id,
    lineType: row.lineType as InvoiceLineType,
    description: row.description,
    quantity: decimalToString(row.quantity),
    unitPriceNet: decimalToString(row.unitPriceNet),
    vatRatePercent: decimalToString(row.vatRatePercent),
    amountNet: decimalToString(row.amountNet),
    vatAmount: decimalToString(row.vatAmount),
    amountGross: decimalToString(row.amountGross),
    sortOrder: row.sortOrder,
  };
}

type InvoiceWithRelations = Invoice & {
  customer: { companyName: string | null; firstName: string | null; lastName: string | null };
  lines: InvoiceLine[];
  allocations: (PaymentAllocation & {
    payment?: {
      id: string;
      valueDate: Date;
      method: string | null;
      reference: string | null;
      paymentAccount: { name: string };
    };
  })[];
};

function toInvoicePaymentLines(
  allocations: InvoiceWithRelations["allocations"],
): InvoicePaymentLineDto[] {
  return allocations
    .filter((a) => !a.deletedAt && a.payment)
    .map((a) => ({
      allocationId: a.id,
      paymentId: a.payment!.id,
      valueDate: a.payment!.valueDate.toISOString().slice(0, 10),
      amount: decimalToString(a.amount),
      method: (a.payment!.method as PaymentMethod | null) ?? null,
      paymentAccountName: a.payment!.paymentAccount.name,
      reference: a.payment!.reference,
    }))
    .sort((a, b) => a.valueDate.localeCompare(b.valueDate) || a.paymentId.localeCompare(b.paymentId));
}

export function customerDisplayName(c: {
  companyName: string | null;
  firstName: string | null;
  lastName: string | null;
}): string {
  if (c.companyName?.trim()) return c.companyName.trim();
  return [c.firstName, c.lastName].filter(Boolean).join(" ").trim() || "Customer";
}

export function toInvoiceDto(row: InvoiceWithRelations): InvoiceDto {
  const paid = allocatedTotal(row.allocations);
  const gross = Number(row.amountGross);
  const deposit = Number(row.depositAmount);
  const balance = invoiceBalanceDue(gross, deposit, paid);

  return {
    id: row.id,
    customerId: row.customerId,
    customerName: customerDisplayName(row.customer),
    invoiceNumber: row.invoiceNumber,
    status: row.status,
    issueDate: row.issueDate ? row.issueDate.toISOString().slice(0, 10) : null,
    dueDate: row.dueDate ? row.dueDate.toISOString().slice(0, 10) : null,
    amountNet: decimalToString(row.amountNet),
    vatAmount: decimalToString(row.vatAmount),
    amountGross: decimalToString(row.amountGross),
    depositAmount: decimalToString(row.depositAmount),
    amountPaid: paid.toFixed(2),
    balanceDue: balance.toFixed(2),
    vehicleRegistration: row.vehicleRegistration,
    notes: row.notes,
    lines: (() => {
      const sorted = row.lines.sort((a, b) => a.sortOrder - b.sortOrder).map(toLineDto);
      return sorted;
    })(),
    labourLines: row.lines
      .filter((l) => l.lineType === "LABOUR")
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(toLineDto),
    partsLines: row.lines
      .filter((l) => l.lineType === "PARTS")
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(toLineDto),
    payments: toInvoicePaymentLines(row.allocations),
    createdAt: row.createdAt.toISOString(),
  };
}

type PaymentWithRelations = CustomerPayment & {
  customer: { companyName: string | null; firstName: string | null; lastName: string | null };
  paymentAccount: { name: string };
  allocations: (PaymentAllocation & { invoice: { invoiceNumber: string } })[];
};

export function toPaymentDto(row: PaymentWithRelations): CustomerPaymentDto {
  const active = row.allocations.filter((a) => !a.deletedAt);
  const allocated = active.reduce((s, a) => s + Number(a.amount), 0);
  const amount = Number(row.amount);

  return {
    id: row.id,
    customerId: row.customerId,
    customerName: customerDisplayName(row.customer),
    paymentAccountId: row.paymentAccountId,
    paymentAccountName: row.paymentAccount.name,
    amount: decimalToString(row.amount),
    allocatedAmount: allocated.toFixed(2),
    unallocatedAmount: Math.max(0, amount - allocated).toFixed(2),
    valueDate: row.valueDate.toISOString().slice(0, 10),
    method: row.method,
    reference: row.reference,
    notes: row.notes,
    allocations: row.allocations.map(
      (a): PaymentAllocationDto => ({
        id: a.id,
        invoiceId: a.invoiceId,
        invoiceNumber: a.invoice.invoiceNumber,
        amount: decimalToString(a.amount),
        deletedAt: a.deletedAt?.toISOString() ?? null,
      }),
    ),
    createdAt: row.createdAt.toISOString(),
  };
}
