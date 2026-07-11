import type { PaymentMethod } from "./invoice-types";

/** PCO booking job type — garage service category for this appointment. */
export type PcoJobType =
  | "RENEWAL"
  | "NEW"
  | "ADMIN"
  | "LOGBOOK_EXPIRING"
  | "RETEST"
  | "RESCHEDULE";

export const PCO_JOB_TYPE_LABEL: Record<PcoJobType, string> = {
  RENEWAL: "Renewal",
  NEW: "New",
  ADMIN: "Admin",
  LOGBOOK_EXPIRING: "Logbook expiring",
  RETEST: "Retest",
  RESCHEDULE: "Reschedule",
};

export const PCO_JOB_TYPES: PcoJobType[] = [
  "RENEWAL",
  "NEW",
  "ADMIN",
  "LOGBOOK_EXPIRING",
  "RETEST",
  "RESCHEDULE",
];

/** TfL / centre booking slot fee (Add booking details only — not the customer service charge). */
export const PCO_DEFAULT_BOOKING_CHARGE = 140;

/** Who pays the TfL / centre booking slot fee (Add booking details only). */
export type PcoBookingSlotPaidBy = "US" | "CUSTOMER" | "NA" | "TFL_CREDIT";

export const PCO_BOOKING_SLOT_PAID_BY_LABEL: Record<PcoBookingSlotPaidBy, string> = {
  US: "Us",
  CUSTOMER: "Customer",
  NA: "N/A",
  TFL_CREDIT: "TfL credit",
};

export const PCO_BOOKING_SLOT_PAID_BY_OPTIONS: PcoBookingSlotPaidBy[] = [
  "US",
  "CUSTOMER",
  "NA",
  "TFL_CREDIT",
];

export type PcoSlotFeeDisposition = "NOT_APPLICABLE" | "RETAINED" | "REFUND_REQUESTED";

export const PCO_SLOT_FEE_DISPOSITION_LABEL: Record<
  Exclude<PcoSlotFeeDisposition, "NOT_APPLICABLE">,
  string
> = {
  RETAINED: "Keep fee for future booking (TfL credit)",
  REFUND_REQUESTED: "Refund requested",
};

export type PcoSlotCreditStatus = "NOT_APPLICABLE" | "AVAILABLE" | "APPLIED";

export type PcoSlotCreditDto = {
  bookingId: string;
  bookingNumber: string;
  vrm: string;
  amountGross: string;
  cancellationNote: string | null;
  cancelledAt: string;
};

export type PcoBookingStatus = "PENDING" | "ACTIVE" | "COMPLETED" | "CANCELLED";

export const PCO_BOOKING_STATUS_LABEL: Record<PcoBookingStatus, string> = {
  PENDING: "To book",
  ACTIVE: "Booked",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export const PCO_FUEL_TYPES = ["Petrol", "Diesel", "Electric", "Hybrid", "Other"] as const;
export type PcoFuelType = (typeof PCO_FUEL_TYPES)[number];

export type PcoPriority = "LOW" | "MEDIUM" | "HIGH";

export const PCO_PRIORITY_LABEL: Record<PcoPriority, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
};

const PCO_PRIORITY_SORT: Record<PcoPriority, number> = {
  HIGH: 0,
  MEDIUM: 1,
  LOW: 2,
};

/** Sort pending bookings — high priority first. */
export function sortPcoBookingsByPriority<T extends { priority: PcoPriority }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => PCO_PRIORITY_SORT[a.priority] - PCO_PRIORITY_SORT[b.priority]);
}

/** Days before expiry to show on renewals / V5C due tabs. */
export const PCO_DUE_SOON_DAYS = 28;

/** Logbook validity from date of first registration (UK). */
export const PCO_LOGBOOK_YEARS = 10;

/** PCO licence renewal period after a completed booking. */
export const PCO_RENEWAL_YEARS = 1;

/** Parse YYYY-MM-DD as UTC date parts (calendar arithmetic, no TZ drift). */
function parseIsoDate(iso: string): { y: number; m: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return null;
  return { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) };
}

function formatIsoDate(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Add whole calendar years to an ISO date (YYYY-MM-DD). */
export function addYearsToIsoDate(iso: string, years: number): string | null {
  const parts = parseIsoDate(iso);
  if (!parts) return null;
  return formatIsoDate(parts.y + years, parts.m, parts.d);
}

/** Logbook expiry = first registration + 10 years. */
export function calculateLogbookExpiryFromFirstRegistration(firstRegistrationIso: string): string | null {
  return addYearsToIsoDate(firstRegistrationIso, PCO_LOGBOOK_YEARS);
}

/**
 * Next PCO expiry after a completed booking — +1 year from the **previous** expiry,
 * not from the completion date.
 */
export function calculateNextPcoExpiry(previousExpiryIso: string): string | null {
  return addYearsToIsoDate(previousExpiryIso, PCO_RENEWAL_YEARS);
}

/** True when `iso` falls within the next `withinDays` calendar days (inclusive of today). */
export function isIsoDateDueWithinDays(iso: string, withinDays: number, today = new Date()): boolean {
  const parts = parseIsoDate(iso);
  if (!parts) return false;
  const target = Date.UTC(parts.y, parts.m - 1, parts.d);
  const start = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const end = start + withinDays * 86_400_000;
  return target >= start && target <= end;
}

export type PcoVehicleStatus = "ACTIVE" | "ARCHIVED";

export type PcoCentreDto = {
  id: string;
  label: string;
  value: string;
  sortOrder: number;
};

export type PcoVehicleDto = {
  id: string;
  vrm: string;
  registeredKeeper: string;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  postcode: string | null;
  email: string | null;
  phone: string | null;
  make: string | null;
  model: string | null;
  color: string | null;
  fuelType: string | null;
  seatCount: number | null;
  firstRegistrationDate: string;
  pcoExpiryDate: string;
  logbookExpiryDate: string;
  note: string | null;
  status: PcoVehicleStatus;
  customerId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PcoBookingPaymentDto = {
  id: string;
  amount: string;
  method: string;
  valueDate: string;
  paymentAccountId: string;
  paymentAccountName: string;
  createdAt: string;
};

export type PcoBookingDto = {
  id: string;
  bookingNumber: string;
  status: PcoBookingStatus;
  jobType: PcoJobType;
  jobDetails: string | null;
  priority: PcoPriority;
  chargeGross: string;
  amountPaid: string;
  balanceDue: string;
  bookingDate: string | null;
  bookingTime: string | null;
  bookingCentreId: string | null;
  bookingCentreName: string | null;
  clientInformed: boolean;
  clientResponded: boolean;
  clientInformedAt: string | null;
  clientRespondedAt: string | null;
  slotPaidBy: PcoBookingSlotPaidBy | null;
  slotPaymentAccountId: string | null;
  slotPaymentAccountName: string | null;
  slotChargeGross: string | null;
  slotCreditSourceBookingId: string | null;
  slotCreditSourceBookingNumber: string | null;
  slotFeeDisposition: PcoSlotFeeDisposition | null;
  slotCreditStatus: PcoSlotCreditStatus;
  cancellationNote: string | null;
  cancelledAt: string | null;
  rescheduledFromBookingId: string | null;
  rescheduledFromBookingNumber: string | null;
  rescheduledToBookingId: string | null;
  rescheduledToBookingNumber: string | null;
  notes: string | null;
  vehicle: PcoVehicleDto;
  payments: PcoBookingPaymentDto[];
  createdById: string;
  createdByName: string | null;
  completedAt: string | null;
  completedByName: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PcoCancelAndRescheduleResultDto = {
  cancelled: PcoBookingDto;
  newBooking: PcoBookingDto;
};

export type PcoBookingListDto = {
  id: string;
  bookingNumber: string;
  status: PcoBookingStatus;
  jobType: PcoJobType;
  priority: PcoPriority;
  chargeGross: string;
  amountPaid: string;
  balanceDue: string;
  bookingDate: string | null;
  bookingTime: string | null;
  bookingCentreName: string | null;
  clientInformed: boolean;
  clientResponded: boolean;
  vrm: string;
  registeredKeeper: string;
  email: string | null;
  phone: string | null;
  addressLine1: string | null;
  city: string | null;
  postcode: string | null;
  make: string | null;
  model: string | null;
  color: string | null;
  fuelType: string | null;
  seatCount: number | null;
  firstRegistrationDate: string;
  pcoExpiryDate: string;
  logbookExpiryDate: string;
  notes: string | null;
  createdAt: string;
};

export type PcoDueVehicleDto = {
  vehicleId: string;
  vrm: string;
  registeredKeeper: string;
  email: string | null;
  phone: string | null;
  addressLine1: string | null;
  city: string | null;
  postcode: string | null;
  make: string | null;
  model: string | null;
  color: string | null;
  fuelType: string | null;
  seatCount: number | null;
  pcoExpiryDate: string | null;
  logbookExpiryDate: string;
  firstRegistrationDate: string;
  daysUntilDue: number;
  lastChargeGross: string | null;
  lastBookingNumber: string | null;
};

export type PcoActiveBookingSnapshotDto = {
  id: string;
  bookingNumber: string;
  bookingDate: string | null;
  bookingTime: string | null;
  bookingCentreId: string | null;
  bookingCentreName: string | null;
  slotPaidBy: PcoBookingSlotPaidBy | null;
  chargeGross: string;
};

export type PcoOpenBookingSnapshotDto = {
  id: string;
  bookingNumber: string;
  status: PcoBookingStatus;
  jobType: PcoJobType;
};

export type PcoVrmLookupDto = {
  activeVehicle: PcoVehicleDto | null;
  /** Vehicle details from the most recent completed booking for this VRM. */
  lastCompletedVehicle: PcoVehicleDto | null;
  /** Current booked appointment for this VRM, if any. */
  activeBooking: PcoActiveBookingSnapshotDto | null;
  /** Open PENDING or ACTIVE booking for this VRM — at most one should exist. */
  openBooking: PcoOpenBookingSnapshotDto | null;
  previousCharges: { bookingNumber: string; jobType: PcoJobType; chargeGross: string; completedAt: string | null }[];
};

export type PcoBookingTab =
  | "active"
  | "pending"
  | "past"
  | "v5c_expiring"
  | "renewals_due";
