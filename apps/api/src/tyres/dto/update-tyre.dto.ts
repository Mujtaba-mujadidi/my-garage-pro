import { PartialType } from "@nestjs/mapped-types";
import { CreateTyreDto } from "./create-tyre.dto";

export class UpdateTyreDto extends PartialType(CreateTyreDto) {}
