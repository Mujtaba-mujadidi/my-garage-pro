import { Global, Module } from "@nestjs/common";
import { GarageRolesController } from "./garage-roles.controller";
import { GarageRolesService } from "./garage-roles.service";

@Global()
@Module({
  controllers: [GarageRolesController],
  providers: [GarageRolesService],
  exports: [GarageRolesService],
})
export class GarageRolesModule {}
