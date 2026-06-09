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

export type JobPartUsageStatus = "CONSUMED" | "RETURNED";

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
  repairJobId: string;
  repairTaskId: string | null;
  repairTaskTitle: string | null;
  partId: string;
  partNumber: string;
  partDescription: string;
  quantity: string;
  costPriceNet: string;
  sellPriceNet: string;
  lineSellTotalNet: string;
  status: JobPartUsageStatus;
  consumedAt: string;
  returnedAt: string | null;
};

export function partIsLowStock(quantityOnHand: string | number, minQuantity: string | number) {
  return Number(quantityOnHand) <= Number(minQuantity);
}
