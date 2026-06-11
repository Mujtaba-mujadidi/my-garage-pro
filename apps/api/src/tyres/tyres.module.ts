import { Module, forwardRef } from "@nestjs/common";
import { LedgerModule } from "../ledger/ledger.module";
import { PartsModule } from "../parts/parts.module";
import { RepairJobsModule } from "../repair-jobs/repair-jobs.module";
import { RepairJobTyresController, TyresController } from "./tyres.controller";
import { TyresService } from "./tyres.service";

@Module({
  imports: [forwardRef(() => RepairJobsModule), PartsModule, LedgerModule],
  controllers: [TyresController, RepairJobTyresController],
  providers: [TyresService],
  exports: [TyresService],
})
export class TyresModule {}
