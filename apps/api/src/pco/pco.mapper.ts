import type {
  PcoBooking,
  PcoBookingPayment,
  PcoVehicle,
  LedgerEntry,
  PaymentAccount,
  SettingOption,
  User,
} from "@prisma/client";
import type {
  PcoBookingDto,
  PcoBookingListDto,
  PcoBookingPaymentDto,
  PcoCentreDto,
  PcoDueVehicleDto,
  PcoGarageExpenseDto,
  PcoSlotCreditDto,
  PcoVehicleDto,
} from "@mygaragepro/shared";
import {
  PCO_BOOKING_STATUS_LABEL,
  PCO_DUE_SOON_DAYS,
  PCO_DEFAULT_BOOKING_CHARGE,
  PCO_JOB_TYPE_LABEL,
  PCO_PRIORITY_LABEL,
  daysUntilRetestDeadline,
  pcoBalanceDue,
  pcoCustomerTotalDue,
  retestDeadlineIso,
} from "@mygaragepro/shared";
import { decryptField } from "../common/field-encryption";

function dec(v: { toString(): string }) {
  return v.toString();
}

function preferredCentreIdsFromJson(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((id): id is string => typeof id === "string" && id.length > 0);
}

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function toPcoVehicleDto(
  row: PcoVehicle,
  opts?: { revealTflPassword?: boolean },
): PcoVehicleDto {
  const hasTflLoginPassword = Boolean(row.tflLoginPasswordEnc);
  let tflLoginPassword: string | null | undefined;
  if (opts?.revealTflPassword) {
    tflLoginPassword = null;
    if (row.tflLoginPasswordEnc) {
      try {
        tflLoginPassword = decryptField(row.tflLoginPasswordEnc);
      } catch {
        tflLoginPassword = null;
      }
    }
  }
  return {
    id: row.id,
    vrm: row.vrm,
    registeredKeeper: row.registeredKeeper,
    addressLine1: row.addressLine1,
    addressLine2: row.addressLine2,
    city: row.city,
    postcode: row.postcode,
    email: row.email,
    phone: row.phone,
    pcoAccountPhone: row.pcoAccountPhone,
    tflLoginEmail: row.tflLoginEmail,
    hasTflLoginPassword,
    ...(opts?.revealTflPassword ? { tflLoginPassword } : {}),
    make: row.make,
    model: row.model,
    color: row.color,
    fuelType: row.fuelType,
    seatCount: row.seatCount,
    firstRegistrationDate: isoDate(row.firstRegistrationDate),
    pcoExpiryDate: row.pcoExpiryDate ? isoDate(row.pcoExpiryDate) : null,
    logbookExpiryDate: isoDate(row.logbookExpiryDate),
    note: row.note,
    status: row.status,
    customerId: row.customerId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toPcoCentreDto(row: SettingOption): PcoCentreDto {
  return {
    id: row.id,
    label: row.label,
    value: row.value,
    sortOrder: row.sortOrder,
  };
}

type PaymentWithAccount = PcoBookingPayment & {
  paymentAccount: Pick<PaymentAccount, "name">;
  createdBy: Pick<User, "displayName">;
};

export function toPcoPaymentDto(row: PaymentWithAccount): PcoBookingPaymentDto {
  return {
    id: row.id,
    amount: dec(row.amount),
    method: row.method,
    valueDate: isoDate(row.valueDate),
    paymentAccountId: row.paymentAccountId,
    paymentAccountName: row.paymentAccount.name,
    createdByName: row.createdBy.displayName,
    createdAt: row.createdAt.toISOString(),
  };
}

type ExpenseWithAccount = LedgerEntry & {
  paymentAccount: Pick<PaymentAccount, "name">;
  createdBy: Pick<User, "displayName">;
};

export function toPcoGarageExpenseDto(row: ExpenseWithAccount): PcoGarageExpenseDto {
  return {
    id: row.id,
    amount: dec(row.amountGross),
    valueDate: isoDate(row.valueDate),
    paymentAccountId: row.paymentAccountId,
    paymentAccountName: row.paymentAccount.name,
    paymentMethod: row.paymentMethod,
    category: row.category,
    notes: row.notes,
    createdByName: row.createdBy.displayName,
    createdAt: row.createdAt.toISOString(),
  };
}

type BookingRow = PcoBooking & {
  vehicle: PcoVehicle;
  bookingCentre: Pick<SettingOption, "label"> | null;
  slotPaymentAccount: Pick<PaymentAccount, "name"> | null;
  slotCreditSourceBooking: Pick<PcoBooking, "bookingNumber"> | null;
  rescheduledFromBooking: Pick<PcoBooking, "bookingNumber"> | null;
  rescheduledToBooking: Pick<PcoBooking, "bookingNumber"> | null;
  retestBooking: Pick<PcoBooking, "bookingNumber"> | null;
  payments: PaymentWithAccount[];
  ledgerEntries: ExpenseWithAccount[];
  createdBy: Pick<User, "displayName">;
  completedBy: Pick<User, "displayName"> | null;
};

export function toPcoBookingDto(row: BookingRow): PcoBookingDto {
  const totals = {
    chargeGross: row.chargeGross,
    amountPaid: row.amountPaid,
    slotPaidBy: row.slotPaidBy,
    slotChargeGross: row.slotChargeGross,
  };
  return {
    id: row.id,
    bookingNumber: row.bookingNumber,
    status: row.status,
    jobType: row.jobType,
    jobDetails: row.jobDetails,
    priority: row.priority,
    chargeGross: dec(row.chargeGross),
    totalDue: pcoCustomerTotalDue(totals).toFixed(2),
    amountPaid: dec(row.amountPaid),
    balanceDue: pcoBalanceDue(totals).toFixed(2),
    bookingDate: row.bookingDate ? isoDate(row.bookingDate) : null,
    bookingTime: row.bookingTime,
    bookingCentreId: row.bookingCentreId,
    bookingCentreName: row.bookingCentre?.label ?? null,
    preferredCentreAny: row.preferredCentreAny,
    preferredCentreIds: preferredCentreIdsFromJson(row.preferredCentreIds),
    bookingReference: row.bookingReference,
    clientInformed: row.clientInformed,
    clientResponded: row.clientResponded,
    clientInformedAt: row.clientInformedAt?.toISOString() ?? null,
    clientRespondedAt: row.clientRespondedAt?.toISOString() ?? null,
    slotPaidBy: row.slotPaidBy,
    slotPaymentAccountId: row.slotPaymentAccountId,
    slotPaymentAccountName: row.slotPaymentAccount?.name ?? null,
    slotChargeGross: row.slotChargeGross != null ? dec(row.slotChargeGross) : null,
    slotCreditSourceBookingId: row.slotCreditSourceBookingId,
    slotCreditSourceBookingNumber: row.slotCreditSourceBooking?.bookingNumber ?? null,
    slotFeeDisposition: row.slotFeeDisposition,
    slotCreditStatus: row.slotCreditStatus,
    cancellationNote: row.cancellationNote,
    cancelledAt: row.cancelledAt?.toISOString() ?? null,
    rescheduledFromBookingId: row.rescheduledFromBookingId,
    rescheduledFromBookingNumber: row.rescheduledFromBooking?.bookingNumber ?? null,
    rescheduledToBookingId: row.rescheduledToBookingId,
    rescheduledToBookingNumber: row.rescheduledToBooking?.bookingNumber ?? null,
    failureReason: row.failureReason,
    failedAt: row.failedAt?.toISOString() ?? null,
    retestDeadline: row.failedAt ? retestDeadlineIso(row.failedAt.toISOString()) : null,
    daysUntilRetestDeadline: row.failedAt
      ? daysUntilRetestDeadline(row.failedAt.toISOString())
      : null,
    retestBookingId: row.retestBookingId,
    retestBookingNumber: row.retestBooking?.bookingNumber ?? null,
    retestChargeReference: row.retestChargeReference,
    notes: row.notes,
    vehicle: toPcoVehicleDto(row.vehicle, { revealTflPassword: true }),
    payments: row.payments.map(toPcoPaymentDto),
    garageExpenses: row.ledgerEntries.map(toPcoGarageExpenseDto),
    createdById: row.createdById,
    createdByName: row.createdBy.displayName,
    completedAt: row.completedAt?.toISOString() ?? null,
    completedByName: row.completedBy?.displayName ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

type ListRow = PcoBooking & {
  vehicle: PcoVehicle;
  bookingCentre: Pick<SettingOption, "label"> | null;
  retestBooking?: Pick<PcoBooking, "bookingNumber"> | null;
};

export function toPcoBookingListDto(row: ListRow): PcoBookingListDto {
  const totals = {
    chargeGross: row.chargeGross,
    amountPaid: row.amountPaid,
    slotPaidBy: row.slotPaidBy,
    slotChargeGross: row.slotChargeGross,
  };
  return {
    id: row.id,
    bookingNumber: row.bookingNumber,
    status: row.status,
    jobType: row.jobType,
    priority: row.priority,
    chargeGross: dec(row.chargeGross),
    totalDue: pcoCustomerTotalDue(totals).toFixed(2),
    amountPaid: dec(row.amountPaid),
    balanceDue: pcoBalanceDue(totals).toFixed(2),
    bookingDate: row.bookingDate ? isoDate(row.bookingDate) : null,
    bookingTime: row.bookingTime,
    bookingCentreName: row.bookingCentre?.label ?? null,
    preferredCentreAny: row.preferredCentreAny,
    preferredCentreIds: preferredCentreIdsFromJson(row.preferredCentreIds),
    bookingReference: row.bookingReference,
    clientInformed: row.clientInformed,
    clientResponded: row.clientResponded,
    vrm: row.vehicle.vrm,
    registeredKeeper: row.vehicle.registeredKeeper,
    email: row.vehicle.email,
    phone: row.vehicle.phone,
    pcoAccountPhone: row.vehicle.pcoAccountPhone,
    addressLine1: row.vehicle.addressLine1,
    city: row.vehicle.city,
    postcode: row.vehicle.postcode,
    make: row.vehicle.make,
    model: row.vehicle.model,
    color: row.vehicle.color,
    fuelType: row.vehicle.fuelType,
    seatCount: row.vehicle.seatCount,
    firstRegistrationDate: isoDate(row.vehicle.firstRegistrationDate),
    pcoExpiryDate: row.vehicle.pcoExpiryDate ? isoDate(row.vehicle.pcoExpiryDate) : null,
    logbookExpiryDate: isoDate(row.vehicle.logbookExpiryDate),
    notes: row.notes,
    failureReason: row.failureReason,
    failedAt: row.failedAt?.toISOString() ?? null,
    retestDeadline: row.failedAt ? retestDeadlineIso(row.failedAt.toISOString()) : null,
    daysUntilRetestDeadline: row.failedAt
      ? daysUntilRetestDeadline(row.failedAt.toISOString())
      : null,
    retestBookingId: row.retestBookingId,
    retestBookingNumber: row.retestBooking?.bookingNumber ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

export function toPcoDueVehicleDto(
  vehicle: PcoVehicle,
  dueDate: Date,
  lastBooking?: Pick<PcoBooking, "bookingNumber" | "chargeGross"> | null,
): PcoDueVehicleDto {
  const today = new Date();
  const start = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const target = Date.UTC(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
  const daysUntilDue = Math.round((target - start) / 86_400_000);
  return {
    vehicleId: vehicle.id,
    vrm: vehicle.vrm,
    registeredKeeper: vehicle.registeredKeeper,
    email: vehicle.email,
    phone: vehicle.phone,
    pcoAccountPhone: vehicle.pcoAccountPhone,
    addressLine1: vehicle.addressLine1,
    city: vehicle.city,
    postcode: vehicle.postcode,
    make: vehicle.make,
    model: vehicle.model,
    color: vehicle.color,
    fuelType: vehicle.fuelType,
    seatCount: vehicle.seatCount,
    pcoExpiryDate: vehicle.pcoExpiryDate ? isoDate(vehicle.pcoExpiryDate) : null,
    logbookExpiryDate: isoDate(vehicle.logbookExpiryDate),
    firstRegistrationDate: isoDate(vehicle.firstRegistrationDate),
    daysUntilDue,
    lastChargeGross: lastBooking ? dec(lastBooking.chargeGross) : null,
    lastBookingNumber: lastBooking?.bookingNumber ?? null,
  };
}

export function toPcoSlotCreditDto(
  row: PcoBooking & { vehicle: Pick<PcoVehicle, "vrm"> },
): PcoSlotCreditDto {
  const amount =
    row.slotChargeGross != null ? dec(row.slotChargeGross) : String(PCO_DEFAULT_BOOKING_CHARGE);
  return {
    bookingId: row.id,
    bookingNumber: row.bookingNumber,
    vrm: row.vehicle.vrm,
    amountGross: amount,
    cancellationNote: row.cancellationNote,
    cancelledAt: row.cancelledAt?.toISOString() ?? row.updatedAt.toISOString(),
  };
}

export { PCO_BOOKING_STATUS_LABEL, PCO_JOB_TYPE_LABEL, PCO_PRIORITY_LABEL, PCO_DUE_SOON_DAYS };
