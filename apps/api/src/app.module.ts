import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { AuditModule } from "./audit/audit.module";
import { AuthModule } from "./auth/auth.module";
import { HealthController } from "./health.controller";
import { JwtAuthGuard } from "./auth/guards/jwt-auth.guard";
import { PlatformModule } from "./platform/platform.module";
import { PrismaModule } from "./prisma/prisma.module";
import { SettingsModule } from "./settings/settings.module";
import { UsersModule } from "./users/users.module";
import { CustomersModule } from "./customers/customers.module";
import { GarageRolesModule } from "./garage-roles/garage-roles.module";
import { SuppliersModule } from "./suppliers/suppliers.module";
import { LedgerModule } from "./ledger/ledger.module";
import { InvoicesModule } from "./invoices/invoices.module";
import { RepairJobsModule } from "./repair-jobs/repair-jobs.module";
import { BodyworkJobsModule } from "./bodywork-jobs/bodywork-jobs.module";
import { PartsModule } from "./parts/parts.module";
import { TyresModule } from "./tyres/tyres.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ".env" }),
    PrismaModule,
    AuditModule,
    GarageRolesModule,
    AuthModule,
    SettingsModule,
    PlatformModule,
    UsersModule,
    CustomersModule,
    SuppliersModule,
    LedgerModule,
    InvoicesModule,
    RepairJobsModule,
    BodyworkJobsModule,
    PartsModule,
    TyresModule,
  ],
  controllers: [HealthController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
