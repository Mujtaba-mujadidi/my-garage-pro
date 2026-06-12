import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { PrismaModule } from "../prisma/prisma.module";
import { GarageRolesModule } from "../garage-roles/garage-roles.module";
import { SuppliersController } from "./suppliers.controller";
import { SupplierCreditService } from "./supplier-credit.service";
import { SuppliersService } from "./suppliers.service";

@Module({
  imports: [PrismaModule, AuditModule, GarageRolesModule],
  controllers: [SuppliersController],
  providers: [SuppliersService, SupplierCreditService],
  exports: [SupplierCreditService],
})
export class SuppliersModule {}

