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
import { RepairJobStatus } from "@prisma/client";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { RequireAnyPermissions } from "../auth/decorators/any-permissions.decorator";
import { RequirePermissions } from "../auth/decorators/permissions.decorator";
import type { RequestUser } from "../auth/auth.types";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { CreateRepairJobDto } from "./dto/create-repair-job.dto";
import { CreateRepairTaskDto } from "./dto/create-repair-task.dto";
import { UpdateRepairJobDto } from "./dto/update-repair-job.dto";
import { UpdateRepairJobStatusDto } from "./dto/update-repair-job-status.dto";
import { UpdateRepairTaskDto } from "./dto/update-repair-task.dto";
import { RepairJobsService } from "./repair-jobs.service";
import {
  workshopStaffHttpPermissions,
  workshopTaskPatchHttpPermissions,
} from "@mygaragepro/shared";

@Controller("repair-jobs")
@UseGuards(PermissionsGuard)
export class RepairJobsController {
  constructor(private readonly repairJobs: RepairJobsService) {}

  @Get()
  @RequireAnyPermissions(...workshopStaffHttpPermissions("repair"))
  list(
    @CurrentUser() user: RequestUser,
    @Query("q") q?: string,
    @Query("status") status?: RepairJobStatus,
    @Query("scope") scope?: "mine" | "available",
    @Query("customerId") customerId?: string,
  ) {
    return this.repairJobs.list(user, q, status, scope, customerId);
  }

  @Get("assignees")
  @RequirePermissions("repair.read")
  assignees(@CurrentUser() user: RequestUser) {
    return this.repairJobs.listAssignees(user);
  }

  @Get(":id")
  @RequireAnyPermissions("repair.read", "repair.work")
  getOne(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.repairJobs.getOne(user, id);
  }

  @Post()
  @RequirePermissions("repair.write")
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateRepairJobDto) {
    return this.repairJobs.create(user, dto);
  }

  @Patch(":id")
  @RequirePermissions("repair.write")
  update(
    @CurrentUser() user: RequestUser,
    @Param("id") id: string,
    @Body() dto: UpdateRepairJobDto,
  ) {
    return this.repairJobs.update(user, id, dto);
  }

  @Post(":id/status")
  @RequirePermissions("repair.write")
  updateStatus(
    @CurrentUser() user: RequestUser,
    @Param("id") id: string,
    @Body() dto: UpdateRepairJobStatusDto,
  ) {
    return this.repairJobs.updateStatus(user, id, dto);
  }

  @Post(":id/tasks")
  @RequirePermissions("repair.write")
  addTask(
    @CurrentUser() user: RequestUser,
    @Param("id") id: string,
    @Body() dto: CreateRepairTaskDto,
  ) {
    return this.repairJobs.addTask(user, id, dto);
  }

  @Patch(":id/tasks/:taskId")
  @RequireAnyPermissions(...workshopTaskPatchHttpPermissions("repair"))
  updateTask(
    @CurrentUser() user: RequestUser,
    @Param("id") id: string,
    @Param("taskId") taskId: string,
    @Body() dto: UpdateRepairTaskDto,
  ) {
    return this.repairJobs.updateTask(user, id, taskId, dto);
  }

  @Post(":id/tasks/:taskId/claim")
  @RequireAnyPermissions(...workshopStaffHttpPermissions("repair"))
  claimTask(
    @CurrentUser() user: RequestUser,
    @Param("id") id: string,
    @Param("taskId") taskId: string,
  ) {
    return this.repairJobs.claimTask(user, id, taskId);
  }

  @Delete(":id/tasks/:taskId")
  @RequirePermissions("repair.write")
  deleteTask(
    @CurrentUser() user: RequestUser,
    @Param("id") id: string,
    @Param("taskId") taskId: string,
  ) {
    return this.repairJobs.deleteTask(user, id, taskId);
  }

  @Post(":id/invoice")
  @RequirePermissions("repair.write", "invoices.write")
  generateInvoice(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.repairJobs.generateInvoice(user, id);
  }

  @Post(":id/invoice/refresh")
  @RequirePermissions("repair.write", "invoices.write")
  refreshInvoice(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.repairJobs.refreshInvoice(user, id);
  }
}
