import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  PcoBookingStatus,
  PcoBookingSlotPaidBy,
  PcoJobType,
  PcoSlotCreditStatus,
  PcoSlotFeeDisposition,
  PcoVehicleStatus,
  Prisma,
} from "@prisma/client";
import { calculateLogbookExpiryFromFirstRegistration, PCO_DUE_SOON_DAYS, PCO_DEFAULT_BOOKING_CHARGE, sortPcoBookingsByPriority } from "@mygaragepro/shared";
import { AuditService } from "../audit/audit.service";
import type { RequestUser } from "../auth/auth.types";
import { normalizeRegistration } from "../customers/customers.mapper";
import { roundMoney } from "../invoices/invoice-calculations";
import { LedgerService } from "../ledger/ledger.service";
import { PrismaService } from "../prisma/prisma.service";
import { CompletePcoBookingDto } from "./dto/complete-pco-booking.dto";
import { CancelPcoBookingDto } from "./dto/cancel-pco-booking.dto";
import { CreatePcoBookingDto } from "./dto/create-pco-booking.dto";
import { CreatePcoCentreDto } from "./dto/create-pco-centre.dto";
import { RecordPcoPaymentDto } from "./dto/record-pco-payment.dto";
import { SchedulePcoBookingDto } from "./dto/schedule-pco-booking.dto";
import { UpdatePcoBookingDto } from "./dto/update-pco-booking.dto";
import {
  toPcoBookingDto,
  toPcoBookingListDto,
  toPcoCentreDto,
  toPcoDueVehicleDto,
  toPcoSlotCreditDto,
  toPcoVehicleDto,
} from "./pco.mapper";

export const PCO_CENTRE_OPTION_TYPE = "pco_booking_centre";

@Injectable()
export class PcoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly ledger: LedgerService,
  ) {}

  private garageId(user: RequestUser): string {
    if (!user.garageAccountId) throw new ForbiddenException("No garage context");
    if (!user.enabledModules.includes("pco")) {
      throw new ForbiddenException("PCO module is not enabled");
    }
    return user.garageAccountId;
  }

  private bookingInclude = {
    vehicle: true,
    bookingCentre: { select: { label: true } },
    slotPaymentAccount: { select: { name: true } },
    slotCreditSourceBooking: { select: { bookingNumber: true } },
    rescheduledFromBooking: { select: { bookingNumber: true } },
    rescheduledToBooking: { select: { bookingNumber: true } },
    payments: { include: { paymentAccount: { select: { name: true } } }, orderBy: { createdAt: "asc" } },
    createdBy: { select: { displayName: true } },
    completedBy: { select: { displayName: true } },
  } as const;

  private listInclude = {
    vehicle: true,
    bookingCentre: { select: { label: true } },
  } as const;

  private parseDate(iso: string): Date {
    return new Date(`${iso}T00:00:00.000Z`);
  }

  /** One open (PENDING or ACTIVE) booking per VRM across all vehicle records. */
  private async findOpenBookingByVrm(
    garageAccountId: string,
    vrm: string,
    excludeBookingId?: string,
  ) {
    return this.prisma.pcoBooking.findFirst({
      where: {
        garageAccountId,
        status: { in: [PcoBookingStatus.PENDING, PcoBookingStatus.ACTIVE] },
        vehicle: { vrm },
        ...(excludeBookingId ? { id: { not: excludeBookingId } } : {}),
      },
      include: { vehicle: { select: { vrm: true } } },
      orderBy: [{ updatedAt: "desc" }],
    });
  }

  private openBookingErrorMessage(
    vrm: string,
    booking: { bookingNumber: string; status: PcoBookingStatus },
  ) {
    const list =
      booking.status === PcoBookingStatus.ACTIVE ? "Active bookings" : "To book";
    return `${vrm} already has an open booking (${booking.bookingNumber}) on ${list}. Complete, cancel, or reschedule it before adding another.`;
  }

  private dedupeListByVrm<T extends { vrm: string }>(rows: T[]): T[] {
    const byVrm = new Map<string, T>();
    for (const row of rows) {
      const key = normalizeRegistration(row.vrm);
      if (!byVrm.has(key)) byVrm.set(key, row);
    }
    return [...byVrm.values()];
  }

  private keeperKey(name: string) {
    return name.trim().toLowerCase();
  }

  /** Active booking where the garage or customer paid a TfL slot fee (not N/A or TfL credit). */
  private hadActiveSlotFee(booking: {
    status: PcoBookingStatus;
    slotPaidBy: PcoBookingSlotPaidBy | null;
  }) {
    return (
      booking.status === PcoBookingStatus.ACTIVE &&
      (booking.slotPaidBy === PcoBookingSlotPaidBy.US ||
        booking.slotPaidBy === PcoBookingSlotPaidBy.CUSTOMER)
    );
  }

  private validateCancellationInput(
    hadSlotFee: boolean,
    dto: CancelPcoBookingDto,
  ): { disposition: PcoSlotFeeDisposition; note: string | null } {
    if (!hadSlotFee) {
      return { disposition: PcoSlotFeeDisposition.NOT_APPLICABLE, note: null };
    }
    if (
      !dto.slotFeeDisposition ||
      dto.slotFeeDisposition === PcoSlotFeeDisposition.NOT_APPLICABLE
    ) {
      throw new BadRequestException(
        "Choose whether to keep the slot fee for a future booking or request a refund",
      );
    }
    const note = dto.cancellationNote?.trim();
    if (!note) {
      throw new BadRequestException("A cancellation note is required when a slot fee was paid");
    }
    return { disposition: dto.slotFeeDisposition, note };
  }

  private async nextBookingNumber(
    tx: Prisma.TransactionClient,
    garageAccountId: string,
  ) {
    const garage = await tx.garageAccount.update({
      where: { id: garageAccountId },
      data: { pcoNextSeq: { increment: 1 } },
      select: { pcoNextSeq: true },
    });
    const year = new Date().getFullYear();
    return `PCO-${year}-${String(garage.pcoNextSeq).padStart(5, "0")}`;
  }

  private async resolveVehicle(
    tx: Prisma.TransactionClient,
    garageAccountId: string,
    dto: CreatePcoBookingDto,
  ) {
    const vrm = normalizeRegistration(dto.vrm);
    const logbookExpiry =
      dto.logbookExpiryDate ??
      calculateLogbookExpiryFromFirstRegistration(dto.firstRegistrationDate);
    if (!logbookExpiry) {
      throw new BadRequestException("Invalid first registration date for logbook expiry");
    }

    const active = await tx.pcoVehicle.findFirst({
      where: { garageAccountId, vrm, status: PcoVehicleStatus.ACTIVE },
    });

    const vehicleData = {
      vrm,
      registeredKeeper: dto.registeredKeeper.trim(),
      addressLine1: dto.addressLine1?.trim() || null,
      addressLine2: dto.addressLine2?.trim() || null,
      city: dto.city?.trim() || null,
      postcode: dto.postcode?.trim() || null,
      email: dto.email?.trim() || null,
      phone: dto.phone?.trim() || null,
      make: dto.make?.trim() || null,
      model: dto.model?.trim() || null,
      color: dto.color?.trim() || null,
      fuelType: dto.fuelType?.trim() || null,
      seatCount: dto.seatCount ?? null,
      firstRegistrationDate: this.parseDate(dto.firstRegistrationDate),
      pcoExpiryDate: this.parseDate(dto.pcoExpiryDate),
      logbookExpiryDate: this.parseDate(logbookExpiry),
      note: dto.note?.trim() || null,
      customerId: dto.customerId ?? null,
    };

    if (!active) {
      return tx.pcoVehicle.create({
        data: { garageAccountId, ...vehicleData },
      });
    }

    if (this.keeperKey(active.registeredKeeper) !== this.keeperKey(dto.registeredKeeper)) {
      await tx.pcoVehicle.update({
        where: { id: active.id },
        data: { status: PcoVehicleStatus.ARCHIVED, archivedAt: new Date() },
      });
      return tx.pcoVehicle.create({
        data: { garageAccountId, ...vehicleData },
      });
    }

    return tx.pcoVehicle.update({
      where: { id: active.id },
      data: vehicleData,
    });
  }

  async listCentres(user: RequestUser) {
    const garageAccountId = this.garageId(user);
    const rows = await this.prisma.settingOption.findMany({
      where: {
        garageAccountId,
        optionType: PCO_CENTRE_OPTION_TYPE,
        deletedAt: null,
      },
      orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
    });
    return rows.map(toPcoCentreDto);
  }

  async createCentre(user: RequestUser, dto: CreatePcoCentreDto) {
    const garageAccountId = this.garageId(user);
    const row = await this.prisma.settingOption.create({
      data: {
        garageAccountId,
        optionType: PCO_CENTRE_OPTION_TYPE,
        label: dto.label.trim(),
        value: (dto.value ?? dto.label).trim(),
        sortOrder: dto.sortOrder ?? 0,
      },
    });
    await this.audit.log({
      action: "pco.centre.create",
      userId: user.id,
      garageAccountId,
      entityType: "setting_option",
      entityId: row.id,
    });
    return toPcoCentreDto(row);
  }

  async deleteCentre(user: RequestUser, id: string) {
    const garageAccountId = this.garageId(user);
    const existing = await this.prisma.settingOption.findFirst({
      where: {
        id,
        garageAccountId,
        optionType: PCO_CENTRE_OPTION_TYPE,
        deletedAt: null,
      },
    });
    if (!existing) throw new NotFoundException("Booking centre not found");

    await this.prisma.settingOption.update({
      where: { id },
      data: { deletedAt: new Date(), deletedBy: user.id },
    });
    await this.audit.log({
      action: "pco.centre.delete",
      userId: user.id,
      garageAccountId,
      entityType: "setting_option",
      entityId: id,
      metadata: { label: existing.label },
    });
    return { ok: true };
  }

  async lookupVrm(user: RequestUser, vrmRaw: string) {
    const garageAccountId = this.garageId(user);
    const vrm = normalizeRegistration(vrmRaw);
    if (!vrm) throw new BadRequestException("VRM is required");

    const activeVehicle = await this.prisma.pcoVehicle.findFirst({
      where: { garageAccountId, vrm, status: PcoVehicleStatus.ACTIVE },
    });

    const lastCompleted = await this.prisma.pcoBooking.findFirst({
      where: {
        garageAccountId,
        status: PcoBookingStatus.COMPLETED,
        vehicle: { vrm },
      },
      orderBy: { completedAt: "desc" },
      include: { vehicle: true },
    });

    const activeBooking = await this.prisma.pcoBooking.findFirst({
      where: {
        garageAccountId,
        status: PcoBookingStatus.ACTIVE,
        vehicle: { vrm },
      },
      include: { bookingCentre: { select: { label: true } } },
    });

    const openBooking = await this.findOpenBookingByVrm(garageAccountId, vrm);

    const completed = await this.prisma.pcoBooking.findMany({
      where: {
        garageAccountId,
        status: PcoBookingStatus.COMPLETED,
        vehicle: { vrm },
      },
      orderBy: { completedAt: "desc" },
      take: 5,
      select: {
        bookingNumber: true,
        jobType: true,
        chargeGross: true,
        completedAt: true,
      },
    });

    return {
      activeVehicle: activeVehicle ? toPcoVehicleDto(activeVehicle) : null,
      lastCompletedVehicle: lastCompleted ? toPcoVehicleDto(lastCompleted.vehicle) : null,
      activeBooking: activeBooking
        ? {
            id: activeBooking.id,
            bookingNumber: activeBooking.bookingNumber,
            bookingDate: activeBooking.bookingDate
              ? activeBooking.bookingDate.toISOString().slice(0, 10)
              : null,
            bookingTime: activeBooking.bookingTime,
            bookingCentreId: activeBooking.bookingCentreId,
            bookingCentreName: activeBooking.bookingCentre?.label ?? null,
            slotPaidBy: activeBooking.slotPaidBy,
            chargeGross: activeBooking.chargeGross.toString(),
          }
        : null,
      openBooking: openBooking
        ? {
            id: openBooking.id,
            bookingNumber: openBooking.bookingNumber,
            status: openBooking.status,
            jobType: openBooking.jobType,
          }
        : null,
      previousCharges: completed.map((b) => ({
        bookingNumber: b.bookingNumber,
        jobType: b.jobType,
        chargeGross: b.chargeGross.toString(),
        completedAt: b.completedAt?.toISOString() ?? null,
      })),
    };
  }

  async listBookings(user: RequestUser, tab: string) {
    const garageAccountId = this.garageId(user);

    if (tab === "renewals_due" || tab === "v5c_expiring" || tab === "logbook_due") {
      const dueTab = tab === "logbook_due" ? "v5c_expiring" : tab;
      const vehicles = await this.prisma.pcoVehicle.findMany({
        where: { garageAccountId, status: PcoVehicleStatus.ACTIVE },
        orderBy: [{ pcoExpiryDate: "asc" }],
      });

      const today = new Date();
      const end = new Date(today);
      end.setUTCDate(end.getUTCDate() + PCO_DUE_SOON_DAYS);

      const due: ReturnType<typeof toPcoDueVehicleDto>[] = [];

      for (const v of vehicles) {
        const dueDate =
          dueTab === "renewals_due" ? v.pcoExpiryDate : v.logbookExpiryDate;
        if (dueDate < today || dueDate > end) continue;

        const openBooking = await this.prisma.pcoBooking.findFirst({
          where: {
            garageAccountId,
            status: { in: [PcoBookingStatus.PENDING, PcoBookingStatus.ACTIVE] },
            vehicle: { vrm: v.vrm },
          },
        });
        if (openBooking) continue;

        const lastBooking = await this.prisma.pcoBooking.findFirst({
          where: {
            garageAccountId,
            pcoVehicleId: v.id,
            status: PcoBookingStatus.COMPLETED,
          },
          orderBy: { completedAt: "desc" },
          select: { bookingNumber: true, chargeGross: true },
        });

        due.push(toPcoDueVehicleDto(v, dueDate, lastBooking));
      }

      return due.sort((a, b) => a.daysUntilDue - b.daysUntilDue);
    }

    const statusByTab: Record<string, PcoBookingStatus> = {
      pending: PcoBookingStatus.PENDING,
      active: PcoBookingStatus.ACTIVE,
      past: PcoBookingStatus.COMPLETED,
    };
    const status = statusByTab[tab];
    if (!status) throw new BadRequestException("Invalid tab");

    const rows = await this.prisma.pcoBooking.findMany({
      where: { garageAccountId, status },
      include: this.listInclude,
      orderBy:
        tab === "past"
          ? [{ completedAt: "desc" }, { createdAt: "desc" }]
          : tab === "active"
            ? [{ bookingDate: "asc" }, { createdAt: "desc" }]
            : [{ createdAt: "desc" }],
      take: 300,
    });

    const mapped = rows.map(toPcoBookingListDto);
    if (tab === "pending") {
      const activeForVrm = await this.prisma.pcoBooking.findMany({
        where: { garageAccountId, status: PcoBookingStatus.ACTIVE },
        select: { vehicle: { select: { vrm: true } } },
      });
      const activeVrms = new Set(activeForVrm.map((b) => normalizeRegistration(b.vehicle.vrm)));
      const withoutActiveDuplicate = mapped.filter(
        (r) => !activeVrms.has(normalizeRegistration(r.vrm)),
      );
      return sortPcoBookingsByPriority(this.dedupeListByVrm(withoutActiveDuplicate));
    }
    if (tab === "active") {
      return this.dedupeListByVrm(mapped);
    }
    return mapped;
  }

  async getBooking(user: RequestUser, id: string) {
    const garageAccountId = this.garageId(user);
    const row = await this.prisma.pcoBooking.findFirst({
      where: { id, garageAccountId },
      include: this.bookingInclude,
    });
    if (!row) throw new NotFoundException("PCO booking not found");
    return toPcoBookingDto(row);
  }

  async createBooking(user: RequestUser, dto: CreatePcoBookingDto) {
    const garageAccountId = this.garageId(user);
    const vrm = normalizeRegistration(dto.vrm);

    const existingOpen = await this.findOpenBookingByVrm(garageAccountId, vrm);
    if (existingOpen) {
      throw new BadRequestException(this.openBookingErrorMessage(vrm, existingOpen));
    }

    const now = new Date();
    const informed = dto.clientInformed ?? false;
    const responded = dto.clientResponded ?? false;

    const row = await this.prisma.$transaction(async (tx) => {
      const vehicle = await this.resolveVehicle(tx, garageAccountId, dto);
      const bookingNumber = await this.nextBookingNumber(tx, garageAccountId);

      return tx.pcoBooking.create({
        data: {
          garageAccountId,
          pcoVehicleId: vehicle.id,
          bookingNumber,
          jobType: dto.jobType,
          jobDetails: dto.jobDetails?.trim() || null,
          notes: dto.notes?.trim() || null,
          status: PcoBookingStatus.PENDING,
          priority: dto.priority ?? "MEDIUM",
          chargeGross: roundMoney(dto.chargeGross ?? 0),
          clientInformed: informed,
          clientResponded: responded,
          clientInformedAt: informed ? now : null,
          clientRespondedAt: responded ? now : null,
          createdById: user.id,
        },
        include: this.bookingInclude,
      });
    });

    await this.audit.log({
      action: "pco.booking.create",
      userId: user.id,
      garageAccountId,
      entityType: "pco_booking",
      entityId: row.id,
      metadata: { bookingNumber: row.bookingNumber, vrm: row.vehicle.vrm },
    });

    return toPcoBookingDto(row);
  }

  async updateBooking(user: RequestUser, id: string, dto: UpdatePcoBookingDto) {
    const garageAccountId = this.garageId(user);
    const existing = await this.prisma.pcoBooking.findFirst({
      where: { id, garageAccountId },
      include: { vehicle: true },
    });
    if (!existing) throw new NotFoundException("PCO booking not found");
    if (existing.status !== PcoBookingStatus.PENDING && existing.status !== PcoBookingStatus.ACTIVE) {
      throw new BadRequestException("Only pending or active bookings can be edited");
    }

    const now = new Date();
    const bookingData: Prisma.PcoBookingUpdateInput = {};

    if (dto.jobType !== undefined) bookingData.jobType = dto.jobType;
    if (dto.jobDetails !== undefined) bookingData.jobDetails = dto.jobDetails?.trim() || null;
    if (dto.notes !== undefined) bookingData.notes = dto.notes?.trim() || null;
    if (dto.priority !== undefined) bookingData.priority = dto.priority;
    if (dto.chargeGross !== undefined) bookingData.chargeGross = roundMoney(dto.chargeGross);
    if (dto.bookingDate !== undefined) {
      bookingData.bookingDate = dto.bookingDate ? this.parseDate(dto.bookingDate) : null;
    }
    if (dto.bookingTime !== undefined) bookingData.bookingTime = dto.bookingTime;
    if (dto.bookingCentreId !== undefined) {
      bookingData.bookingCentre = dto.bookingCentreId
        ? { connect: { id: dto.bookingCentreId } }
        : { disconnect: true };
    }
    if (dto.clientInformed !== undefined) {
      bookingData.clientInformed = dto.clientInformed;
      bookingData.clientInformedAt = dto.clientInformed ? now : null;
    }
    if (dto.clientResponded !== undefined) {
      bookingData.clientResponded = dto.clientResponded;
      bookingData.clientRespondedAt = dto.clientResponded ? now : null;
    }

    const vehicleData: Prisma.PcoVehicleUpdateInput = {};
    if (dto.registeredKeeper !== undefined) vehicleData.registeredKeeper = dto.registeredKeeper.trim();
    if (dto.addressLine1 !== undefined) vehicleData.addressLine1 = dto.addressLine1?.trim() || null;
    if (dto.addressLine2 !== undefined) vehicleData.addressLine2 = dto.addressLine2?.trim() || null;
    if (dto.city !== undefined) vehicleData.city = dto.city?.trim() || null;
    if (dto.postcode !== undefined) vehicleData.postcode = dto.postcode?.trim() || null;
    if (dto.email !== undefined) vehicleData.email = dto.email?.trim() || null;
    if (dto.phone !== undefined) vehicleData.phone = dto.phone?.trim() || null;
    if (dto.make !== undefined) vehicleData.make = dto.make?.trim() || null;
    if (dto.model !== undefined) vehicleData.model = dto.model?.trim() || null;
    if (dto.color !== undefined) vehicleData.color = dto.color?.trim() || null;
    if (dto.fuelType !== undefined) vehicleData.fuelType = dto.fuelType?.trim() || null;
    if (dto.seatCount !== undefined) vehicleData.seatCount = dto.seatCount ?? null;
    if (dto.vehicleNote !== undefined) vehicleData.note = dto.vehicleNote?.trim() || null;
    if (dto.pcoExpiryDate !== undefined) {
      vehicleData.pcoExpiryDate = this.parseDate(dto.pcoExpiryDate);
    }

    const row = await this.prisma.$transaction(async (tx) => {
      if (Object.keys(vehicleData).length > 0) {
        await tx.pcoVehicle.update({
          where: { id: existing.pcoVehicleId },
          data: vehicleData,
        });
      }
      return tx.pcoBooking.update({
        where: { id },
        data: bookingData,
        include: this.bookingInclude,
      });
    });

    return toPcoBookingDto(row);
  }

  async scheduleBooking(user: RequestUser, id: string, dto: SchedulePcoBookingDto) {
    const garageAccountId = this.garageId(user);
    const existing = await this.prisma.pcoBooking.findFirst({
      where: { id, garageAccountId },
      include: { vehicle: true },
    });
    if (!existing) throw new NotFoundException("PCO booking not found");
    if (existing.status !== PcoBookingStatus.PENDING) {
      throw new BadRequestException("Only pending bookings can be scheduled");
    }

    const centre = await this.prisma.settingOption.findFirst({
      where: {
        id: dto.bookingCentreId,
        garageAccountId,
        optionType: PCO_CENTRE_OPTION_TYPE,
        deletedAt: null,
      },
    });
    if (!centre) throw new BadRequestException("Booking centre not found");

    const otherActive = await this.findOpenBookingByVrm(
      garageAccountId,
      existing.vehicle.vrm,
      id,
    );
    if (otherActive?.status === PcoBookingStatus.ACTIVE) {
      throw new BadRequestException(
        this.openBookingErrorMessage(existing.vehicle.vrm, otherActive),
      );
    }

    if (dto.slotPaidBy === PcoBookingSlotPaidBy.US) {
      if (!user.enabledModules.includes("ledger")) {
        throw new ForbiddenException("Ledger module is required to record slot expense");
      }
      if (!dto.slotPaymentAccountId) {
        throw new BadRequestException("Payment account is required when the garage pays the slot");
      }
      const amount = Number(roundMoney(dto.slotChargeGross ?? PCO_DEFAULT_BOOKING_CHARGE));
      if (amount <= 0) {
        throw new BadRequestException("Slot expense amount must be greater than zero");
      }
    }

    if (dto.slotPaidBy === PcoBookingSlotPaidBy.TFL_CREDIT) {
      if (!dto.slotCreditSourceBookingId) {
        throw new BadRequestException("Select which TfL credit to apply");
      }
    }

    const valueDate = this.parseDate(dto.bookingDate);
    const reference = `PCO slot ${existing.bookingNumber} — ${existing.vehicle.vrm}`;

    const row = await this.prisma.$transaction(async (tx) => {
      let slotLedgerEntryId: string | null = null;
      let slotPaymentAccountId: string | null = null;
      let slotChargeGross: Prisma.Decimal | null = null;
      let slotCreditSourceBookingId: string | null = null;

      if (dto.slotPaidBy === PcoBookingSlotPaidBy.US) {
        const amount = Number(roundMoney(dto.slotChargeGross ?? PCO_DEFAULT_BOOKING_CHARGE));
        const ledgerRow = await this.ledger.createPostedExpenseForPcoSlot(
          user,
          {
            pcoBookingId: id,
            paymentAccountId: dto.slotPaymentAccountId!,
            valueDate,
            amountGross: amount,
            reference,
          },
          tx,
        );
        slotLedgerEntryId = ledgerRow.id;
        slotPaymentAccountId = dto.slotPaymentAccountId!;
        slotChargeGross = roundMoney(amount);
      } else if (dto.slotPaidBy === PcoBookingSlotPaidBy.TFL_CREDIT) {
        const creditSource = await tx.pcoBooking.findFirst({
          where: {
            id: dto.slotCreditSourceBookingId!,
            garageAccountId,
            slotCreditStatus: PcoSlotCreditStatus.AVAILABLE,
            vehicle: { vrm: existing.vehicle.vrm },
          },
        });
        if (!creditSource) {
          throw new BadRequestException("TfL credit is not available for this vehicle");
        }
        await tx.pcoBooking.update({
          where: { id: creditSource.id },
          data: { slotCreditStatus: PcoSlotCreditStatus.APPLIED },
        });
        slotCreditSourceBookingId = creditSource.id;
        slotChargeGross =
          creditSource.slotChargeGross ?? roundMoney(PCO_DEFAULT_BOOKING_CHARGE);
      }

      return tx.pcoBooking.update({
        where: { id },
        data: {
          status: PcoBookingStatus.ACTIVE,
          bookingDate: valueDate,
          bookingTime: dto.bookingTime,
          bookingCentreId: dto.bookingCentreId,
          slotPaidBy: dto.slotPaidBy,
          slotPaymentAccountId,
          slotLedgerEntryId,
          slotChargeGross,
          slotCreditSourceBookingId,
        },
        include: this.bookingInclude,
      });
    });

    await this.audit.log({
      action: "pco.booking.schedule",
      userId: user.id,
      garageAccountId,
      entityType: "pco_booking",
      entityId: id,
      metadata: {
        bookingNumber: row.bookingNumber,
        centre: centre.label,
        bookingDate: dto.bookingDate,
        bookingTime: dto.bookingTime,
        slotPaidBy: dto.slotPaidBy,
      },
    });

    return toPcoBookingDto(row);
  }

  /** Move a booked appointment back to To book for re-scheduling. */
  async returnActiveToBook(user: RequestUser, id: string) {
    const garageAccountId = this.garageId(user);
    const existing = await this.prisma.pcoBooking.findFirst({
      where: { id, garageAccountId },
      include: { vehicle: true, bookingCentre: { select: { label: true } } },
    });
    if (!existing) throw new NotFoundException("PCO booking not found");
    if (existing.status !== PcoBookingStatus.ACTIVE) {
      throw new BadRequestException("Only booked appointments can be moved to To book");
    }

    const otherPending = await this.prisma.pcoBooking.findFirst({
      where: {
        garageAccountId,
        status: PcoBookingStatus.PENDING,
        vehicle: { vrm: existing.vehicle.vrm },
        id: { not: id },
      },
    });
    if (otherPending) {
      throw new BadRequestException(
        this.openBookingErrorMessage(existing.vehicle.vrm, otherPending),
      );
    }

    const prevParts: string[] = [];
    if (existing.bookingCentre?.label || existing.bookingDate) {
      const dateStr = existing.bookingDate
        ? existing.bookingDate.toISOString().slice(0, 10)
        : "";
      prevParts.push(
        `Previous appointment: ${existing.bookingCentre?.label ?? "—"}, ${dateStr}${existing.bookingTime ? ` ${existing.bookingTime}` : ""}`.trim(),
      );
    }
    const mergedNotes = [existing.notes, ...prevParts].filter(Boolean).join("\n") || null;

    const row = await this.prisma.$transaction(async (tx) => {
      if (existing.slotLedgerEntryId) {
        await this.ledger.reversePcoSlotExpenseIfPosted(
          user,
          garageAccountId,
          existing.slotLedgerEntryId,
          tx,
        );
      }

      return tx.pcoBooking.update({
        where: { id },
        data: {
          status: PcoBookingStatus.PENDING,
          jobType: PcoJobType.RESCHEDULE,
          bookingDate: null,
          bookingTime: null,
          bookingCentreId: null,
          slotPaidBy: null,
          slotPaymentAccountId: null,
          slotLedgerEntryId: null,
          slotChargeGross: null,
          notes: mergedNotes,
        },
        include: this.bookingInclude,
      });
    });

    await this.audit.log({
      action: "pco.booking.return_to_book",
      userId: user.id,
      garageAccountId,
      entityType: "pco_booking",
      entityId: id,
      metadata: { bookingNumber: row.bookingNumber },
    });

    return toPcoBookingDto(row);
  }

  async recordPayment(user: RequestUser, id: string, dto: RecordPcoPaymentDto) {
    const garageAccountId = this.garageId(user);
    if (!user.enabledModules.includes("ledger")) {
      throw new ForbiddenException("Ledger module is required to record PCO payments");
    }

    const booking = await this.prisma.pcoBooking.findFirst({
      where: { id, garageAccountId },
      include: { vehicle: true },
    });
    if (!booking) throw new NotFoundException("PCO booking not found");
    if (booking.status === PcoBookingStatus.CANCELLED) {
      throw new BadRequestException("Cannot record payment on a cancelled booking");
    }

    const amount = roundMoney(dto.amount);
    const charge = Number(booking.chargeGross);
    const paid = Number(booking.amountPaid);
    if (paid + Number(amount) > charge + 0.009) {
      throw new BadRequestException("Payment exceeds booking balance");
    }

    const valueDate = dto.valueDate ? this.parseDate(dto.valueDate) : new Date();

    const payment = await this.prisma.$transaction(async (tx) => {
      const pcoPayment = await tx.pcoBookingPayment.create({
        data: {
          pcoBookingId: id,
          paymentAccountId: dto.paymentAccountId,
          method: dto.method,
          amount,
          valueDate,
          createdById: user.id,
        },
      });

      const ledgerRow = await this.ledger.createPostedIncomeForPcoPayment(
        user,
        {
          pcoBookingId: id,
          pcoBookingPaymentId: pcoPayment.id,
          paymentAccountId: dto.paymentAccountId,
          method: dto.method,
          valueDate,
          amountGross: Number(amount),
          reference: `PCO ${booking.bookingNumber} — ${booking.vehicle.vrm}`,
        },
        tx,
      );

      await tx.pcoBookingPayment.update({
        where: { id: pcoPayment.id },
        data: { ledgerEntryId: ledgerRow.id },
      });

      await tx.pcoBooking.update({
        where: { id },
        data: { amountPaid: roundMoney(paid + Number(amount)) },
      });

      return pcoPayment;
    });

    await this.audit.log({
      action: "pco.booking.payment",
      userId: user.id,
      garageAccountId,
      entityType: "pco_booking",
      entityId: id,
      metadata: { amount: amount.toString(), paymentId: payment.id },
    });

    return this.getBooking(user, id);
  }

  async completeBooking(user: RequestUser, id: string, dto: CompletePcoBookingDto) {
    const garageAccountId = this.garageId(user);
    const existing = await this.prisma.pcoBooking.findFirst({
      where: { id, garageAccountId },
    });
    if (!existing) throw new NotFoundException("PCO booking not found");
    if (existing.status !== PcoBookingStatus.ACTIVE) {
      throw new BadRequestException("Booking is not active");
    }

    const now = new Date();
    const nextExpiry = this.parseDate(dto.nextPcoExpiryDate);

    await this.prisma.$transaction(async (tx) => {
      await tx.pcoBooking.update({
        where: { id },
        data: {
          status: PcoBookingStatus.COMPLETED,
          completedAt: now,
          completedById: user.id,
        },
      });
      await tx.pcoVehicle.update({
        where: { id: existing.pcoVehicleId },
        data: { pcoExpiryDate: nextExpiry },
      });
    });

    await this.audit.log({
      action: "pco.booking.complete",
      userId: user.id,
      garageAccountId,
      entityType: "pco_booking",
      entityId: id,
      metadata: { nextPcoExpiryDate: dto.nextPcoExpiryDate },
    });

    return this.getBooking(user, id);
  }

  async listSlotCredits(user: RequestUser, vrm: string) {
    const garageAccountId = this.garageId(user);
    const normalized = normalizeRegistration(vrm);
    if (!normalized) {
      throw new BadRequestException("VRM is required");
    }
    const rows = await this.prisma.pcoBooking.findMany({
      where: {
        garageAccountId,
        slotCreditStatus: PcoSlotCreditStatus.AVAILABLE,
        vehicle: { vrm: normalized },
      },
      include: { vehicle: { select: { vrm: true } } },
      orderBy: [{ cancelledAt: "asc" }],
    });
    return rows.map(toPcoSlotCreditDto);
  }

  async cancelBooking(user: RequestUser, id: string, dto: CancelPcoBookingDto) {
    const garageAccountId = this.garageId(user);
    const existing = await this.prisma.pcoBooking.findFirst({
      where: { id, garageAccountId },
    });
    if (!existing) throw new NotFoundException("PCO booking not found");
    if (
      existing.status !== PcoBookingStatus.PENDING &&
      existing.status !== PcoBookingStatus.ACTIVE
    ) {
      throw new BadRequestException("Only pending or active bookings can be cancelled");
    }

    const hadSlotFee = this.hadActiveSlotFee(existing);
    const { disposition, note } = this.validateCancellationInput(hadSlotFee, dto);
    const now = new Date();
    const slotCreditStatus =
      hadSlotFee && disposition === PcoSlotFeeDisposition.RETAINED
        ? PcoSlotCreditStatus.AVAILABLE
        : PcoSlotCreditStatus.NOT_APPLICABLE;

    await this.prisma.$transaction(async (tx) => {
      if (
        hadSlotFee &&
        disposition === PcoSlotFeeDisposition.REFUND_REQUESTED &&
        existing.slotPaidBy === PcoBookingSlotPaidBy.US &&
        existing.slotLedgerEntryId
      ) {
        await this.ledger.reversePcoSlotExpenseIfPosted(
          user,
          garageAccountId,
          existing.slotLedgerEntryId,
          tx,
        );
      }

      await tx.pcoBooking.update({
        where: { id },
        data: {
          status: PcoBookingStatus.CANCELLED,
          slotFeeDisposition: disposition,
          slotCreditStatus,
          cancellationNote: note,
          cancelledAt: now,
          cancelledById: user.id,
        },
      });
    });

    await this.audit.log({
      action: "pco.booking.cancel",
      userId: user.id,
      garageAccountId,
      entityType: "pco_booking",
      entityId: id,
      metadata: {
        bookingNumber: existing.bookingNumber,
        slotFeeDisposition: disposition,
      },
    });

    return this.getBooking(user, id);
  }

  async cancelAndReschedule(user: RequestUser, id: string, dto: CancelPcoBookingDto) {
    const garageAccountId = this.garageId(user);
    const existing = await this.prisma.pcoBooking.findFirst({
      where: { id, garageAccountId },
      include: { vehicle: true, bookingCentre: { select: { label: true } } },
    });
    if (!existing) throw new NotFoundException("PCO booking not found");
    if (existing.status !== PcoBookingStatus.ACTIVE) {
      throw new BadRequestException("Only booked appointments can be rescheduled");
    }

    const otherPending = await this.prisma.pcoBooking.findFirst({
      where: {
        garageAccountId,
        status: PcoBookingStatus.PENDING,
        vehicle: { vrm: existing.vehicle.vrm },
        id: { not: id },
      },
    });
    if (otherPending) {
      throw new BadRequestException(
        this.openBookingErrorMessage(existing.vehicle.vrm, otherPending),
      );
    }

    const hadSlotFee = this.hadActiveSlotFee(existing);
    const { disposition, note } = this.validateCancellationInput(hadSlotFee, dto);
    const now = new Date();
    const slotCreditStatus =
      hadSlotFee && disposition === PcoSlotFeeDisposition.RETAINED
        ? PcoSlotCreditStatus.AVAILABLE
        : PcoSlotCreditStatus.NOT_APPLICABLE;

    const prevParts: string[] = [];
    if (existing.bookingCentre?.label || existing.bookingDate) {
      const dateStr = existing.bookingDate
        ? existing.bookingDate.toISOString().slice(0, 10)
        : "";
      prevParts.push(
        `Rescheduled from ${existing.bookingCentre?.label ?? "—"}, ${dateStr}${existing.bookingTime ? ` ${existing.bookingTime}` : ""}`.trim(),
      );
    }
    const newNotes = [existing.notes, ...prevParts].filter(Boolean).join("\n") || null;

    const result = await this.prisma.$transaction(async (tx) => {
      if (
        hadSlotFee &&
        disposition === PcoSlotFeeDisposition.REFUND_REQUESTED &&
        existing.slotPaidBy === PcoBookingSlotPaidBy.US &&
        existing.slotLedgerEntryId
      ) {
        await this.ledger.reversePcoSlotExpenseIfPosted(
          user,
          garageAccountId,
          existing.slotLedgerEntryId,
          tx,
        );
      }

      const cancelled = await tx.pcoBooking.update({
        where: { id },
        data: {
          status: PcoBookingStatus.CANCELLED,
          slotFeeDisposition: disposition,
          slotCreditStatus,
          cancellationNote: note,
          cancelledAt: now,
          cancelledById: user.id,
        },
        include: this.bookingInclude,
      });

      const bookingNumber = await this.nextBookingNumber(tx, garageAccountId);
      const newBooking = await tx.pcoBooking.create({
        data: {
          garageAccountId,
          pcoVehicleId: existing.pcoVehicleId,
          bookingNumber,
          jobType: PcoJobType.RESCHEDULE,
          status: PcoBookingStatus.PENDING,
          priority: existing.priority,
          chargeGross: existing.chargeGross,
          notes: newNotes,
          rescheduledFromBookingId: id,
          createdById: user.id,
        },
        include: this.bookingInclude,
      });

      await tx.pcoBooking.update({
        where: { id },
        data: { rescheduledToBookingId: newBooking.id },
      });

      return {
        cancelled: { ...cancelled, rescheduledToBookingId: newBooking.id },
        newBooking,
      };
    });

    await this.audit.log({
      action: "pco.booking.cancel_and_reschedule",
      userId: user.id,
      garageAccountId,
      entityType: "pco_booking",
      entityId: id,
      metadata: {
        cancelledBookingNumber: existing.bookingNumber,
        newBookingNumber: result.newBooking.bookingNumber,
        slotFeeDisposition: disposition,
      },
    });

    return {
      cancelled: toPcoBookingDto(result.cancelled),
      newBooking: toPcoBookingDto(result.newBooking),
    };
  }
}
