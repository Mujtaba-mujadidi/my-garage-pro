import type {
  BodyworkJob,
  JobPartUsage,
  LedgerEntry,
  Part,
  RepairJob,
} from "@prisma/client";
import type { SupplierPartOrderDto, SupplierPurchaseDto } from "@mygaragepro/shared";

type PartOrderRow = JobPartUsage & {
  part: Pick<Part, "partNumber" | "description">;
  repairJob: Pick<RepairJob, "id" | "jobNumber"> | null;
  bodyworkJob: Pick<BodyworkJob, "id" | "jobNumber"> | null;
};

type PurchaseRow = LedgerEntry & {
  jobPartUsage: {
    repairJob: Pick<RepairJob, "id" | "jobNumber"> | null;
    bodyworkJob: Pick<BodyworkJob, "id" | "jobNumber"> | null;
  } | null;
};

export function toSupplierPartOrderDto(row: PartOrderRow): SupplierPartOrderDto {
  return {
    id: row.id,
    partNumber: row.part.partNumber,
    partDescription: row.part.description,
    quantity: row.quantity.toString(),
    costAmountGross: row.costAmountGross.toString(),
    costVatAmount: row.costVatAmount.toString(),
    status: row.status,
    source: row.source,
    supplierRef: row.supplierRef,
    repairJobId: row.repairJob?.id ?? null,
    repairJobNumber: row.repairJob?.jobNumber ?? null,
    bodyworkJobId: row.bodyworkJob?.id ?? null,
    bodyworkJobNumber: row.bodyworkJob?.jobNumber ?? null,
    orderedAt: row.createdAt.toISOString(),
    consumedAt: row.status === "CONSUMED" ? row.consumedAt.toISOString() : null,
    returnedAt: row.returnedAt?.toISOString() ?? null,
  };
}

export function toSupplierPurchaseDto(row: PurchaseRow): SupplierPurchaseDto {
  const repairJob = row.jobPartUsage?.repairJob ?? null;
  const bodyworkJob = row.jobPartUsage?.bodyworkJob ?? null;

  return {
    id: row.id,
    amountNet: row.amountNet.toString(),
    vatAmount: row.vatAmount.toString(),
    amountGross: row.amountGross.toString(),
    valueDate: row.valueDate.toISOString().slice(0, 10),
    status: row.status,
    category: row.category,
    notes: row.notes,
    repairJobId: repairJob?.id ?? null,
    repairJobNumber: repairJob?.jobNumber ?? null,
    bodyworkJobId: bodyworkJob?.id ?? null,
    bodyworkJobNumber: bodyworkJob?.jobNumber ?? null,
  };
}
