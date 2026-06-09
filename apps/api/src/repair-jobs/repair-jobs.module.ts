import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { CustomersModule } from "../customers/customers.module";
import { RepairJobsController } from "./repair-jobs.controller";
import { RepairJobsService } from "./repair-jobs.service";

@Module({
  imports: [AuditModule, CustomersModule],
  controllers: [RepairJobsController],
  providers: [RepairJobsService],
  exports: [RepairJobsService],
})
export class RepairJobsModule {}
