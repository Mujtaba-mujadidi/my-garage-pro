import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { LedgerModule } from "../ledger/ledger.module";
import { InvoicePdfService } from "./invoice-pdf.service";
import { InvoicesController } from "./invoices.controller";
import { InvoicesService } from "./invoices.service";

@Module({
  imports: [AuditModule, LedgerModule],
  controllers: [InvoicesController],
  providers: [InvoicesService, InvoicePdfService],
})
export class InvoicesModule {}
