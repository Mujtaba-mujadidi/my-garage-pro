import { Type } from "class-transformer";
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";

/** One vehicle fitment row submitted with create/update part. */
export class PartFitmentRowDto {
  @IsString()
  @MaxLength(80)
  make!: string;

  @IsString()
  @MaxLength(80)
  model!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1900)
  @Max(2100)
  yearFrom!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1900)
  @Max(2100)
  yearTo?: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  notes?: string;
}
