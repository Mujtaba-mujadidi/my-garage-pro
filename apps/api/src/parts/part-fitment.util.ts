import { BadRequestException } from "@nestjs/common";
import { PartFitmentType } from "@prisma/client";
import type { PartFitmentDto, PartVehicleContext } from "@mygaragepro/shared";
import { partMatchesVehicle } from "@mygaragepro/shared";
import type { PartFitmentRowDto } from "./dto/part-fitment.dto";

export type FitmentRowInput = {
  make: string;
  model: string;
  yearFrom: number;
  yearTo: number | null;
  notes: string | null;
};

/** Normalise and validate fitment rows before persisting. */
export function validateAndNormalizeFitments(
  fitmentType: PartFitmentType,
  rows: PartFitmentRowDto[] | undefined,
): FitmentRowInput[] {
  if (fitmentType === PartFitmentType.UNIVERSAL) {
    if (rows?.length) {
      throw new BadRequestException("Universal parts cannot have vehicle fitment rows");
    }
    return [];
  }

  if (!rows?.length) {
    throw new BadRequestException("Add at least one vehicle fitment row, or mark the part as universal");
  }

  return rows.map((row, index) => {
    const make = row.make.trim();
    const model = row.model.trim();
    if (!make || !model) {
      throw new BadRequestException(`Fitment row ${index + 1}: make and model are required`);
    }

    const yearFrom = row.yearFrom;
    const yearTo = row.yearTo ?? null;
    if (yearTo != null && yearTo < yearFrom) {
      throw new BadRequestException(
        `Fitment row ${index + 1}: year to must be the same as or after year from`,
      );
    }

    return {
      make,
      model,
      yearFrom,
      yearTo,
      notes: row.notes?.trim() || null,
    };
  });
}

/** In-memory filter after loading parts — used for repair job stock picker. */
export function filterPartsForVehicle<
  T extends { fitmentType: PartFitmentType; fitments: PartFitmentDto[] },
>(parts: T[], vehicle: PartVehicleContext): T[] {
  return parts.filter((p) => partMatchesVehicle(p, vehicle));
}

/** Block consuming a vehicle-specific part that does not fit the job vehicle. */
export function assertPartFitsJobVehicle(
  part: { partNumber: string; fitmentType: PartFitmentType; fitments: PartFitmentDto[] },
  vehicle: PartVehicleContext,
): void {
  if (partMatchesVehicle(part, vehicle)) return;

  const vehicleLabel = [vehicle.make, vehicle.model].filter(Boolean).join(" ") || "this vehicle";
  throw new BadRequestException(
    `${part.partNumber} is not listed as compatible with ${vehicleLabel}`,
  );
}
