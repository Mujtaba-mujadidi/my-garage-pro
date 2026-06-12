import { Module, forwardRef } from "@nestjs/common";
import { BodyworkJobsModule } from "../bodywork-jobs/bodywork-jobs.module";
import { BodyworkJobPartsInvoiceSync } from "../bodywork-jobs/bodywork-job-parts-invoice-sync";
import { LedgerModule } from "../ledger/ledger.module";
import { RepairJobsModule } from "../repair-jobs/repair-jobs.module";
import { SuppliersModule } from "../suppliers/suppliers.module";
import { JobPartsInvoiceSync } from "./job-parts-invoice-sync";
import {
  BodyworkJobPartsController,
  PartsController,
  RepairJobPartsController,
} from "./parts.controller";
import { PartsService } from "./parts.service";

@Module({
  imports: [
    forwardRef(() => RepairJobsModule),
    forwardRef(() => BodyworkJobsModule),
    LedgerModule,
    SuppliersModule,
  ],
  controllers: [PartsController, RepairJobPartsController, BodyworkJobPartsController],
  providers: [PartsService, JobPartsInvoiceSync, BodyworkJobPartsInvoiceSync],
  exports: [PartsService, JobPartsInvoiceSync, BodyworkJobPartsInvoiceSync],
})
export class PartsModule {}
