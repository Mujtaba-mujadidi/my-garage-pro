import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  PcoBookingStatus,
  PcoVehicleStatus,
  Prisma,
} from "@prisma/client";
import { calculateLogbookExpiryFromFirstRegistration, PCO_DUE_SOON_DAYS } from "@mygaragepro/shared";
import { AuditService } from "../audit/audit.service";
import type { RequestUser } from "../auth/auth.types";
import { normalizeRegistration } from "../customers/customers.mapper";
import { roundMoney } from "../invoices/invoice-calculations";
import { LedgerService } from "../ledger/ledger.service";
import { PrismaService } from "../prisma/prisma.service";
import { CompletePcoBookingDto } from "./dto/complete-pco-booking.dto";
import { CreatePcoBookingDto } from "./dto/create-pco-booking.dto";
import { CreatePcoCentreDto } from "./dto/create-pco-centre.dto";
import { RecordPcoPaymentDto } from "./dto/record-pco-payment.dto";
import { UpdatePcoBookingDto } from "./dto/update-pco-booking.dto";
import {
  toPcoBookingDto,
  toPcoBookingListDto,
  toPcoCentreDto,
  toPcoDueVehicleDto,
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

  private keeperKey(name: string) {
    return name.trim().toLowerCase();
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

    if (tab === "renewals_due" || tab === "logbook_due") {
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
          tab === "renewals_due" ? v.pcoExpiryDate : v.logbookExpiryDate;
        if (dueDate < today || dueDate > end) continue;

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

    const status =
      tab === "past" ? PcoBookingStatus.COMPLETED : PcoBookingStatus.ACTIVE;

    const rows = await this.prisma.pcoBooking.findMany({
      where: { garageAccountId, status },
      include: this.listInclude,
      orderBy:
        tab === "past"
          ? [{ completedAt: "desc" }, { createdAt: "desc" }]
          : [{ bookingDate: "asc" }, { createdAt: "desc" }],
      take: 300,
    });

    return rows.map(toPcoBookingListDto);
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
    const now = new Date();
    const informed = dto.clientInformed ?? false;
    const responded = dto.clientResponded ?? false;

    const row = await this.prisma.$transaction(async (tx) => {
      const vehicle = await this.resolveVehicle(tx, garageAccountId, dto);
      const garage = await tx.garageAccount.update({
        where: { id: garageAccountId },
        data: { pcoNextSeq: { increment: 1 } },
        select: { pcoNextSeq: true },
      });
      const year = new Date().getFullYear();
      const bookingNumber = `PCO-${year}-${String(garage.pcoNextSeq).padStart(5, "0")}`;

      return tx.pcoBooking.create({
        data: {
          garageAccountId,
          pcoVehicleId: vehicle.id,
          bookingNumber,
          jobType: dto.jobType,
          jobDetails: dto.jobDetails?.trim() || null,
          priority: dto.priority ?? "MEDIUM",
          chargeGross: roundMoney(dto.chargeGross ?? 0),
          bookingDate: dto.bookingDate ? this.parseDate(dto.bookingDate) : null,
          bookingTime: dto.bookingTime ?? null,
          bookingCentreId: dto.bookingCentreId ?? null,
          clientInformed: informed,
          clientResponded: responded,
          clientInformedAt: informed ? now : null,
          clientRespondedAt: responded ? now : null,
          bookingPaymentMethod: dto.bookingPaymentMethod ?? null,
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
    if (existing.status !== PcoBookingStatus.ACTIVE) {
      throw new BadRequestException("Only active bookings can be edited");
    }

    const now = new Date();
    const bookingData: Prisma.PcoBookingUpdateInput = {};

    if (dto.jobType !== undefined) bookingData.jobType = dto.jobType;
    if (dto.jobDetails !== undefined) bookingData.jobDetails = dto.jobDetails?.trim() || null;
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
    if (dto.bookingPaymentMethod !== undefined) {
      bookingData.bookingPaymentMethod = dto.bookingPaymentMethod;
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

  async cancelBooking(user: RequestUser, id: string) {
    const garageAccountId = this.garageId(user);
    const existing = await this.prisma.pcoBooking.findFirst({
      where: { id, garageAccountId },
    });
    if (!existing) throw new NotFoundException("PCO booking not found");
    if (existing.status !== PcoBookingStatus.ACTIVE) {
      throw new BadRequestException("Only active bookings can be cancelled");
    }

    await this.prisma.pcoBooking.update({
      where: { id },
      data: { status: PcoBookingStatus.CANCELLED },
    });

    return this.getBooking(user, id);
  }
}
