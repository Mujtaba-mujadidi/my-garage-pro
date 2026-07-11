import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { RequirePermissions } from "../auth/decorators/permissions.decorator";
import type { RequestUser } from "../auth/auth.types";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { CancelPcoBookingDto } from "./dto/cancel-pco-booking.dto";
import { CompletePcoBookingDto } from "./dto/complete-pco-booking.dto";
import { CreatePcoBookingDto } from "./dto/create-pco-booking.dto";
import { CreatePcoCentreDto } from "./dto/create-pco-centre.dto";
import { RecordPcoPaymentDto } from "./dto/record-pco-payment.dto";
import { SchedulePcoBookingDto } from "./dto/schedule-pco-booking.dto";
import { UpdatePcoBookingDto } from "./dto/update-pco-booking.dto";
import { PcoService } from "./pco.service";

@Controller("pco")
@UseGuards(PermissionsGuard)
export class PcoController {
  constructor(private readonly pco: PcoService) {}

  @Get("centres")
  @RequirePermissions("pco.read")
  listCentres(@CurrentUser() user: RequestUser) {
    return this.pco.listCentres(user);
  }

  @Post("centres")
  @RequirePermissions("pco.write")
  createCentre(@CurrentUser() user: RequestUser, @Body() dto: CreatePcoCentreDto) {
    return this.pco.createCentre(user, dto);
  }

  @Delete("centres/:id")
  @RequirePermissions("pco.write")
  deleteCentre(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.pco.deleteCentre(user, id);
  }

  @Get("lookup")
  @RequirePermissions("pco.read")
  lookupVrm(@CurrentUser() user: RequestUser, @Query("vrm") vrm: string) {
    return this.pco.lookupVrm(user, vrm);
  }

  @Get("slot-credits")
  @RequirePermissions("pco.read")
  listSlotCredits(@CurrentUser() user: RequestUser, @Query("vrm") vrm: string) {
    return this.pco.listSlotCredits(user, vrm);
  }

  @Get("bookings")
  @RequirePermissions("pco.read")
  listBookings(@CurrentUser() user: RequestUser, @Query("tab") tab = "active") {
    return this.pco.listBookings(user, tab);
  }

  @Post("bookings")
  @RequirePermissions("pco.write")
  createBooking(@CurrentUser() user: RequestUser, @Body() dto: CreatePcoBookingDto) {
    return this.pco.createBooking(user, dto);
  }

  @Get("bookings/:id")
  @RequirePermissions("pco.read")
  getBooking(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.pco.getBooking(user, id);
  }

  @Patch("bookings/:id")
  @RequirePermissions("pco.write")
  updateBooking(
    @CurrentUser() user: RequestUser,
    @Param("id") id: string,
    @Body() dto: UpdatePcoBookingDto,
  ) {
    return this.pco.updateBooking(user, id, dto);
  }

  @Post("bookings/:id/schedule")
  @RequirePermissions("pco.write")
  scheduleBooking(
    @CurrentUser() user: RequestUser,
    @Param("id") id: string,
    @Body() dto: SchedulePcoBookingDto,
  ) {
    return this.pco.scheduleBooking(user, id, dto);
  }

  @Post("bookings/:id/return-to-book")
  @RequirePermissions("pco.write")
  returnActiveToBook(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.pco.returnActiveToBook(user, id);
  }

  @Post("bookings/:id/payments")
  @RequirePermissions("pco.write", "ledger.write")
  recordPayment(
    @CurrentUser() user: RequestUser,
    @Param("id") id: string,
    @Body() dto: RecordPcoPaymentDto,
  ) {
    return this.pco.recordPayment(user, id, dto);
  }

  @Post("bookings/:id/complete")
  @RequirePermissions("pco.write")
  completeBooking(
    @CurrentUser() user: RequestUser,
    @Param("id") id: string,
    @Body() dto: CompletePcoBookingDto,
  ) {
    return this.pco.completeBooking(user, id, dto);
  }

  @Post("bookings/:id/cancel")
  @RequirePermissions("pco.write")
  cancelBooking(
    @CurrentUser() user: RequestUser,
    @Param("id") id: string,
    @Body() dto: CancelPcoBookingDto,
  ) {
    return this.pco.cancelBooking(user, id, dto);
  }

  @Post("bookings/:id/cancel-and-reschedule")
  @RequirePermissions("pco.write")
  cancelAndReschedule(
    @CurrentUser() user: RequestUser,
    @Param("id") id: string,
    @Body() dto: CancelPcoBookingDto,
  ) {
    return this.pco.cancelAndReschedule(user, id, dto);
  }
}
