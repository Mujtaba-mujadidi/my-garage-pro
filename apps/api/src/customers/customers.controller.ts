import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { RequirePermissions } from "../auth/decorators/permissions.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import type { RequestUser } from "../auth/auth.types";
import { CustomersService } from "./customers.service";
import { CreateCustomerDto, CreateVehicleDto } from "./dto/create-customer.dto";
import { UpdateCustomerDto } from "./dto/update-customer.dto";

@Controller("customers")
@UseGuards(PermissionsGuard)
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Get()
  @RequirePermissions("customers.read")
  list(
    @CurrentUser() user: RequestUser,
    @Query("q") q?: string,
    @Query("includeDeleted") includeDeleted?: string,
  ) {
    return this.customers.list(user, q, includeDeleted === "true");
  }

  @Get(":id")
  @RequirePermissions("customers.read")
  getOne(
    @CurrentUser() user: RequestUser,
    @Param("id") id: string,
    @Query("includeDeleted") includeDeleted?: string,
  ) {
    return this.customers.getOne(user, id, includeDeleted === "true");
  }

  @Post()
  @RequirePermissions("customers.write")
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateCustomerDto) {
    return this.customers.create(user, dto);
  }

  @Patch(":id")
  @RequirePermissions("customers.write")
  update(
    @CurrentUser() user: RequestUser,
    @Param("id") id: string,
    @Body() dto: UpdateCustomerDto,
  ) {
    return this.customers.update(user, id, dto);
  }

  @Delete(":id")
  @RequirePermissions("customers.write")
  remove(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.customers.softDelete(user, id);
  }

  @Post(":id/restore")
  @RequirePermissions("customers.write")
  restore(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.customers.restore(user, id);
  }

  @Post(":id/vehicles")
  @RequirePermissions("customers.write")
  addVehicle(
    @CurrentUser() user: RequestUser,
    @Param("id") id: string,
    @Body() dto: CreateVehicleDto,
  ) {
    return this.customers.addVehicle(user, id, dto);
  }
}
