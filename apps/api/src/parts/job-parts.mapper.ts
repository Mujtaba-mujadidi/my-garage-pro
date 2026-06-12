import type { BodyworkTask, JobPartUsage, Part, RepairTask } from "@prisma/client";
import type { JobPartUsageDto } from "@mygaragepro/shared";

type UsageRow = JobPartUsage & {
  part: Pick<Part, "partNumber" | "description">;
  repairTask?: Pick<RepairTask, "title"> | null;
  bodyworkTask?: Pick<BodyworkTask, "title"> | null;
};

export function toJobPartUsageDto(row: UsageRow): JobPartUsageDto {
  const qty = Number(row.quantity);
  const sell = Number(row.sellPriceNet);
  const unitCost = Number(row.costPriceNet);
  const lineVat = Number(row.costVatAmount);
  const lineGross = Number(row.costAmountGross);
  return {
    id: row.id,
    repairJobId: row.repairJobId,
    bodyworkJobId: row.bodyworkJobId,
    repairTaskId: row.repairTaskId,
    bodyworkTaskId: row.bodyworkTaskId,
    repairTaskTitle: row.repairTask?.title ?? null,
    bodyworkTaskTitle: row.bodyworkTask?.title ?? null,
    partId: row.partId,
    partNumber: row.part.partNumber,
    partDescription: row.part.description,
    quantity: row.quantity.toString(),
    costPriceNet: row.costPriceNet.toString(),
    costVatAmount: row.costVatAmount.toString(),
    costAmountGross: row.costAmountGross.toString(),
    lineCostTotalNet: (qty * unitCost).toFixed(2),
    sellPriceNet: row.sellPriceNet.toString(),
    lineSellTotalNet: (qty * sell).toFixed(2),
    source: row.source,
    supplierId: row.supplierId,
    supplierRef: row.supplierRef,
    status: row.status,
    consumedAt: row.consumedAt.toISOString(),
    returnedAt: row.returnedAt?.toISOString() ?? null,
  };
}
