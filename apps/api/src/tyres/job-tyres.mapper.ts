import type { JobTyreUsage, RepairTask, Tyre } from "@prisma/client";
import { formatTyreLabel, type JobTyreUsageDto } from "@mygaragepro/shared";

type UsageRow = JobTyreUsage & {
  tyre: Pick<Tyre, "skuCode" | "brand" | "model" | "size" | "loadIndex" | "speedRating">;
  repairTask?: Pick<RepairTask, "title"> | null;
};

export function toJobTyreUsageDto(row: UsageRow): JobTyreUsageDto {
  const qty = Number(row.quantity);
  const sell = Number(row.sellPriceNet);
  return {
    id: row.id,
    repairJobId: row.repairJobId,
    repairTaskId: row.repairTaskId,
    repairTaskTitle: row.repairTask?.title ?? null,
    tyreId: row.tyreId,
    skuCode: row.tyre.skuCode,
    tyreLabel: formatTyreLabel(row.tyre),
    quantity: row.quantity.toString(),
    costPriceNet: row.costPriceNet.toString(),
    sellPriceNet: row.sellPriceNet.toString(),
    fittingChargeNet: row.fittingChargeNet.toString(),
    lineSellTotalNet: (qty * sell).toFixed(2),
    status: row.status,
    consumedAt: row.consumedAt.toISOString(),
    returnedAt: row.returnedAt?.toISOString() ?? null,
  };
}
