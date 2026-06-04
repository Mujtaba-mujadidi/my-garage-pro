import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { PrismaModule } from "../prisma/prisma.module";
import { GarageRolesModule } from "../garage-roles/garage-roles.module";
import { SuppliersController } from "./suppliers.controller";
import { SuppliersService } from "./suppliers.service";

@Module({
  imports: [PrismaModule, AuditModule, GarageRolesModule],
  controllers: [SuppliersController],
  providers: [SuppliersService],
})
export class SuppliersModule {}

