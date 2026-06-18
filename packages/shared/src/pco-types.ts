/** PCO booking job type — garage service category for this appointment. */
export type PcoJobType =
  | "RENEWAL"
  | "NEW"
  | "ADMIN"
  | "LOGBOOK_EXPIRING"
  | "RETEST";

export const PCO_JOB_TYPE_LABEL: Record<PcoJobType, string> = {
  RENEWAL: "Renewal",
  NEW: "New",
  ADMIN: "Admin",
  LOGBOOK_EXPIRING: "Logbook expiring",
  RETEST: "Retest",
};

export const PCO_JOB_TYPES: PcoJobType[] = [
  "RENEWAL",
  "NEW",
  "ADMIN",
  "LOGBOOK_EXPIRING",
  "RETEST",
];

export type PcoBookingStatus = "ACTIVE" | "COMPLETED" | "CANCELLED";

export const PCO_BOOKING_STATUS_LABEL: Record<PcoBookingStatus, string> = {
  ACTIVE: "Active",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export type PcoPriority = "LOW" | "MEDIUM" | "HIGH";

export const PCO_PRIORITY_LABEL: Record<PcoPriority, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
};

/** Days before expiry to show on renewals / logbook due tabs. */
export const PCO_DUE_SOON_DAYS = 30;

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
  bookingPaymentMethod: string | null;
  vehicle: PcoVehicleDto;
  payments: PcoBookingPaymentDto[];
  createdById: string;
  createdByName: string | null;
  completedAt: string | null;
  completedByName: string | null;
  createdAt: string;
  updatedAt: string;
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
  firstRegistrationDate: string;
  pcoExpiryDate: string;
  logbookExpiryDate: string;
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
  pcoExpiryDate: string | null;
  logbookExpiryDate: string;
  firstRegistrationDate: string;
  daysUntilDue: number;
  lastChargeGross: string | null;
  lastBookingNumber: string | null;
};

export type PcoVrmLookupDto = {
  activeVehicle: PcoVehicleDto | null;
  previousCharges: { bookingNumber: string; jobType: PcoJobType; chargeGross: string; completedAt: string | null }[];
};

export type PcoBookingTab = "active" | "past" | "renewals_due" | "logbook_due";
