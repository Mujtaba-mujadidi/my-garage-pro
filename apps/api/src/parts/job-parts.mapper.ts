import type { JobPartUsage, Part, RepairTask } from "@prisma/client";
import type { JobPartUsageDto } from "@mygaragepro/shared";

type UsageRow = JobPartUsage & {
  part: Pick<Part, "partNumber" | "description">;
  repairTask?: Pick<RepairTask, "title"> | null;
};

export function toJobPartUsageDto(row: UsageRow): JobPartUsageDto {
  const qty = Number(row.quantity);
  const sell = Number(row.sellPriceNet);
  return {
    id: row.id,
    repairJobId: row.repairJobId,
    repairTaskId: row.repairTaskId,
    repairTaskTitle: row.repairTask?.title ?? null,
    partId: row.partId,
    partNumber: row.part.partNumber,
    partDescription: row.part.description,
    quantity: row.quantity.toString(),
    costPriceNet: row.costPriceNet.toString(),
    sellPriceNet: row.sellPriceNet.toString(),
    lineSellTotalNet: (qty * sell).toFixed(2),
    status: row.status,
    consumedAt: row.consumedAt.toISOString(),
    returnedAt: row.returnedAt?.toISOString() ?? null,
  };
}
