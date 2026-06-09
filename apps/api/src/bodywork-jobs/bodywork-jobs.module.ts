import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { CustomersModule } from "../customers/customers.module";
import { BodyworkJobsController } from "./bodywork-jobs.controller";
import { BodyworkJobsService } from "./bodywork-jobs.service";

@Module({
  imports: [AuditModule, CustomersModule],
  controllers: [BodyworkJobsController],
  providers: [BodyworkJobsService],
  exports: [BodyworkJobsService],
})
export class BodyworkJobsModule {}
