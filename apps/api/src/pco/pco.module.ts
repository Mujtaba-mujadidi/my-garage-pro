import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { LedgerModule } from "../ledger/ledger.module";
import { PcoController } from "./pco.controller";
import { PcoService } from "./pco.service";

@Module({
  imports: [AuditModule, LedgerModule],
  controllers: [PcoController],
  providers: [PcoService],
  exports: [PcoService],
})
export class PcoModule {}
