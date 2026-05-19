import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  async setTenantContext(garageAccountId: string | null, isSuperAdmin: boolean) {
    await this.$executeRawUnsafe(
      `SELECT set_config('app.current_garage_account_id', $1, true)`,
      garageAccountId ?? "",
    );
    await this.$executeRawUnsafe(
      `SELECT set_config('app.is_super_admin', $1, true)`,
      isSuperAdmin ? "true" : "false",
    );
  }
}
