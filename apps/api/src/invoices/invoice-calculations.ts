import { InvoiceLineType, Prisma } from "@prisma/client";

export type LineCalcInput = {
  lineType: InvoiceLineType;
  description: string;
  quantity: number;
  unitPriceNet: number;
  vatRatePercent?: number;
};

export type LineCalcResult = {
  lineType: InvoiceLineType;
  description: string;
  quantity: Prisma.Decimal;
  unitPriceNet: Prisma.Decimal;
  vatRatePercent: Prisma.Decimal;
  amountNet: Prisma.Decimal;
  vatAmount: Prisma.Decimal;
  amountGross: Prisma.Decimal;
};

export function roundMoney(n: number): Prisma.Decimal {
  return new Prisma.Decimal(n.toFixed(2));
}

export function calcLine(input: LineCalcInput): LineCalcResult {
  const qty = input.quantity > 0 ? input.quantity : 1;
  const rate = Math.max(0, input.vatRatePercent ?? 0);
  const unitNet = input.unitPriceNet;
  const amountNet = roundMoney(qty * unitNet);
  const vatAmount = roundMoney((Number(amountNet) * rate) / 100);
  const amountGross = roundMoney(Number(amountNet) + Number(vatAmount));

  return {
    lineType: input.lineType,
    description: input.description.trim(),
    quantity: new Prisma.Decimal(qty.toFixed(3)),
    unitPriceNet: roundMoney(unitNet),
    vatRatePercent: new Prisma.Decimal(rate.toFixed(2)),
    amountNet,
    vatAmount,
    amountGross,
  };
}

export function sumLines(lines: LineCalcResult[]) {
  let net = 0;
  let vat = 0;
  let gross = 0;
  for (const l of lines) {
    net += Number(l.amountNet);
    vat += Number(l.vatAmount);
    gross += Number(l.amountGross);
  }
  return {
    amountNet: roundMoney(net),
    vatAmount: roundMoney(vat),
    amountGross: roundMoney(gross),
  };
}

export function allocatedTotal(
  allocations: { amount: Prisma.Decimal; deletedAt: Date | null }[],
): number {
  return allocations
    .filter((a) => !a.deletedAt)
    .reduce((s, a) => s + Number(a.amount), 0);
}
