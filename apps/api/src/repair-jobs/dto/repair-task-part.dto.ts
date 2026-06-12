import { Transform } from "class-transformer";
import { IsNumber, IsOptional, IsString, MaxLength, Min } from "class-validator";
import { coerceToNumber } from "../../common/transforms/coerce-number";

export class RepairTaskPartDto {
  @IsString()
  @MaxLength(500)
  description!: string;

  @IsOptional()
  @Transform(({ value }) => coerceToNumber(value))
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  quantity?: number;

  @Transform(({ value }) => coerceToNumber(value))
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  unitPriceNet!: number;
}
