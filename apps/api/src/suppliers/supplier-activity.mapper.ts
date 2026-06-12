import type {
  BodyworkJob,
  JobPartUsage,
  LedgerEntry,
  Part,
  PartMovement,
  RepairJob,
  Tyre,
  TyreMovement,
} from "@prisma/client";
import type { SupplierPartOrderDto, SupplierPurchaseDto } from "@mygaragepro/shared";

type PartOrderRow = JobPartUsage & {
  part: Pick<Part, "partNumber" | "description">;
  repairJob: Pick<RepairJob, "id" | "jobNumber"> | null;
  bodyworkJob: Pick<BodyworkJob, "id" | "jobNumber"> | null;
};

type PurchaseRow = LedgerEntry & {
  repairJob: Pick<RepairJob, "id" | "jobNumber"> | null;
  bodyworkJob: Pick<BodyworkJob, "id" | "jobNumber"> | null;
  jobPartUsage: {
    repairJob: Pick<RepairJob, "id" | "jobNumber"> | null;
    bodyworkJob: Pick<BodyworkJob, "id" | "jobNumber"> | null;
    part: Pick<Part, "partNumber" | "description">;
  } | null;
  partMovement: {
    repairJob: Pick<RepairJob, "id" | "jobNumber"> | null;
    bodyworkJob: Pick<BodyworkJob, "id" | "jobNumber"> | null;
    part: Pick<Part, "partNumber" | "description">;
  } | null;
  tyreMovement: {
    tyre: Pick<Tyre, "skuCode" | "size" | "brand">;
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

function purchaseDescription(row: PurchaseRow): string | null {
  if (row.jobPartUsage?.part) {
    const p = row.jobPartUsage.part;
    return `${p.partNumber} — ${p.description}`;
  }
  if (row.partMovement?.part) {
    const p = row.partMovement.part;
    return `${p.partNumber} — ${p.description}`;
  }
  if (row.tyreMovement?.tyre) {
    const t = row.tyreMovement.tyre;
    const label = [t.skuCode, t.size, t.brand].filter(Boolean).join(" · ");
    return label || null;
  }
  return row.notes;
}

export function toSupplierPurchaseDto(row: PurchaseRow): SupplierPurchaseDto {
  const repairJob =
    row.repairJob ??
    row.jobPartUsage?.repairJob ??
    row.partMovement?.repairJob ??
    null;
  const bodyworkJob =
    row.bodyworkJob ??
    row.jobPartUsage?.bodyworkJob ??
    row.partMovement?.bodyworkJob ??
    null;

  return {
    id: row.id,
    amountNet: row.amountNet.toString(),
    vatAmount: row.vatAmount.toString(),
    amountGross: row.amountGross.toString(),
    valueDate: row.valueDate.toISOString().slice(0, 10),
    status: row.status,
    category: row.category,
    notes: purchaseDescription(row) ?? row.notes,
    repairJobId: repairJob?.id ?? null,
    repairJobNumber: repairJob?.jobNumber ?? null,
    bodyworkJobId: bodyworkJob?.id ?? null,
    bodyworkJobNumber: bodyworkJob?.jobNumber ?? null,
  };
}
