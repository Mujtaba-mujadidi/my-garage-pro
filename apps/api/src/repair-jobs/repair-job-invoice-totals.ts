import { InvoiceLineType, Prisma } from "@prisma/client";
import {
  calcLine,
  sumLines,
  type LineCalcInput,
  type LineCalcResult,
} from "../invoices/invoice-calculations";

type JobTaskRow = {
  title: string;
  amountNet: Prisma.Decimal;
  useBreakdown: boolean;
  labourHours: Prisma.Decimal;
  labourRateNet: Prisma.Decimal;
  parts: {
    description: string;
    quantity: Prisma.Decimal;
    unitPriceNet: Prisma.Decimal;
  }[];
};

type JobVatRow = {
  vatEnabled: boolean;
  vatRatePercent: Prisma.Decimal;
};

type JobStockPartRow = {
  quantity: Prisma.Decimal;
  sellPriceNet: Prisma.Decimal;
  part: { partNumber: string; description: string };
};

type JobStockTyreRow = {
  quantity: Prisma.Decimal;
  sellPriceNet: Prisma.Decimal;
  fittingChargeNet: Prisma.Decimal;
  tyre: { skuCode: string; brand: string | null; model: string | null; size: string; loadIndex: string | null; speedRating: string | null };
};

export function buildTaskLineInputs(
  job: JobVatRow,
  tasks: JobTaskRow[],
  canChargeVat: boolean,
): LineCalcInput[] {
  const vatRate = canChargeVat && job.vatEnabled ? Number(job.vatRatePercent) : 0;
  const lines: LineCalcInput[] = [];

  for (const task of tasks) {
    if (!task.useBreakdown) {
      const amount = Number(task.amountNet);
      if (amount > 0) {
        lines.push({
          lineType: InvoiceLineType.LABOUR,
          description: task.title,
          quantity: 1,
          unitPriceNet: amount,
          vatRatePercent: vatRate,
        });
      }
      continue;
    }

    const labourRate = Number(task.labourRateNet);
    if (labourRate > 0) {
      lines.push({
        lineType: InvoiceLineType.LABOUR,
        description: `${task.title} — labour`,
        quantity: Number(task.labourHours) || 1,
        unitPriceNet: labourRate,
        vatRatePercent: vatRate,
      });
    }

    for (const part of task.parts) {
      const unit = Number(part.unitPriceNet);
      if (unit > 0 && part.description.trim()) {
        lines.push({
          lineType: InvoiceLineType.PARTS,
          description: part.description.trim(),
          quantity: Number(part.quantity) || 1,
          unitPriceNet: unit,
          vatRatePercent: vatRate,
        });
      }
    }
  }

  return lines;
}

export function buildStockLineInputs(
  job: JobVatRow,
  partUsages: JobStockPartRow[],
  canChargeVat: boolean,
): LineCalcInput[] {
  const vatRate = canChargeVat && job.vatEnabled ? Number(job.vatRatePercent) : 0;
  const lines: LineCalcInput[] = [];

  for (const usage of partUsages) {
    const unit = Number(usage.sellPriceNet);
    if (unit > 0) {
      lines.push({
        lineType: InvoiceLineType.PARTS,
        description: `${usage.part.partNumber} — ${usage.part.description}`,
        quantity: Number(usage.quantity) || 1,
        unitPriceNet: unit,
        vatRatePercent: vatRate,
      });
    }
  }

  return lines;
}

export function buildStockTyreLineInputs(
  job: JobVatRow,
  tyreUsages: JobStockTyreRow[],
  canChargeVat: boolean,
): LineCalcInput[] {
  const vatRate = canChargeVat && job.vatEnabled ? Number(job.vatRatePercent) : 0;
  const lines: LineCalcInput[] = [];

  for (const usage of tyreUsages) {
    const qty = Number(usage.quantity) || 1;
    const unitSell = Number(usage.sellPriceNet);
    if (unitSell > 0) {
      const label = `${usage.tyre.skuCode} — ${usage.tyre.brand ?? ""} ${usage.tyre.size}`.trim();
      lines.push({
        lineType: InvoiceLineType.TYRES,
        description: label,
        quantity: qty,
        unitPriceNet: unitSell,
        vatRatePercent: vatRate,
      });
    }
  }

  return lines;
}

export function computeJobInvoiceTotals(
  job: JobVatRow,
  tasks: JobTaskRow[],
  canChargeVat: boolean,
  partUsages: JobStockPartRow[] = [],
  tyreUsages: JobStockTyreRow[] = [],
): { lineInputs: LineCalcInput[]; lineCalcs: LineCalcResult[]; amountNet: string; amountGross: string } | null {
  const lineInputs = [
    ...buildTaskLineInputs(job, tasks, canChargeVat),
    ...buildStockLineInputs(job, partUsages, canChargeVat),
    ...buildStockTyreLineInputs(job, tyreUsages, canChargeVat),
  ];
  if (lineInputs.length === 0) return null;
  const lineCalcs = lineInputs.map((l) => calcLine(l));
  const totals = sumLines(lineCalcs);
  return {
    lineInputs,
    lineCalcs,
    amountNet: totals.amountNet.toString(),
    amountGross: totals.amountGross.toString(),
  };
}

export function invoiceAmountsMatch(
  invoice: { amountNet: Prisma.Decimal | string | number; amountGross: Prisma.Decimal | string | number },
  computed: { amountNet: string; amountGross: string },
): boolean {
  return (
    Math.abs(Number(invoice.amountNet) - Number(computed.amountNet)) < 0.01 &&
    Math.abs(Number(invoice.amountGross) - Number(computed.amountGross)) < 0.01
  );
}

export function lineCreateData(lines: LineCalcResult[]) {
  return lines.map((l, i) => ({
    lineType: l.lineType,
    description: l.description,
    quantity: l.quantity,
    unitPriceNet: l.unitPriceNet,
    vatRatePercent: l.vatRatePercent,
    amountNet: l.amountNet,
    vatAmount: l.vatAmount,
    amountGross: l.amountGross,
    sortOrder: i,
  }));
}
