import { Module, forwardRef } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { CustomersModule } from "../customers/customers.module";
import { PartsModule } from "../parts/parts.module";
import { TyresModule } from "../tyres/tyres.module";
import { RepairJobsController } from "./repair-jobs.controller";
import { RepairJobsService } from "./repair-jobs.service";

@Module({
  imports: [AuditModule, CustomersModule, forwardRef(() => PartsModule), forwardRef(() => TyresModule)],
  controllers: [RepairJobsController],
  providers: [RepairJobsService],
  exports: [RepairJobsService],
})
export class RepairJobsModule {}
