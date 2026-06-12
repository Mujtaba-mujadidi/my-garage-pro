import type { PartFitmentDto, PartFitmentType } from "./part-fitment";

export type { PartFitmentDto, PartFitmentType, PartFitmentInput, PartVehicleContext } from "./part-fitment";
export {
  PART_FITMENT_TYPE_LABEL,
  formatPartFitmentLabel,
  partMatchesVehicle,
  summarizePartFitments,
} from "./part-fitment";

export type PartStatus = "ACTIVE" | "INACTIVE";

export type PartMovementType = "RECEIPT" | "CONSUMPTION" | "RETURN" | "ADJUSTMENT";

export type JobPartUsageStatus = "ORDERED" | "CONSUMED" | "RETURNED" | "CANCELLED";

export const JOB_PART_USAGE_STATUS_LABEL: Record<JobPartUsageStatus, string> = {
  ORDERED: "Ordered",
  CONSUMED: "Received",
  RETURNED: "Returned",
  CANCELLED: "Cancelled",
};

export type JobPartSource = "STOCK" | "ORDERED";

export type PartDto = {
  id: string;
  partNumber: string;
  description: string;
  category: string | null;
  fitmentType: PartFitmentType;
  fitments: PartFitmentDto[];
  quantityOnHand: string;
  minQuantity: string;
  costPriceNet: string;
  sellPriceNet: string;
  supplierId: string | null;
  supplierName: string | null;
  location: string | null;
  notes: string | null;
  status: PartStatus;
  isLowStock: boolean;
  createdAt: string;
  updatedAt: string;
};

export type JobPartUsageDto = {
  id: string;
  repairJobId: string | null;
  bodyworkJobId: string | null;
  repairTaskId: string | null;
  bodyworkTaskId: string | null;
  repairTaskTitle: string | null;
  bodyworkTaskTitle: string | null;
  partId: string;
  partNumber: string;
  partDescription: string;
  quantity: string;
  costPriceNet: string;
  costVatAmount: string;
  costAmountGross: string;
  lineCostTotalNet: string;
  sellPriceNet: string;
  lineSellTotalNet: string;
  source: JobPartSource;
  supplierId: string | null;
  supplierRef: string | null;
  status: JobPartUsageStatus;
  consumedAt: string;
  returnedAt: string | null;
};

export function partIsLowStock(quantityOnHand: string | number, minQuantity: string | number) {
  return Number(quantityOnHand) <= Number(minQuantity);
}
