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
import { BodyworkJobStatus } from "@prisma/client";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { RequireAnyPermissions } from "../auth/decorators/any-permissions.decorator";
import { RequirePermissions } from "../auth/decorators/permissions.decorator";
import type { RequestUser } from "../auth/auth.types";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { CreateBodyworkJobDto } from "./dto/create-bodywork-job.dto";
import { CreateBodyworkTaskDto } from "./dto/create-bodywork-task.dto";
import { UpdateBodyworkJobDto } from "./dto/update-bodywork-job.dto";
import { UpdateBodyworkJobStatusDto } from "./dto/update-bodywork-job-status.dto";
import { UpdateBodyworkTaskDto } from "./dto/update-bodywork-task.dto";
import { BodyworkJobsService } from "./bodywork-jobs.service";
import {
  workshopStaffHttpPermissions,
  workshopTaskPatchHttpPermissions,
} from "@mygaragepro/shared";

@Controller("bodywork-jobs")
@UseGuards(PermissionsGuard)
export class BodyworkJobsController {
  constructor(private readonly bodyworkJobs: BodyworkJobsService) {}

  @Get()
  @RequireAnyPermissions(...workshopStaffHttpPermissions("bodywork"))
  list(
    @CurrentUser() user: RequestUser,
    @Query("q") q?: string,
    @Query("status") status?: BodyworkJobStatus,
    @Query("scope") scope?: "mine" | "available",
    @Query("customerId") customerId?: string,
  ) {
    return this.bodyworkJobs.list(user, q, status, scope, customerId);
  }

  @Get("assignees")
  @RequirePermissions("bodywork.read")
  assignees(@CurrentUser() user: RequestUser) {
    return this.bodyworkJobs.listAssignees(user);
  }

  @Get(":id")
  @RequireAnyPermissions(...workshopStaffHttpPermissions("bodywork"))
  getOne(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.bodyworkJobs.getOne(user, id);
  }

  @Post()
  @RequirePermissions("bodywork.write")
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateBodyworkJobDto) {
    return this.bodyworkJobs.create(user, dto);
  }

  @Patch(":id")
  @RequirePermissions("bodywork.write")
  update(
    @CurrentUser() user: RequestUser,
    @Param("id") id: string,
    @Body() dto: UpdateBodyworkJobDto,
  ) {
    return this.bodyworkJobs.update(user, id, dto);
  }

  @Post(":id/status")
  @RequirePermissions("bodywork.write")
  updateStatus(
    @CurrentUser() user: RequestUser,
    @Param("id") id: string,
    @Body() dto: UpdateBodyworkJobStatusDto,
  ) {
    return this.bodyworkJobs.updateStatus(user, id, dto);
  }

  @Post(":id/tasks")
  @RequirePermissions("bodywork.write")
  addTask(
    @CurrentUser() user: RequestUser,
    @Param("id") id: string,
    @Body() dto: CreateBodyworkTaskDto,
  ) {
    return this.bodyworkJobs.addTask(user, id, dto);
  }

  @Patch(":id/tasks/:taskId")
  @RequireAnyPermissions(...workshopTaskPatchHttpPermissions("bodywork"))
  updateTask(
    @CurrentUser() user: RequestUser,
    @Param("id") id: string,
    @Param("taskId") taskId: string,
    @Body() dto: UpdateBodyworkTaskDto,
  ) {
    return this.bodyworkJobs.updateTask(user, id, taskId, dto);
  }

  @Post(":id/tasks/:taskId/claim")
  @RequireAnyPermissions(...workshopStaffHttpPermissions("bodywork"))
  claimTask(
    @CurrentUser() user: RequestUser,
    @Param("id") id: string,
    @Param("taskId") taskId: string,
  ) {
    return this.bodyworkJobs.claimTask(user, id, taskId);
  }

  @Delete(":id/tasks/:taskId")
  @RequirePermissions("bodywork.write")
  deleteTask(
    @CurrentUser() user: RequestUser,
    @Param("id") id: string,
    @Param("taskId") taskId: string,
  ) {
    return this.bodyworkJobs.deleteTask(user, id, taskId);
  }

  @Post(":id/invoice")
  @RequirePermissions("bodywork.write", "invoices.write")
  generateInvoice(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.bodyworkJobs.generateInvoice(user, id);
  }

  @Post(":id/invoice/refresh")
  @RequirePermissions("bodywork.write", "invoices.write")
  refreshInvoice(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.bodyworkJobs.refreshInvoice(user, id);
  }
}
