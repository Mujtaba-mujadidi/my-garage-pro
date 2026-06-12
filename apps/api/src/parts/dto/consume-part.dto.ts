import { Type } from "class-transformer";
import { IsNumber, IsOptional, IsUUID, Min } from "class-validator";

export class ConsumePartDto {
  @IsUUID("4")
  partId!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  quantity!: number;

  @IsOptional()
  @IsUUID("4")
  repairTaskId?: string;

  @IsOptional()
  @IsUUID("4")
  bodyworkTaskId?: string;

  /** Override unit sell price ex VAT on customer invoice. */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  sellPriceNet?: number;
}
