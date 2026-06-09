import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { SettingsModule } from "../settings/settings.module";
import { LedgerController } from "./ledger.controller";
import { LedgerService } from "./ledger.service";

@Module({
  imports: [AuditModule, SettingsModule],
  controllers: [LedgerController],
  providers: [LedgerService],
  exports: [LedgerService],
})
export class LedgerModule {}
