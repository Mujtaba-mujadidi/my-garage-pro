import type {
  PcoBooking,
  PcoBookingPayment,
  PcoVehicle,
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
  PcoVehicleDto,
} from "@mygaragepro/shared";
import {
  PCO_BOOKING_STATUS_LABEL,
  PCO_DUE_SOON_DAYS,
  PCO_JOB_TYPE_LABEL,
  PCO_PRIORITY_LABEL,
} from "@mygaragepro/shared";

function dec(v: { toString(): string }) {
  return v.toString();
}

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function toPcoVehicleDto(row: PcoVehicle): PcoVehicleDto {
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
    make: row.make,
    model: row.model,
    color: row.color,
    fuelType: row.fuelType,
    seatCount: row.seatCount,
    firstRegistrationDate: isoDate(row.firstRegistrationDate),
    pcoExpiryDate: isoDate(row.pcoExpiryDate),
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
};

export function toPcoPaymentDto(row: PaymentWithAccount): PcoBookingPaymentDto {
  return {
    id: row.id,
    amount: dec(row.amount),
    method: row.method,
    valueDate: isoDate(row.valueDate),
    paymentAccountId: row.paymentAccountId,
    paymentAccountName: row.paymentAccount.name,
    createdAt: row.createdAt.toISOString(),
  };
}

type BookingRow = PcoBooking & {
  vehicle: PcoVehicle;
  bookingCentre: Pick<SettingOption, "label"> | null;
  payments: PaymentWithAccount[];
  createdBy: Pick<User, "displayName">;
  completedBy: Pick<User, "displayName"> | null;
};

export function toPcoBookingDto(row: BookingRow): PcoBookingDto {
  const paid = Number(row.amountPaid);
  const charge = Number(row.chargeGross);
  const balanceDue = Math.max(0, Math.round((charge - paid) * 100) / 100);
  return {
    id: row.id,
    bookingNumber: row.bookingNumber,
    status: row.status,
    jobType: row.jobType,
    jobDetails: row.jobDetails,
    priority: row.priority,
    chargeGross: dec(row.chargeGross),
    amountPaid: dec(row.amountPaid),
    balanceDue: balanceDue.toFixed(2),
    bookingDate: row.bookingDate ? isoDate(row.bookingDate) : null,
    bookingTime: row.bookingTime,
    bookingCentreId: row.bookingCentreId,
    bookingCentreName: row.bookingCentre?.label ?? null,
    clientInformed: row.clientInformed,
    clientResponded: row.clientResponded,
    clientInformedAt: row.clientInformedAt?.toISOString() ?? null,
    clientRespondedAt: row.clientRespondedAt?.toISOString() ?? null,
    bookingPaymentMethod: row.bookingPaymentMethod,
    vehicle: toPcoVehicleDto(row.vehicle),
    payments: row.payments.map(toPcoPaymentDto),
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
};

export function toPcoBookingListDto(row: ListRow): PcoBookingListDto {
  const paid = Number(row.amountPaid);
  const charge = Number(row.chargeGross);
  const balanceDue = Math.max(0, Math.round((charge - paid) * 100) / 100);
  return {
    id: row.id,
    bookingNumber: row.bookingNumber,
    status: row.status,
    jobType: row.jobType,
    priority: row.priority,
    chargeGross: dec(row.chargeGross),
    amountPaid: dec(row.amountPaid),
    balanceDue: balanceDue.toFixed(2),
    bookingDate: row.bookingDate ? isoDate(row.bookingDate) : null,
    bookingTime: row.bookingTime,
    bookingCentreName: row.bookingCentre?.label ?? null,
    clientInformed: row.clientInformed,
    clientResponded: row.clientResponded,
    vrm: row.vehicle.vrm,
    registeredKeeper: row.vehicle.registeredKeeper,
    email: row.vehicle.email,
    phone: row.vehicle.phone,
    addressLine1: row.vehicle.addressLine1,
    city: row.vehicle.city,
    postcode: row.vehicle.postcode,
    make: row.vehicle.make,
    model: row.vehicle.model,
    color: row.vehicle.color,
    fuelType: row.vehicle.fuelType,
    seatCount: row.vehicle.seatCount,
    firstRegistrationDate: isoDate(row.vehicle.firstRegistrationDate),
    pcoExpiryDate: isoDate(row.vehicle.pcoExpiryDate),
    logbookExpiryDate: isoDate(row.vehicle.logbookExpiryDate),
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

export { PCO_BOOKING_STATUS_LABEL, PCO_JOB_TYPE_LABEL, PCO_PRIORITY_LABEL, PCO_DUE_SOON_DAYS };
