import { BodyworkJobStatus } from "@prisma/client";
import { IsArray, IsBoolean, IsEnum, IsOptional, IsString, IsUUID, MaxLength } from "class-validator";

export class UpdateBodyworkJobStatusDto {
  @IsEnum(BodyworkJobStatus)
  status!: BodyworkJobStatus;

  /** Optional note when returning a job from QC to the workshop. */
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;

  /**
   * Tasks that failed QC and should reopen in the workshop.
   * When omitted or empty, all non-cancelled tasks are sent back.
   */
  @IsOptional()
  @IsArray()
  @IsUUID("4", { each: true })
  failedTaskIds?: string[];

  /**
   * When closing the job, mark every non-cancelled open task as completed first.
   * Used when mechanics finished work but did not update task status.
   */
  @IsOptional()
  @IsBoolean()
  completeOpenTasks?: boolean;
}
