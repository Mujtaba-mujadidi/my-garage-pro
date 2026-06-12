import { BadRequestException, Injectable } from "@nestjs/common";
import { InvoiceStatus, JobPartUsageStatus, Prisma } from "@prisma/client";
import { allocatedTotal, calcLine, sumLines } from "../invoices/invoice-calculations";
import {
  buildExtraCostLineInputs,
  buildTaskLineInputs,
} from "./bodywork-job-invoice-totals";
import { buildStockLineInputs } from "../repair-jobs/repair-job-invoice-totals";
import { lineCreateData } from "./bodywork-job-invoice-totals";

@Injectable()
export class BodyworkJobPartsInvoiceSync {
  async syncInvoiceLines(
    tx: Prisma.TransactionClient,
    bodyworkJobId: string,
    garageAccountId: string,
    _userId: string,
  ) {
    const job = await tx.bodyworkJob.findFirst({
      where: { id: bodyworkJobId, garageAccountId },
      include: {
        tasks: { orderBy: { sortOrder: "asc" }, include: { parts: { orderBy: { sortOrder: "asc" } } } },
        invoice: { include: { allocations: true } },
        partUsages: {
          where: { status: JobPartUsageStatus.CONSUMED },
          include: { part: { select: { partNumber: true, description: true } } },
        },
      },
    });
    if (!job?.invoice) return;

    if (
      job.invoice.status !== InvoiceStatus.SENT &&
      job.invoice.status !== InvoiceStatus.PART_PAID
    ) {
      throw new BadRequestException("Invoice cannot be updated in its current status");
    }

    const garage = await tx.garageAccount.findUnique({
      where: { id: garageAccountId },
      select: { vatNumber: true },
    });
    const canChargeVat = Boolean(garage?.vatNumber?.trim());
    const vatJob = {
      vatEnabled: job.vatEnabled,
      vatRatePercent: job.vatRatePercent,
      paintMaterialCostNet: job.paintMaterialCostNet,
      outsourcedCostNet: job.outsourcedCostNet,
    };

    const lineInputs = [
      ...buildTaskLineInputs(vatJob, job.tasks, canChargeVat),
      ...buildExtraCostLineInputs(vatJob, canChargeVat),
      ...buildStockLineInputs(vatJob, job.partUsages, canChargeVat),
    ];
    if (lineInputs.length === 0) {
      throw new BadRequestException("No billable lines for invoice update");
    }

    const lineCalcs = lineInputs.map((l) => calcLine(l));
    const totals = sumLines(lineCalcs);
    const paid = allocatedTotal(job.invoice.allocations);
    const newGross = Number(totals.amountGross);
    if (newGross < paid - 0.009) {
      throw new BadRequestException(
        "Updated invoice total cannot be less than payments already recorded",
      );
    }

    const invoiceId = job.invoice.id;
    await tx.invoiceLine.deleteMany({ where: { invoiceId } });
    await tx.invoiceLine.createMany({
      data: lineCreateData(lineCalcs).map((line) => ({ ...line, invoiceId })),
    });

    await tx.invoice.update({
      where: { id: invoiceId },
      data: {
        amountNet: totals.amountNet,
        vatAmount: totals.vatAmount,
        amountGross: totals.amountGross,
      },
    });

    const deposit = Number(job.invoice.depositAmount);
    const amountDue = Math.max(0, newGross - deposit);
    let status: InvoiceStatus = InvoiceStatus.SENT;
    if (paid > 0.009 && paid < amountDue - 0.009) status = InvoiceStatus.PART_PAID;
    else if (paid >= amountDue - 0.009) status = InvoiceStatus.PAID;
    await tx.invoice.update({ where: { id: invoiceId }, data: { status } });
  }
}
