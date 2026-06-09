import { Module, forwardRef } from "@nestjs/common";
import { RepairJobsModule } from "../repair-jobs/repair-jobs.module";
import { JobPartsInvoiceSync } from "./job-parts-invoice-sync";
import { PartsController, RepairJobPartsController } from "./parts.controller";
import { PartsService } from "./parts.service";

@Module({
  imports: [forwardRef(() => RepairJobsModule)],
  controllers: [PartsController, RepairJobPartsController],
  providers: [PartsService, JobPartsInvoiceSync],
  exports: [PartsService, JobPartsInvoiceSync],
})
export class PartsModule {}
