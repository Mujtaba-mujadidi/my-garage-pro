"use client";

import { UkNumberPlate } from "@/components/jobs/uk-number-plate";
import { useSession } from "@/components/providers/session-provider";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Modal } from "@/components/ui/modal";
import { SearchableTable, type TableColumn } from "@/components/ui/searchable-table";
import { Select } from "@/components/ui/select";
import { TabBar } from "@/components/ui/tab-bar";
import { TableRowActionsMenu } from "@/components/ui/table-row-actions-menu";
import { apiFetch, ApiError } from "@/lib/api-client";
import { formatRegistrationDisplay, normalizeRegistration } from "@/lib/vehicle-registration";
import type {
  PaymentAccountDto,
  PaymentMethod,
  PcoBookingDto,
  PcoBookingListDto,
  PcoBookingTab,
  PcoCentreDto,
  PcoDueVehicleDto,
  PcoJobType,
  PcoPriority,
  PcoSlotCreditDto,
  PcoSlotFeeDisposition,
  PcoVehicleDto,
  PcoVrmLookupDto,
} from "@mygaragepro/shared";
import {
  PCO_JOB_TYPE_LABEL,
  PCO_JOB_TYPES,
  PCO_PRIORITY_LABEL,
  PCO_BOOKING_STATUS_LABEL,
  PCO_BOOKING_SLOT_PAID_BY_LABEL,
  PCO_BOOKING_SLOT_PAID_BY_OPTIONS,
  PCO_DEFAULT_BOOKING_CHARGE,
  PCO_FUEL_TYPES,
  PCO_SLOT_FEE_DISPOSITION_LABEL,
  calculateLogbookExpiryFromFirstRegistration,
  calculateNextPcoExpiry,
  defaultPaymentMethodForAccount,
  type PcoBookingSlotPaidBy,
} from "@mygaragepro/shared";
import { FormEvent, ReactNode, useCallback, useEffect, useMemo, useState } from "react";

const inputClass =
  "w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm";

const PAYMENT_METHOD_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: "BANK_TRANSFER", label: "Bank transfer" },
  { value: "CARD", label: "Card" },
  { value: "CASH", label: "Cash" },
  { value: "CHEQUE", label: "Cheque" },
  { value: "OTHER", label: "Other" },
];

type TabId = PcoBookingTab | "settings";

function formatGbp(n: number | string) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(Number(n));
}

function todayIso() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Earliest selectable booking date — tomorrow (future appointments only). */
function minBookingDateIso() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatMonthLabel(year: number, monthIndex: number) {
  return new Date(year, monthIndex, 1).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  });
}

function toIsoDate(year: number, monthIndex: number, day: number) {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Monday-first calendar cells for a month (null = padding). */
function buildMonthCells(year: number, monthIndex: number): (number | null)[] {
  const first = new Date(year, monthIndex, 1);
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const mondayBased = (first.getDay() + 6) % 7;
  const cells: (number | null)[] = Array.from({ length: mondayBased }, () => null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function VrmText({ vrm }: { vrm: string }) {
  return (
    <span className="font-mono text-sm font-bold tracking-wide">
      {formatRegistrationDisplay(vrm)}
    </span>
  );
}

function KeeperCell({
  name,
  email,
  phone,
  addressLine1,
  city,
  postcode,
}: {
  name: string;
  email?: string | null;
  phone?: string | null;
  addressLine1?: string | null;
  city?: string | null;
  postcode?: string | null;
}) {
  const address = [addressLine1, city, postcode].filter(Boolean).join(", ");
  return (
    <div className="min-w-[10rem]">
      <p className="font-medium">{name}</p>
      {phone && <p className="text-xs text-[var(--muted)]">{phone}</p>}
      {email && <p className="text-xs text-[var(--muted)]">{email}</p>}
      {address && <p className="text-xs text-[var(--muted)]">{address}</p>}
    </div>
  );
}

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="border-b border-[var(--border)] py-2.5 last:border-0">
      <dt className="text-sm text-[var(--muted)]">{label}</dt>
      <dd className="mt-0.5 text-sm text-[var(--foreground)]">{children}</dd>
    </div>
  );
}

function formatKeeperAddress(v: {
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  postcode?: string | null;
}) {
  return [v.addressLine1, v.addressLine2, v.city, v.postcode].filter(Boolean).join(", ") || "—";
}

function formatTableAddress(r: {
  addressLine1?: string | null;
  city?: string | null;
  postcode?: string | null;
}) {
  return [r.addressLine1, r.city, r.postcode].filter(Boolean).join(", ") || "—";
}

function formatTableContact(
  email?: string | null,
  phone?: string | null,
  pcoAccountPhone?: string | null,
) {
  if (!email && !phone && !pcoAccountPhone) return "—";
  return (
    <div className="text-sm leading-snug">
      {email && <p className="truncate max-w-[12rem]">{email}</p>}
      {phone && (
        <p className={email ? "text-xs text-[var(--muted)]" : ""}>Client: {phone}</p>
      )}
      {pcoAccountPhone && (
        <p className="text-xs text-[var(--muted)]">PCO: {pcoAccountPhone}</p>
      )}
    </div>
  );
}

const PRIORITY_INLINE_SELECT_CLASS: Record<PcoPriority, string> = {
  HIGH: "font-semibold text-red-700 dark:text-red-400",
  MEDIUM: "text-amber-700 dark:text-amber-400",
  LOW: "text-[var(--muted)]",
};

const tableInlineSelectClass =
  "w-full min-w-[5.5rem] rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-xs focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/25 disabled:opacity-50";

function FieldSpinner({ label }: { label: string }) {
  return (
    <span
      className="pointer-events-none absolute right-2.5 top-2.5 flex h-4 w-4 items-center justify-center"
      role="status"
      aria-label={label}
    >
      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[var(--muted)] border-t-accent" />
    </span>
  );
}

function lastCustomerChargeFromLookup(data: PcoVrmLookupDto): string {
  return data.previousCharges[0]?.chargeGross ?? "";
}

function emptyDraft() {
  return {
    vrm: "",
    registeredKeeper: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    postcode: "",
    email: "",
    phone: "",
    pcoAccountPhone: "",
    firstRegistrationDate: "",
    pcoExpiryDate: "",
    logbookExpiryDate: "",
    note: "",
    make: "",
    model: "",
    color: "",
    fuelType: "",
    seatCount: "",
    jobType: "RENEWAL" as PcoJobType,
    jobDetails: "",
    notes: "",
    priority: "MEDIUM" as PcoPriority,
    chargeGross: "",
    clientInformed: false,
    clientResponded: false,
  };
}

function emptyScheduleDraft() {
  return {
    bookingDate: "",
    bookingTime: "",
    bookingCentreId: "",
    slotPaidBy: "US" as PcoBookingSlotPaidBy,
    slotPaymentAccountId: "",
    slotChargeGross: String(PCO_DEFAULT_BOOKING_CHARGE),
    slotCreditSourceBookingId: "",
  };
}

function bookingHadActiveSlotFee(booking: Pick<PcoBookingDto, "status" | "slotPaidBy">) {
  return (
    booking.status === "ACTIVE" &&
    (booking.slotPaidBy === "US" || booking.slotPaidBy === "CUSTOMER")
  );
}

function vehicleToDraft(v: PcoVehicleDto): Partial<ReturnType<typeof emptyDraft>> {
  return {
    registeredKeeper: v.registeredKeeper,
    addressLine1: v.addressLine1 ?? "",
    addressLine2: v.addressLine2 ?? "",
    city: v.city ?? "",
    postcode: v.postcode ?? "",
    email: v.email ?? "",
    phone: v.phone ?? "",
    pcoAccountPhone: v.pcoAccountPhone ?? "",
    firstRegistrationDate: v.firstRegistrationDate,
    pcoExpiryDate: v.pcoExpiryDate,
    logbookExpiryDate: v.logbookExpiryDate,
    note: v.note ?? "",
    make: v.make ?? "",
    model: v.model ?? "",
    color: v.color ?? "",
    fuelType: v.fuelType ?? "",
    seatCount: v.seatCount != null ? String(v.seatCount) : "",
  };
}

function dueVehicleToDraft(v: PcoDueVehicleDto): Partial<ReturnType<typeof emptyDraft>> {
  return {
    vrm: v.vrm,
    registeredKeeper: v.registeredKeeper,
    email: v.email ?? "",
    phone: v.phone ?? "",
    pcoAccountPhone: v.pcoAccountPhone ?? "",
    addressLine1: v.addressLine1 ?? "",
    city: v.city ?? "",
    postcode: v.postcode ?? "",
    firstRegistrationDate: v.firstRegistrationDate,
    pcoExpiryDate: v.pcoExpiryDate ?? "",
    logbookExpiryDate: v.logbookExpiryDate,
    make: v.make ?? "",
    model: v.model ?? "",
    color: v.color ?? "",
    fuelType: v.fuelType ?? "",
    seatCount: v.seatCount != null ? String(v.seatCount) : "",
    chargeGross: v.lastChargeGross ?? "",
  };
}

export function PcoPageContent() {
  const { hasPermission } = useSession();
  const canWrite = hasPermission("pco.write");
  const canPay = canWrite && hasPermission("ledger.write");
  const canReadLedger = hasPermission("ledger.read");

  const [tab, setTab] = useState<TabId>("active");
  const [rows, setRows] = useState<PcoBookingListDto[]>([]);
  const [dueRows, setDueRows] = useState<PcoDueVehicleDto[]>([]);
  const [centres, setCentres] = useState<PcoCentreDto[]>([]);
  const [accounts, setAccounts] = useState<PaymentAccountDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [draft, setDraft] = useState(emptyDraft());
  const [vrmHint, setVrmHint] = useState<PcoVrmLookupDto | null>(null);
  const [vrmLookupLoading, setVrmLookupLoading] = useState(false);
  const [vrmConfirmOpen, setVrmConfirmOpen] = useState(false);
  const [vrmConfirmVehicle, setVrmConfirmVehicle] = useState<PcoVehicleDto | null>(null);
  const [saving, setSaving] = useState(false);
  const [priorityUpdatingId, setPriorityUpdatingId] = useState<string | null>(null);

  const [detail, setDetail] = useState<PcoBookingDto | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleDraft, setScheduleDraft] = useState(emptyScheduleDraft());

  const [editOpen, setEditOpen] = useState(false);
  const [editDraft, setEditDraft] = useState(emptyDraft());
  const [editBookingId, setEditBookingId] = useState<string | null>(null);

  const [renewDueOpen, setRenewDueOpen] = useState(false);
  const [renewDueVehicle, setRenewDueVehicle] = useState<PcoDueVehicleDto | null>(null);
  const [renewJobType, setRenewJobType] = useState<PcoJobType>("RENEWAL");
  const [renewClientConsent, setRenewClientConsent] = useState(false);
  const [renewDetailsCorrect, setRenewDetailsCorrect] = useState<boolean | null>(null);
  const [renewDraft, setRenewDraft] = useState(emptyDraft());

  const [payOpen, setPayOpen] = useState(false);
  const [payAmount, setPayAmount] = useState("");
  const [payAccountId, setPayAccountId] = useState("");
  const [payMethod, setPayMethod] = useState<PaymentMethod>("BANK_TRANSFER");
  const [payDate, setPayDate] = useState(todayIso());

  const [completeOpen, setCompleteOpen] = useState(false);
  const [nextExpiry, setNextExpiry] = useState("");

  const [centreName, setCentreName] = useState("");
  const [confirmDeleteCentre, setConfirmDeleteCentre] = useState<PcoCentreDto | null>(null);
  const [feeActionModal, setFeeActionModal] = useState<{
    mode: "cancel" | "reschedule";
    booking: PcoBookingDto;
  } | null>(null);
  const [slotFeeDisposition, setSlotFeeDisposition] = useState<PcoSlotFeeDisposition | "">("");
  const [cancellationNote, setCancellationNote] = useState("");
  const [slotCredits, setSlotCredits] = useState<PcoSlotCreditDto[]>([]);
  const [notesOpen, setNotesOpen] = useState(false);
  const [notesDraft, setNotesDraft] = useState("");
  const [activeDateFilter, setActiveDateFilter] = useState<string | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  const centreOptions = useMemo(
    () => centres.map((c) => ({ value: c.id, label: c.label })),
    [centres],
  );

  const activeBookingCountsByDate = useMemo(() => {
    const counts = new Map<string, number>();
    if (tab !== "active") return counts;
    for (const row of rows) {
      if (!row.bookingDate) continue;
      counts.set(row.bookingDate, (counts.get(row.bookingDate) ?? 0) + 1);
    }
    return counts;
  }, [tab, rows]);

  const displayedBookingRows = useMemo(() => {
    if (tab !== "active" || !activeDateFilter) return rows;
    return rows.filter((r) => r.bookingDate === activeDateFilter);
  }, [tab, rows, activeDateFilter]);

  const calendarCells = useMemo(
    () => buildMonthCells(calendarMonth.year, calendarMonth.month),
    [calendarMonth],
  );

  const loadCentres = useCallback(async () => {
    const data = await apiFetch<PcoCentreDto[]>("/pco/centres").catch(() => []);
    setCentres(data);
    return data;
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      if (tab === "settings") {
        await loadCentres();
        setRows([]);
        setDueRows([]);
        return;
      }
      if (tab === "renewals_due" || tab === "v5c_expiring") {
        const data = await apiFetch<PcoDueVehicleDto[]>(`/pco/bookings?tab=${tab}`);
        setDueRows(data);
        setRows([]);
      } else {
        const data = await apiFetch<PcoBookingListDto[]>(`/pco/bookings?tab=${tab}`);
        setRows(data);
        setDueRows([]);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load PCO data");
    } finally {
      setLoading(false);
    }
  }, [tab, loadCentres]);

  useEffect(() => {
    void loadCentres();
  }, [loadCentres]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!canReadLedger) return;
    void apiFetch<PaymentAccountDto[]>("/ledger/accounts")
      .then((a) => {
        setAccounts(a);
        if (a[0]) {
          setPayAccountId(a[0].id);
          setPayMethod(defaultPaymentMethodForAccount(a[0].type));
          setScheduleDraft((d) =>
            d.slotPaymentAccountId ? d : { ...d, slotPaymentAccountId: a[0].id },
          );
        }
      })
      .catch(() => []);
  }, [canReadLedger]);

  async function lookupVrm(vrm: string) {
    const n = normalizeRegistration(vrm);
    if (n.length < 3) {
      setVrmHint(null);
      setVrmLookupLoading(false);
      return;
    }
    setVrmLookupLoading(true);
    try {
      const data = await apiFetch<PcoVrmLookupDto>(`/pco/lookup?vrm=${encodeURIComponent(n)}`);
      setVrmHint(data);
      const snapshot = data.activeVehicle ?? data.lastCompletedVehicle;
      if (snapshot) {
        setVrmConfirmVehicle(snapshot);
        setVrmConfirmOpen(true);
      } else {
        setVrmConfirmVehicle(null);
      }
      if (draft.jobType === "RESCHEDULE" && data.activeBooking) {
        const ab = data.activeBooking;
        setDraft((d) => ({
          ...d,
          notes: [
            d.notes,
            ab.bookingCentreName && ab.bookingDate
              ? `Current booking: ${ab.bookingCentreName}, ${ab.bookingDate}${ab.bookingTime ? ` ${ab.bookingTime}` : ""}`
              : "",
          ]
            .filter(Boolean)
            .join("\n"),
        }));
      } else {
        setDraft((d) => ({
          ...d,
          chargeGross: lastCustomerChargeFromLookup(data),
        }));
      }
    } catch {
      setVrmHint(null);
    } finally {
      setVrmLookupLoading(false);
    }
  }

  function openCreate(prefill?: Partial<ReturnType<typeof emptyDraft>>) {
    setDraft({ ...emptyDraft(), ...prefill });
    setVrmHint(null);
    setVrmLookupLoading(false);
    setVrmConfirmVehicle(null);
    setVrmConfirmOpen(false);
    setModalOpen(true);
  }

  function applyVrmSnapshot() {
    if (!vrmConfirmVehicle) return;
    setDraft((d) => ({
      ...d,
      ...vehicleToDraft(vrmConfirmVehicle),
      chargeGross: vrmHint ? lastCustomerChargeFromLookup(vrmHint) : d.chargeGross,
    }));
    setVrmConfirmOpen(false);
  }

  async function openDetail(id: string) {
    setSaving(true);
    setError("");
    try {
      const b = await apiFetch<PcoBookingDto>(`/pco/bookings/${id}`);
      setDetail(b);
      setDetailOpen(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load booking");
    } finally {
      setSaving(false);
    }
  }

  async function saveBooking(e: FormEvent) {
    e.preventDefault();
    if (!draft.vrm.trim() || !draft.registeredKeeper.trim()) {
      setError("VRM and registered keeper are required");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const logbook =
        draft.logbookExpiryDate ||
        calculateLogbookExpiryFromFirstRegistration(draft.firstRegistrationDate) ||
        undefined;
      await apiFetch("/pco/bookings", {
        method: "POST",
        body: JSON.stringify({
          vrm: draft.vrm,
          registeredKeeper: draft.registeredKeeper,
          addressLine1: draft.addressLine1 || undefined,
          addressLine2: draft.addressLine2 || undefined,
          city: draft.city || undefined,
          postcode: draft.postcode || undefined,
          email: draft.email || undefined,
          phone: draft.phone || undefined,
          pcoAccountPhone: draft.pcoAccountPhone || undefined,
          make: draft.make || undefined,
          model: draft.model || undefined,
          color: draft.color || undefined,
          fuelType: draft.fuelType || undefined,
          seatCount: draft.seatCount ? Number(draft.seatCount) : undefined,
          firstRegistrationDate: draft.firstRegistrationDate,
          pcoExpiryDate: draft.pcoExpiryDate,
          logbookExpiryDate: logbook,
          note: draft.note || undefined,
          notes: draft.notes || undefined,
          jobType: draft.jobType,
          jobDetails: draft.jobDetails || undefined,
          priority: draft.priority,
          chargeGross: draft.chargeGross ? Number(draft.chargeGross) : 0,
        }),
      });
      setModalOpen(false);
      setMessage("Car added to PCO list — book appointment when ready");
      setTab("pending");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create booking");
    } finally {
      setSaving(false);
    }
  }

  function openScheduleModal(booking: PcoBookingDto) {
    setDetail(booking);
    setScheduleDraft({
      bookingDate: "",
      bookingTime: booking.bookingTime ?? "",
      bookingCentreId: booking.bookingCentreId ?? centres[0]?.id ?? "",
      slotPaidBy: booking.slotPaidBy ?? "US",
      slotPaymentAccountId:
        booking.slotPaymentAccountId ?? accounts[0]?.id ?? "",
      slotChargeGross:
        booking.slotChargeGross ?? String(PCO_DEFAULT_BOOKING_CHARGE),
      slotCreditSourceBookingId: booking.slotCreditSourceBookingId ?? "",
    });
    setScheduleOpen(true);
    void apiFetch<PcoSlotCreditDto[]>(
      `/pco/slot-credits?vrm=${encodeURIComponent(booking.vehicle.vrm)}`,
    )
      .then(setSlotCredits)
      .catch(() => setSlotCredits([]));
  }

  async function quickSchedule(bookingId: string) {
    setSaving(true);
    try {
      const b = await apiFetch<PcoBookingDto>(`/pco/bookings/${bookingId}`);
      openScheduleModal(b);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load booking");
    } finally {
      setSaving(false);
    }
  }

  async function openEditPending(bookingId: string) {
    setSaving(true);
    setError("");
    try {
      const b = await apiFetch<PcoBookingDto>(`/pco/bookings/${bookingId}`);
      setEditBookingId(b.id);
      setEditDraft({
        ...emptyDraft(),
        registeredKeeper: b.vehicle.registeredKeeper,
        email: b.vehicle.email ?? "",
        phone: b.vehicle.phone ?? "",
        pcoAccountPhone: b.vehicle.pcoAccountPhone ?? "",
        addressLine1: b.vehicle.addressLine1 ?? "",
        addressLine2: b.vehicle.addressLine2 ?? "",
        city: b.vehicle.city ?? "",
        postcode: b.vehicle.postcode ?? "",
        firstRegistrationDate: b.vehicle.firstRegistrationDate,
        pcoExpiryDate: b.vehicle.pcoExpiryDate,
        logbookExpiryDate: b.vehicle.logbookExpiryDate,
        note: b.vehicle.note ?? "",
        make: b.vehicle.make ?? "",
        model: b.vehicle.model ?? "",
        color: b.vehicle.color ?? "",
        fuelType: b.vehicle.fuelType ?? "",
        seatCount: b.vehicle.seatCount != null ? String(b.vehicle.seatCount) : "",
        jobType: b.jobType,
        jobDetails: b.jobDetails ?? "",
        notes: b.notes ?? "",
        priority: b.priority,
        chargeGross: b.chargeGross,
      });
      setEditOpen(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load booking");
    } finally {
      setSaving(false);
    }
  }

  async function saveEditPending(e: FormEvent) {
    e.preventDefault();
    if (!editBookingId) return;
    setSaving(true);
    setError("");
    try {
      await apiFetch(`/pco/bookings/${editBookingId}`, {
        method: "PATCH",
        body: JSON.stringify({
          jobType: editDraft.jobType,
          jobDetails: editDraft.jobDetails || undefined,
          notes: editDraft.notes || undefined,
          priority: editDraft.priority,
          chargeGross: editDraft.chargeGross ? Number(editDraft.chargeGross) : undefined,
          registeredKeeper: editDraft.registeredKeeper,
          email: editDraft.email || undefined,
          phone: editDraft.phone || undefined,
          pcoAccountPhone: editDraft.pcoAccountPhone || undefined,
          addressLine1: editDraft.addressLine1 || undefined,
          city: editDraft.city || undefined,
          postcode: editDraft.postcode || undefined,
          make: editDraft.make || undefined,
          model: editDraft.model || undefined,
          color: editDraft.color || undefined,
          fuelType: editDraft.fuelType || undefined,
          seatCount: editDraft.seatCount ? Number(editDraft.seatCount) : undefined,
          pcoExpiryDate: editDraft.pcoExpiryDate || undefined,
          vehicleNote: editDraft.note || undefined,
        }),
      });
      setEditOpen(false);
      setMessage("Booking updated");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update booking");
    } finally {
      setSaving(false);
    }
  }

  const updatePriority = useCallback(async (bookingId: string, priority: PcoPriority) => {
    setPriorityUpdatingId(bookingId);
    setError("");
    try {
      await apiFetch(`/pco/bookings/${bookingId}`, {
        method: "PATCH",
        body: JSON.stringify({ priority }),
      });
      setRows((prev) => prev.map((r) => (r.id === bookingId ? { ...r, priority } : r)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update priority");
      await load();
    } finally {
      setPriorityUpdatingId(null);
    }
  }, [load]);

  async function updateClientFlags(
    bookingId: string,
    patch: { clientInformed?: boolean; clientResponded?: boolean },
  ) {
    setSaving(true);
    setError("");
    try {
      const updated = await apiFetch<PcoBookingDto>(`/pco/bookings/${bookingId}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      setDetail((prev) => (prev?.id === bookingId ? updated : prev));
      setRows((prev) =>
        prev.map((r) =>
          r.id === bookingId
            ? {
                ...r,
                clientInformed: updated.clientInformed,
                clientResponded: updated.clientResponded,
              }
            : r,
        ),
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update client status");
    } finally {
      setSaving(false);
    }
  }

  function openNotesModal() {
    if (!detail) return;
    setNotesDraft("");
    setNotesOpen(true);
    setError("");
  }

  async function saveNotes(e: FormEvent) {
    e.preventDefault();
    if (!detail) return;
    const addition = notesDraft.trim();
    if (!addition) {
      setError("Enter a note to add");
      return;
    }
    const stamped = `${formatDateTime(new Date().toISOString())}\n${addition}`;
    const merged = detail.notes?.trim() ? `${detail.notes.trim()}\n\n${stamped}` : stamped;
    setSaving(true);
    setError("");
    try {
      const updated = await apiFetch<PcoBookingDto>(`/pco/bookings/${detail.id}`, {
        method: "PATCH",
        body: JSON.stringify({ notes: merged }),
      });
      setDetail(updated);
      setRows((prev) =>
        prev.map((r) => (r.id === updated.id ? { ...r, notes: updated.notes } : r)),
      );
      setNotesOpen(false);
      setNotesDraft("");
      setMessage("Note added");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not add note");
    } finally {
      setSaving(false);
    }
  }

  function openFeeActionModal(mode: "cancel" | "reschedule", booking: PcoBookingDto) {
    setFeeActionModal({ mode, booking });
    setSlotFeeDisposition("");
    setCancellationNote("");
    setError("");
  }

  async function openRescheduleModal(bookingId: string) {
    setSaving(true);
    setError("");
    try {
      const booking = await apiFetch<PcoBookingDto>(`/pco/bookings/${bookingId}`);
      openFeeActionModal("reschedule", booking);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load booking");
    } finally {
      setSaving(false);
    }
  }

  async function submitFeeAction() {
    if (!feeActionModal) return;
    const { mode, booking } = feeActionModal;
    const needsFeeChoice = bookingHadActiveSlotFee(booking);
    if (needsFeeChoice) {
      if (!slotFeeDisposition || slotFeeDisposition === "NOT_APPLICABLE") {
        setError("Choose what happens to the booking slot fee");
        return;
      }
      if (!cancellationNote.trim()) {
        setError("A cancellation note is required");
        return;
      }
    }
    setSaving(true);
    setError("");
    try {
      const body =
        needsFeeChoice
          ? { slotFeeDisposition, cancellationNote: cancellationNote.trim() }
          : {};
      if (mode === "cancel") {
        await apiFetch(`/pco/bookings/${booking.id}/cancel`, {
          method: "POST",
          body: JSON.stringify(body),
        });
        setFeeActionModal(null);
        setDetailOpen(false);
        setMessage("Booking cancelled");
      } else {
        await apiFetch(`/pco/bookings/${booking.id}/cancel-and-reschedule`, {
          method: "POST",
          body: JSON.stringify(body),
        });
        setFeeActionModal(null);
        setDetailOpen(false);
        setMessage("Cancelled and added to To book for a new appointment");
        setTab("pending");
      }
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not complete action");
    } finally {
      setSaving(false);
    }
  }

  function openRenewDueModal(vehicle: PcoDueVehicleDto, jobType: PcoJobType) {
    setRenewDueVehicle(vehicle);
    setRenewJobType(jobType);
    setRenewClientConsent(false);
    setRenewDetailsCorrect(null);
    setRenewDraft({ ...emptyDraft(), ...dueVehicleToDraft(vehicle), jobType });
    setRenewDueOpen(true);
  }

  async function submitRenewDue(e: FormEvent) {
    e.preventDefault();
    if (!renewDueVehicle || !renewClientConsent) {
      setError("Client consent is required");
      return;
    }
    if (renewDetailsCorrect === null) {
      setError("Please confirm whether the details are still correct");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const logbook =
        renewDraft.logbookExpiryDate ||
        calculateLogbookExpiryFromFirstRegistration(renewDraft.firstRegistrationDate) ||
        undefined;
      await apiFetch("/pco/bookings", {
        method: "POST",
        body: JSON.stringify({
          vrm: renewDraft.vrm,
          registeredKeeper: renewDraft.registeredKeeper,
          addressLine1: renewDraft.addressLine1 || undefined,
          addressLine2: renewDraft.addressLine2 || undefined,
          city: renewDraft.city || undefined,
          postcode: renewDraft.postcode || undefined,
          email: renewDraft.email || undefined,
          phone: renewDraft.phone || undefined,
          pcoAccountPhone: renewDraft.pcoAccountPhone || undefined,
          make: renewDraft.make || undefined,
          model: renewDraft.model || undefined,
          color: renewDraft.color || undefined,
          fuelType: renewDraft.fuelType || undefined,
          seatCount: renewDraft.seatCount ? Number(renewDraft.seatCount) : undefined,
          firstRegistrationDate: renewDraft.firstRegistrationDate,
          pcoExpiryDate: renewDraft.pcoExpiryDate,
          logbookExpiryDate: logbook,
          note: renewDraft.note || undefined,
          notes: renewDraft.notes || undefined,
          jobType: renewJobType,
          priority: renewDraft.priority,
          chargeGross: renewDraft.chargeGross ? Number(renewDraft.chargeGross) : 0,
        }),
      });
      setRenewDueOpen(false);
      setMessage("Added to To book list");
      setTab("pending");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not add to list");
    } finally {
      setSaving(false);
    }
  }

  async function scheduleBooking(e: FormEvent) {
    e.preventDefault();
    if (!detail) return;
    if (!scheduleDraft.bookingDate) {
      setError("Booking date is required");
      return;
    }
    if (scheduleDraft.bookingDate < minBookingDateIso()) {
      setError("Booking date must be in the future");
      return;
    }
    if (!scheduleDraft.bookingCentreId) {
      setError("Booking centre is required");
      return;
    }
    if (scheduleDraft.slotPaidBy === "US") {
      if (!scheduleDraft.slotPaymentAccountId) {
        setError("Select which account paid for the booking slot");
        return;
      }
      if (!Number(scheduleDraft.slotChargeGross) || Number(scheduleDraft.slotChargeGross) <= 0) {
        setError("Enter the slot expense amount");
        return;
      }
    }
    if (scheduleDraft.slotPaidBy === "TFL_CREDIT" && !scheduleDraft.slotCreditSourceBookingId) {
      setError("Select which TfL credit to apply");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const body: Record<string, unknown> = {
        bookingDate: scheduleDraft.bookingDate,
        bookingTime: scheduleDraft.bookingTime,
        bookingCentreId: scheduleDraft.bookingCentreId,
        slotPaidBy: scheduleDraft.slotPaidBy,
      };
      if (scheduleDraft.slotPaidBy === "US") {
        body.slotPaymentAccountId = scheduleDraft.slotPaymentAccountId;
        body.slotChargeGross = Number(scheduleDraft.slotChargeGross);
      }
      if (scheduleDraft.slotPaidBy === "TFL_CREDIT") {
        body.slotCreditSourceBookingId = scheduleDraft.slotCreditSourceBookingId;
      }
      const updated = await apiFetch<PcoBookingDto>(`/pco/bookings/${detail.id}/schedule`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      setDetail(updated);
      setScheduleOpen(false);
      setMessage("Booking details saved — moved to active bookings");
      setTab("active");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not book appointment");
    } finally {
      setSaving(false);
    }
  }

  function openScheduleModalFromDetail(booking: PcoBookingDto) {
    openScheduleModal(booking);
  }

  async function recordPayment(e: FormEvent) {
    e.preventDefault();
    if (!detail) return;
    setSaving(true);
    setError("");
    try {
      const updated = await apiFetch<PcoBookingDto>(`/pco/bookings/${detail.id}/payments`, {
        method: "POST",
        body: JSON.stringify({
          paymentAccountId: payAccountId,
          method: payMethod,
          amount: Number(payAmount),
          valueDate: payDate,
        }),
      });
      setDetail(updated);
      setPayOpen(false);
      setMessage("Payment recorded — ledger entry tagged PCO");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not record payment");
    } finally {
      setSaving(false);
    }
  }

  async function completeBooking() {
    if (!detail || !nextExpiry) return;
    setSaving(true);
    setError("");
    try {
      await apiFetch(`/pco/bookings/${detail.id}/complete`, {
        method: "POST",
        body: JSON.stringify({ nextPcoExpiryDate: nextExpiry }),
      });
      setCompleteOpen(false);
      setDetailOpen(false);
      setMessage("Booking completed and PCO expiry updated");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not complete booking");
    } finally {
      setSaving(false);
    }
  }

  async function addCentre(e: FormEvent) {
    e.preventDefault();
    if (!centreName.trim()) return;
    setSaving(true);
    try {
      await apiFetch("/pco/centres", {
        method: "POST",
        body: JSON.stringify({ label: centreName.trim() }),
      });
      setCentreName("");
      setMessage("Booking centre added");
      await loadCentres();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not add centre");
    } finally {
      setSaving(false);
    }
  }

  async function removeCentre() {
    if (!confirmDeleteCentre) return;
    setSaving(true);
    setError("");
    try {
      await apiFetch(`/pco/centres/${confirmDeleteCentre.id}`, { method: "DELETE" });
      setConfirmDeleteCentre(null);
      setMessage("Booking centre removed");
      await loadCentres();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not remove centre");
    } finally {
      setSaving(false);
    }
  }

  const bookingColumns: TableColumn<PcoBookingListDto>[] = useMemo(() => {
    const cols: TableColumn<PcoBookingListDto>[] = [
      {
        id: "vrm",
        header: "Reg",
        sticky: "left",
        searchText: (r) => formatRegistrationDisplay(r.vrm),
        cell: (r) => <VrmText vrm={r.vrm} />,
      },
      ...(tab === "pending"
        ? [
            {
              id: "priority",
              header: "Priority",
              cell: (r: PcoBookingListDto) =>
                canWrite ? (
                  <select
                    value={r.priority}
                    onChange={(e) => void updatePriority(r.id, e.target.value as PcoPriority)}
                    disabled={priorityUpdatingId === r.id}
                    aria-label={`Priority for ${formatRegistrationDisplay(r.vrm)}`}
                    className={`${tableInlineSelectClass} ${PRIORITY_INLINE_SELECT_CLASS[r.priority]}`}
                  >
                    {(["HIGH", "MEDIUM", "LOW"] as const).map((p) => (
                      <option key={p} value={p}>
                        {PCO_PRIORITY_LABEL[p]}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className={PRIORITY_INLINE_SELECT_CLASS[r.priority]}>
                    {PCO_PRIORITY_LABEL[r.priority]}
                  </span>
                ),
            } as TableColumn<PcoBookingListDto>,
          ]
        : []),
      {
        id: "keeper",
        header: "Keeper",
        searchText: (r) => r.registeredKeeper,
        cell: (r) => <span className="font-medium">{r.registeredKeeper}</span>,
      },
      {
        id: "address",
        header: "Address",
        searchText: (r) => formatTableAddress(r),
        cell: (r) => (
          <span className="block max-w-[14rem] truncate text-sm" title={formatTableAddress(r)}>
            {formatTableAddress(r)}
          </span>
        ),
      },
      {
        id: "contact",
        header: "Contact",
        searchText: (r) => [r.email, r.phone, r.pcoAccountPhone].filter(Boolean).join(" "),
        cell: (r) => formatTableContact(r.email, r.phone, r.pcoAccountPhone),
      },
      {
        id: "pcoExpiry",
        header: "PCO expiry",
        searchText: (r) => r.pcoExpiryDate,
        cell: (r) => <span className="text-sm tabular-nums whitespace-nowrap">{r.pcoExpiryDate}</span>,
      },
      {
        id: "logbookExpiry",
        header: "Logbook expiry",
        searchText: (r) => r.logbookExpiryDate,
        cell: (r) => (
          <span className="text-sm tabular-nums whitespace-nowrap">{r.logbookExpiryDate}</span>
        ),
      },
      ...(tab !== "pending"
        ? [
            {
              id: "appointment",
              header: "Booking",
              searchText: (r) =>
                [r.bookingDate, r.bookingTime, r.bookingCentreName].filter(Boolean).join(" "),
              cell: (r) =>
                r.bookingDate ? (
                  <div className="text-sm tabular-nums whitespace-nowrap">
                    <p>
                      {r.bookingDate}
                      {r.bookingTime ? ` ${r.bookingTime}` : ""}
                    </p>
                    {r.bookingCentreName && (
                      <p className="text-xs text-[var(--muted)]">{r.bookingCentreName}</p>
                    )}
                  </div>
                ) : (
                  <span className="text-xs text-[var(--muted)]">—</span>
                ),
            } as TableColumn<PcoBookingListDto>,
          ]
        : []),
      {
        id: "job",
        header: "Job",
        searchText: (r) => `${r.bookingNumber} ${PCO_JOB_TYPE_LABEL[r.jobType]}`,
        cell: (r) => (
          <div className="text-sm whitespace-nowrap">
            <p>{PCO_JOB_TYPE_LABEL[r.jobType]}</p>
            <p className="text-xs text-[var(--muted)]">{r.bookingNumber}</p>
          </div>
        ),
      },
      {
        id: "charge",
        header: "Charge / paid",
        align: "right",
        cell: (r) => (
          <div className="text-right tabular-nums text-sm whitespace-nowrap">
            <div>{formatGbp(r.chargeGross)}</div>
            <div className="text-xs text-[var(--muted)]">
              {Number(r.balanceDue) > 0 ? `${formatGbp(r.balanceDue)} due` : "Paid"}
            </div>
          </div>
        ),
      },
      ...(tab !== "pending"
        ? [
            {
              id: "flags",
              header: "Client",
              cell: (r: PcoBookingListDto) => (
                <div className="flex flex-col gap-0.5 text-xs text-[var(--muted)] whitespace-nowrap">
                  <span>{r.clientInformed ? "Informed" : "Not informed"}</span>
                  <span>{r.clientResponded ? "Confirmed" : "Not confirmed"}</span>
                </div>
              ),
            } as TableColumn<PcoBookingListDto>,
          ]
        : []),
      {
        id: "actions",
        header: "",
        align: "right",
        sticky: "right",
        cell: (r) => {
          const actions: { label: string; onClick: () => void }[] = [
            { label: "View", onClick: () => void openDetail(r.id) },
          ];
          if (tab === "pending" && canWrite) {
            actions.unshift({ label: "Edit", onClick: () => void openEditPending(r.id) });
          }
          if (tab === "active" && canWrite) {
            actions.unshift({
              label: "Reschedule",
              onClick: () => void openRescheduleModal(r.id),
            });
          }
          return (
            <div className="flex items-center justify-end gap-1 whitespace-nowrap">
              {tab === "pending" && canWrite && (
                <button
                  type="button"
                  onClick={() => void quickSchedule(r.id)}
                  disabled={saving}
                  className="rounded-lg bg-accent px-2.5 py-1 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
                >
                  Book
                </button>
              )}
              <TableRowActionsMenu
                triggerLabel={`Actions for ${formatRegistrationDisplay(r.vrm)}`}
                actions={actions}
              />
            </div>
          );
        },
      },
    ];
    return cols;
  }, [tab, canWrite, saving, priorityUpdatingId, updatePriority]);

  const dueColumns: TableColumn<PcoDueVehicleDto>[] = useMemo(
    () => [
      {
        id: "vrm",
        header: "Reg",
        sticky: "left",
        searchText: (r) => formatRegistrationDisplay(r.vrm),
        cell: (r) => <VrmText vrm={r.vrm} />,
      },
      {
        id: "keeper",
        header: "Keeper",
        searchText: (r) => r.registeredKeeper,
        cell: (r) => <span className="font-medium">{r.registeredKeeper}</span>,
      },
      {
        id: "address",
        header: "Address",
        searchText: (r) => formatTableAddress(r),
        cell: (r) => (
          <span className="block max-w-[14rem] truncate text-sm" title={formatTableAddress(r)}>
            {formatTableAddress(r)}
          </span>
        ),
      },
      {
        id: "contact",
        header: "Contact",
        searchText: (r) => [r.email, r.phone, r.pcoAccountPhone].filter(Boolean).join(" "),
        cell: (r) => formatTableContact(r.email, r.phone, r.pcoAccountPhone),
      },
      {
        id: "pcoExpiry",
        header: "PCO expiry",
        searchText: (r) => r.pcoExpiryDate ?? "",
        cell: (r) => (
          <span className="text-sm tabular-nums">{r.pcoExpiryDate ?? "—"}</span>
        ),
      },
      {
        id: "logbookExpiry",
        header: "Logbook expiry",
        searchText: (r) => r.logbookExpiryDate,
        cell: (r) => (
          <span className="text-sm tabular-nums">{r.logbookExpiryDate}</span>
        ),
      },
      {
        id: "due",
        header: "Due in",
        cell: (r) => (
          <span className={r.daysUntilDue <= 7 ? "font-semibold text-amber-700 dark:text-amber-400" : ""}>
            {r.daysUntilDue} days
          </span>
        ),
      },
      {
        id: "last",
        header: "Last charge",
        cell: (r) =>
          r.lastChargeGross ? (
            <span className="text-sm">
              {formatGbp(r.lastChargeGross)}
              {r.lastBookingNumber ? ` (${r.lastBookingNumber})` : ""}
            </span>
          ) : (
            "—"
          ),
      },
      ...(canWrite
        ? [
            {
              id: "actions",
              header: "",
              align: "right" as const,
              sticky: "right" as const,
              cell: (r: PcoDueVehicleDto) => (
                <TableRowActionsMenu
                  triggerLabel={`Actions for ${formatRegistrationDisplay(r.vrm)}`}
                  actions={[
                    {
                      label: "Add to To book",
                      onClick: () =>
                        openRenewDueModal(
                          r,
                          tab === "renewals_due" ? "RENEWAL" : "LOGBOOK_EXPIRING",
                        ),
                    },
                  ]}
                />
              ),
            },
          ]
        : []),
    ],
    [canWrite, tab],
  );

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">PCO bookings</h1>
          <p className="text-sm text-[var(--muted)]">
            Add car details first, then book at a centre. Payments post to ledger as PCO income (no VAT).
          </p>
        </div>
        {canWrite && tab !== "settings" && (
          <button
            type="button"
            onClick={() => openCreate()}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white"
          >
            Add request
          </button>
        )}
      </div>

      {message && <p className="mb-3 text-sm text-green-700 dark:text-green-400">{message}</p>}
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      <TabBar
        tabs={[
          { id: "active", label: "Active bookings" },
          { id: "pending", label: "To book" },
          { id: "past", label: "Past bookings" },
          { id: "v5c_expiring", label: "V5C expiring" },
          { id: "renewals_due", label: "Due to renew (28d)" },
          ...(canWrite ? [{ id: "settings" as const, label: "Centres" }] : []),
        ]}
        active={tab}
        onChange={(t) => {
          const next = t as TabId;
          setTab(next);
          if (next !== "active") setActiveDateFilter(null);
        }}
        className="mb-4"
      />

      {loading ? (
        <p className="text-sm text-[var(--muted)]">Loading…</p>
      ) : tab === "settings" ? (
        <div className="max-w-lg rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <h2 className="mb-3 text-sm font-semibold">Booking centres</h2>
          <ul className="mb-4 space-y-1 text-sm">
            {centres.length === 0 ? (
              <li className="text-[var(--muted)]">No centres yet.</li>
            ) : (
              centres.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-[var(--border)] px-3 py-2"
                >
                  <span>{c.label}</span>
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteCentre(c)}
                    disabled={saving}
                    className="text-xs font-medium text-red-600 hover:underline disabled:opacity-50 dark:text-red-400"
                  >
                    Remove
                  </button>
                </li>
              ))
            )}
          </ul>
          <form onSubmit={(e) => void addCentre(e)} className="flex gap-2">
            <input
              value={centreName}
              onChange={(e) => setCentreName(e.target.value)}
              placeholder="Centre name"
              className={inputClass}
              required
            />
            <button
              type="submit"
              disabled={saving}
              className="shrink-0 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              Add
            </button>
          </form>
        </div>
      ) : tab === "renewals_due" || tab === "v5c_expiring" ? (
        <SearchableTable
          rows={dueRows}
          columns={dueColumns}
          getRowId={(r) => r.vehicleId}
          searchPlaceholder="Search reg, keeper, email…"
          emptyLabel={
            tab === "renewals_due"
              ? "No cars due to renew in the next 28 days"
              : "No cars with V5C expiring in the next 28 days"
          }
          minWidth="72rem"
        />
      ) : (
        <>
          {tab === "active" && (
            <div className="mb-4 max-w-sm rounded-xl border border-[var(--border)] bg-[var(--surface)]">
              <button
                type="button"
                onClick={() => setCalendarOpen((o) => !o)}
                aria-expanded={calendarOpen}
                className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm"
              >
                <span className="font-medium">
                  Filter by date
                  {activeDateFilter ? (
                    <span className="ml-2 font-normal text-[var(--muted)]">
                      · {activeDateFilter} ({displayedBookingRows.length})
                    </span>
                  ) : null}
                </span>
                <span className="text-[var(--muted)]" aria-hidden>
                  {calendarOpen ? "▾" : "▸"}
                </span>
              </button>
              {calendarOpen && (
                <div className="border-t border-[var(--border)] p-3 pt-2">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      aria-label="Previous month"
                      onClick={() =>
                        setCalendarMonth((m) => {
                          const d = new Date(m.year, m.month - 1, 1);
                          return { year: d.getFullYear(), month: d.getMonth() };
                        })
                      }
                      className="rounded-lg border border-[var(--border)] px-2 py-1 text-sm"
                    >
                      ‹
                    </button>
                    <p className="text-sm font-semibold">
                      {formatMonthLabel(calendarMonth.year, calendarMonth.month)}
                    </p>
                    <button
                      type="button"
                      aria-label="Next month"
                      onClick={() =>
                        setCalendarMonth((m) => {
                          const d = new Date(m.year, m.month + 1, 1);
                          return { year: d.getFullYear(), month: d.getMonth() };
                        })
                      }
                      className="rounded-lg border border-[var(--border)] px-2 py-1 text-sm"
                    >
                      ›
                    </button>
                  </div>
                  <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[10px] font-medium uppercase tracking-wide text-[var(--muted)]">
                    {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                      <span key={d}>{d}</span>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-1">
                    {calendarCells.map((day, idx) => {
                      if (day == null) {
                        return <span key={`pad-${idx}`} className="h-9" />;
                      }
                      const iso = toIsoDate(calendarMonth.year, calendarMonth.month, day);
                      const count = activeBookingCountsByDate.get(iso) ?? 0;
                      const selected = activeDateFilter === iso;
                      const isToday = iso === todayIso();
                      return (
                        <button
                          key={iso}
                          type="button"
                          onClick={() =>
                            setActiveDateFilter((prev) => (prev === iso ? null : iso))
                          }
                          title={
                            count > 0
                              ? `${count} booking${count === 1 ? "" : "s"}`
                              : "No bookings"
                          }
                          className={`relative flex h-9 flex-col items-center justify-center rounded-lg text-xs tabular-nums ${
                            selected
                              ? "bg-accent font-semibold text-white"
                              : count > 0
                                ? "bg-[var(--background)] font-medium hover:bg-accent/10"
                                : "text-[var(--muted)] hover:bg-[var(--background)]"
                          } ${isToday && !selected ? "ring-1 ring-[var(--border)]" : ""}`}
                        >
                          {day}
                          {count > 0 && (
                            <span
                              className={`absolute bottom-0.5 h-1 w-1 rounded-full ${
                                selected ? "bg-white" : "bg-accent"
                              }`}
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--muted)]">
                    <span>
                      {activeDateFilter
                        ? `Showing ${displayedBookingRows.length} on ${activeDateFilter}`
                        : "Click a date to filter · click again to clear"}
                    </span>
                    {activeDateFilter && (
                      <button
                        type="button"
                        onClick={() => setActiveDateFilter(null)}
                        className="font-medium text-accent hover:underline"
                      >
                        Show all
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
          <SearchableTable
            rows={displayedBookingRows}
            columns={bookingColumns}
            getRowId={(r) => r.id}
            searchPlaceholder="Search reg, keeper, email, booking no…"
            emptyLabel={
              tab === "past"
                ? "No past bookings"
                : tab === "pending"
                  ? "No cars waiting to be booked"
                  : activeDateFilter
                    ? "No active bookings on this date"
                    : "No active bookings — book from the To book tab"
            }
            minWidth={tab === "pending" ? "68rem" : tab === "past" ? "80rem" : "88rem"}
          />
        </>
      )}

      <Modal title="Add request" open={modalOpen} onClose={() => setModalOpen(false)} size="lg">
        <form onSubmit={(e) => void saveBooking(e)} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--muted)]">VRM</label>
              <div className="relative">
                <input
                  value={draft.vrm}
                  onChange={(e) => {
                    const v = normalizeRegistration(e.target.value);
                    setDraft((d) => ({ ...d, vrm: v }));
                  }}
                  onBlur={() => void lookupVrm(draft.vrm)}
                  className={`${inputClass} font-mono uppercase ${vrmLookupLoading ? "pr-9" : ""}`}
                  required
                  aria-busy={vrmLookupLoading}
                />
                {vrmLookupLoading && <FieldSpinner label="Looking up registration" />}
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--muted)]">
                Registered keeper
              </label>
              <input
                value={draft.registeredKeeper}
                onChange={(e) => setDraft((d) => ({ ...d, registeredKeeper: e.target.value }))}
                className={inputClass}
                required
              />
            </div>
          </div>

          {vrmHint && vrmHint.previousCharges.length > 0 && (
            <div className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-3 text-xs">
              <p className="mb-1 font-medium">Previous charges for this VRM</p>
              <ul className="list-inside list-disc text-[var(--muted)]">
                {vrmHint.previousCharges.map((c) => (
                  <li key={c.bookingNumber}>
                    {PCO_JOB_TYPE_LABEL[c.jobType]} — {formatGbp(c.chargeGross)} (
                    {c.bookingNumber})
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Email</label>
              <input
                type="email"
                value={draft.email}
                onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))}
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--muted)]">
                Client contact number
              </label>
              <input
                value={draft.phone}
                onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value }))}
                className={inputClass}
                placeholder="Mobile / contact for the client"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--muted)]">
                PCO account number
              </label>
              <input
                value={draft.pcoAccountPhone}
                onChange={(e) => setDraft((d) => ({ ...d, pcoAccountPhone: e.target.value }))}
                className={inputClass}
                placeholder="Number on the PCO centre / account"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Address</label>
              <input
                value={draft.addressLine1}
                onChange={(e) => setDraft((d) => ({ ...d, addressLine1: e.target.value }))}
                className={inputClass}
                placeholder="Line 1"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--muted)]">City</label>
              <input
                value={draft.city}
                onChange={(e) => setDraft((d) => ({ ...d, city: e.target.value }))}
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Postcode</label>
              <input
                value={draft.postcode}
                onChange={(e) => setDraft((d) => ({ ...d, postcode: e.target.value }))}
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--muted)]">
                First registration
              </label>
              <input
                type="date"
                value={draft.firstRegistrationDate}
                onChange={(e) => {
                  const v = e.target.value;
                  const logbook = calculateLogbookExpiryFromFirstRegistration(v) ?? "";
                  setDraft((d) => ({
                    ...d,
                    firstRegistrationDate: v,
                    logbookExpiryDate: logbook || d.logbookExpiryDate,
                  }));
                }}
                className={inputClass}
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--muted)]">PCO expiry</label>
              <input
                type="date"
                value={draft.pcoExpiryDate}
                onChange={(e) => setDraft((d) => ({ ...d, pcoExpiryDate: e.target.value }))}
                className={inputClass}
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--muted)]">
                Logbook expiry
              </label>
              <input
                type="date"
                value={draft.logbookExpiryDate}
                onChange={(e) => setDraft((d) => ({ ...d, logbookExpiryDate: e.target.value }))}
                className={inputClass}
                required
              />
            </div>
          </div>

          <details className="rounded-lg border border-[var(--border)] p-3">
            <summary className="cursor-pointer text-sm font-medium">Vehicle details (optional)</summary>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Make</label>
                <input
                  value={draft.make}
                  onChange={(e) => setDraft((d) => ({ ...d, make: e.target.value }))}
                  className={inputClass}
                  placeholder="e.g. Toyota"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Model</label>
                <input
                  value={draft.model}
                  onChange={(e) => setDraft((d) => ({ ...d, model: e.target.value }))}
                  className={inputClass}
                  placeholder="e.g. Prius"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Colour</label>
                <input
                  value={draft.color}
                  onChange={(e) => setDraft((d) => ({ ...d, color: e.target.value }))}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Fuel type</label>
                <Select
                  value={draft.fuelType}
                  onChange={(v) => setDraft((d) => ({ ...d, fuelType: v }))}
                  options={[
                    { value: "", label: "—" },
                    ...PCO_FUEL_TYPES.map((f) => ({ value: f, label: f })),
                  ]}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Seats</label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={draft.seatCount}
                  onChange={(e) => setDraft((d) => ({ ...d, seatCount: e.target.value }))}
                  className={inputClass}
                />
              </div>
            </div>
          </details>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Job type</label>
              <Select
                value={draft.jobType}
                onChange={(v) => {
                  const jobType = v as PcoJobType;
                  setDraft((d) => ({ ...d, jobType }));
                  if (jobType === "RESCHEDULE" && vrmHint?.activeBooking) {
                    const ab = vrmHint.activeBooking;
                    setDraft((d) => ({
                      ...d,
                      jobType,
                      notes: [
                        d.notes,
                        ab.bookingCentreName && ab.bookingDate
                          ? `Current booking: ${ab.bookingCentreName}, ${ab.bookingDate}${ab.bookingTime ? ` ${ab.bookingTime}` : ""}`
                          : "",
                      ]
                        .filter(Boolean)
                        .join("\n"),
                    }));
                  }
                }}
                options={PCO_JOB_TYPES.map((t) => ({ value: t, label: PCO_JOB_TYPE_LABEL[t] }))}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Priority</label>
              <Select
                value={draft.priority}
                onChange={(v) => setDraft((d) => ({ ...d, priority: v as PcoPriority }))}
                options={(["LOW", "MEDIUM", "HIGH"] as const).map((p) => ({
                  value: p,
                  label: PCO_PRIORITY_LABEL[p],
                }))}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--muted)]">
                Estimated customer charge (£)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={draft.chargeGross}
                onChange={(e) => setDraft((d) => ({ ...d, chargeGross: e.target.value }))}
                className={inputClass}
                placeholder="From last job if available"
              />
              <p className="mt-1 text-xs text-[var(--muted)]">
                What you charge the customer — prefilled from the last completed job for this reg,
                or leave blank. The £{PCO_DEFAULT_BOOKING_CHARGE} TfL slot fee is on Add booking
                details.
              </p>
            </div>
          </div>

          <p className="text-xs text-[var(--muted)]">
            Book centre, date and time after adding the request — from the To book tab.
          </p>

          {draft.jobType === "ADMIN" && (
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Job details</label>
              <textarea
                value={draft.jobDetails}
                onChange={(e) => setDraft((d) => ({ ...d, jobDetails: e.target.value }))}
                rows={3}
                className={inputClass}
              />
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Notes</label>
            <textarea
              value={draft.notes}
              onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
              rows={3}
              className={inputClass}
              placeholder="Any notes for this request…"
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {saving ? "Saving…" : "Add request"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        title="Use existing details?"
        open={vrmConfirmOpen && vrmConfirmVehicle !== null}
        onClose={() => setVrmConfirmOpen(false)}
        size="md"
      >
        {vrmConfirmVehicle && (
          <div className="space-y-4">
            <p className="text-sm text-[var(--muted)]">
              We already have PCO records for{" "}
              <strong>{formatRegistrationDisplay(draft.vrm)}</strong>. Are the keeper and vehicle
              details still the same?
            </p>
            <dl className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-3 text-sm">
              <DetailRow label="Keeper">{vrmConfirmVehicle.registeredKeeper}</DetailRow>
              <DetailRow label="Client contact">{vrmConfirmVehicle.phone ?? "—"}</DetailRow>
              <DetailRow label="PCO account number">
                {vrmConfirmVehicle.pcoAccountPhone ?? "—"}
              </DetailRow>
              <DetailRow label="Email">{vrmConfirmVehicle.email ?? "—"}</DetailRow>
              <DetailRow label="PCO expiry">{vrmConfirmVehicle.pcoExpiryDate}</DetailRow>
              <DetailRow label="V5C expiry">{vrmConfirmVehicle.logbookExpiryDate}</DetailRow>
            </dl>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setVrmConfirmOpen(false)}
                className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm"
              >
                No, enter new
              </button>
              <button
                type="button"
                onClick={applyVrmSnapshot}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white"
              >
                Yes, same details
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        title={detail ? detail.bookingNumber : "Booking"}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        size="xl"
      >
        {detail && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <UkNumberPlate registration={detail.vehicle.vrm} />
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  detail.status === "PENDING"
                    ? "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200"
                    : detail.status === "ACTIVE"
                    ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200"
                    : detail.status === "COMPLETED"
                      ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300"
                      : "bg-[var(--background)] text-[var(--muted)]"
                }`}
              >
                {PCO_BOOKING_STATUS_LABEL[detail.status]}
              </span>
            </div>

            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                Vehicle & keeper
              </h3>
              <dl className="grid gap-x-8 sm:grid-cols-2">
                <DetailRow label="VRM">
                  <VrmText vrm={detail.vehicle.vrm} />
                </DetailRow>
                <DetailRow label="Registered keeper">{detail.vehicle.registeredKeeper}</DetailRow>
                <DetailRow label="Client contact">{detail.vehicle.phone ?? "—"}</DetailRow>
                <DetailRow label="PCO account number">
                  {detail.vehicle.pcoAccountPhone ?? "—"}
                </DetailRow>
                <DetailRow label="Email">{detail.vehicle.email ?? "—"}</DetailRow>
                <DetailRow label="Address">{formatKeeperAddress(detail.vehicle)}</DetailRow>
                <DetailRow label="First registration">{detail.vehicle.firstRegistrationDate}</DetailRow>
                {(detail.vehicle.make || detail.vehicle.model) && (
                  <DetailRow label="Make / model">
                    {[detail.vehicle.make, detail.vehicle.model].filter(Boolean).join(" ")}
                  </DetailRow>
                )}
                {detail.vehicle.color && (
                  <DetailRow label="Colour">{detail.vehicle.color}</DetailRow>
                )}
                {detail.vehicle.fuelType && (
                  <DetailRow label="Fuel">{detail.vehicle.fuelType}</DetailRow>
                )}
                {detail.vehicle.seatCount != null && (
                  <DetailRow label="Seats">{detail.vehicle.seatCount}</DetailRow>
                )}
                <DetailRow label="PCO expiry">{detail.vehicle.pcoExpiryDate}</DetailRow>
                <DetailRow label="Logbook expiry">{detail.vehicle.logbookExpiryDate}</DetailRow>
                {detail.vehicle.note && (
                  <div className="border-b border-[var(--border)] py-2.5 last:border-0 sm:col-span-2">
                    <dt className="text-sm text-[var(--muted)]">Vehicle note</dt>
                    <dd className="mt-0.5 whitespace-pre-wrap text-sm">{detail.vehicle.note}</dd>
                  </div>
                )}
              </dl>
            </section>

            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                Booking
              </h3>
              <dl className="grid gap-x-8 sm:grid-cols-2">
                <DetailRow label="Booking number">{detail.bookingNumber}</DetailRow>
                <DetailRow label="Job type">{PCO_JOB_TYPE_LABEL[detail.jobType]}</DetailRow>
                <DetailRow label="Priority">{PCO_PRIORITY_LABEL[detail.priority]}</DetailRow>
                <DetailRow label="Appointment">
                  {detail.bookingDate
                    ? `${detail.bookingDate}${detail.bookingTime ? ` ${detail.bookingTime}` : ""}`
                    : detail.status === "PENDING"
                      ? "Not booked yet"
                      : "—"}
                </DetailRow>
                <DetailRow label="Centre">{detail.bookingCentreName ?? "—"}</DetailRow>
                <DetailRow label="Slot paid by">
                  {detail.slotPaidBy
                    ? PCO_BOOKING_SLOT_PAID_BY_LABEL[detail.slotPaidBy]
                    : "—"}
                </DetailRow>
                {detail.slotPaidBy === "US" && detail.slotChargeGross != null && (
                  <DetailRow label="Slot expense (us)">
                    {formatGbp(detail.slotChargeGross)}
                    {detail.slotPaymentAccountName
                      ? ` · ${detail.slotPaymentAccountName}`
                      : ""}
                  </DetailRow>
                )}
                <div className="border-b border-[var(--border)] py-2.5 last:border-0 sm:col-span-2">
                  <dt className="text-sm text-[var(--muted)]">Client</dt>
                  <dd className="mt-1.5 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
                    {detail.status === "ACTIVE" && canWrite ? (
                      <>
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={detail.clientInformed}
                            disabled={saving}
                            onChange={(e) =>
                              void updateClientFlags(detail.id, {
                                clientInformed: e.target.checked,
                              })
                            }
                          />
                          <span>
                            Informed
                            {detail.clientInformed && detail.clientInformedAt
                              ? ` · ${formatDateTime(detail.clientInformedAt)}`
                              : ""}
                          </span>
                        </label>
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={detail.clientResponded}
                            disabled={saving}
                            onChange={(e) =>
                              void updateClientFlags(detail.id, {
                                clientResponded: e.target.checked,
                              })
                            }
                          />
                          <span>
                            Confirmed
                            {detail.clientResponded && detail.clientRespondedAt
                              ? ` · ${formatDateTime(detail.clientRespondedAt)}`
                              : ""}
                          </span>
                        </label>
                      </>
                    ) : (
                      <span>
                        {detail.clientInformed ? "Informed" : "Not informed"}
                        {detail.clientInformed && detail.clientInformedAt
                          ? ` · ${formatDateTime(detail.clientInformedAt)}`
                          : ""}
                        {" · "}
                        {detail.clientResponded ? "Confirmed" : "Not confirmed"}
                        {detail.clientResponded && detail.clientRespondedAt
                          ? ` · ${formatDateTime(detail.clientRespondedAt)}`
                          : ""}
                      </span>
                    )}
                  </dd>
                </div>
                {detail.jobDetails && (
                  <div className="border-b border-[var(--border)] py-2.5 last:border-0 sm:col-span-2">
                    <dt className="text-sm text-[var(--muted)]">Job details</dt>
                    <dd className="mt-0.5 whitespace-pre-wrap text-sm">{detail.jobDetails}</dd>
                  </div>
                )}
              </dl>
            </section>

            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                Charges
              </h3>
              <dl className="grid gap-x-8 sm:grid-cols-3">
                <DetailRow label="Charge">{formatGbp(detail.chargeGross)}</DetailRow>
                <DetailRow label="Paid">{formatGbp(detail.amountPaid)}</DetailRow>
                <DetailRow label="Balance due">
                  <span className={Number(detail.balanceDue) > 0 ? "font-semibold" : ""}>
                    {formatGbp(detail.balanceDue)}
                  </span>
                </DetailRow>
              </dl>
              {detail.payments.length > 0 && (
                <div className="mt-3 overflow-x-auto rounded-lg border border-[var(--border)]">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[var(--border)] bg-[var(--background)] text-left text-xs text-[var(--muted)]">
                        <th className="px-3 py-2 font-medium">Date</th>
                        <th className="px-3 py-2 font-medium">Amount</th>
                        <th className="px-3 py-2 font-medium">Method</th>
                        <th className="px-3 py-2 font-medium">Account</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.payments.map((p) => (
                        <tr key={p.id} className="border-b border-[var(--border)] last:border-0">
                          <td className="px-3 py-2">{p.valueDate}</td>
                          <td className="px-3 py-2 font-mono tabular-nums">{formatGbp(p.amount)}</td>
                          <td className="px-3 py-2">{p.method}</td>
                          <td className="px-3 py-2">{p.paymentAccountName}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                Record
              </h3>
              <dl className="grid gap-x-8 sm:grid-cols-2">
                <DetailRow label="Created by">{detail.createdByName ?? "—"}</DetailRow>
                <DetailRow label="Created at">{formatDateTime(detail.createdAt)}</DetailRow>
                {detail.completedAt && (
                  <>
                    <DetailRow label="Completed by">{detail.completedByName ?? "—"}</DetailRow>
                    <DetailRow label="Completed at">{formatDateTime(detail.completedAt)}</DetailRow>
                  </>
                )}
              </dl>
            </section>

            <section>
              <div className="mb-2 flex items-center justify-between gap-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                  Notes
                </h3>
                {canWrite &&
                  (detail.status === "PENDING" || detail.status === "ACTIVE") && (
                    <button
                      type="button"
                      onClick={openNotesModal}
                      className="text-xs font-medium text-accent hover:underline"
                    >
                      Add notes
                    </button>
                  )}
              </div>
              <div className="whitespace-pre-wrap rounded-lg border border-[var(--border)] bg-[var(--background)] p-3 text-sm">
                {detail.notes || (
                  <span className="text-[var(--muted)]">No notes yet</span>
                )}
              </div>
            </section>

            {detail.status === "PENDING" && canWrite && (
              <div className="flex flex-wrap gap-2 border-t border-[var(--border)] pt-4">
                <button
                  type="button"
                  onClick={() => openScheduleModalFromDetail(detail)}
                  className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-white"
                >
                  Add booking details
                </button>
                <button
                  type="button"
                  onClick={() => void openEditPending(detail.id)}
                  className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm font-medium"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => openFeeActionModal("cancel", detail)}
                  className="rounded-lg border border-red-300 px-3 py-1.5 text-sm text-red-700 dark:border-red-900 dark:text-red-400"
                >
                  Remove
                </button>
              </div>
            )}

            {detail.status === "ACTIVE" && canWrite && (
              <div className="flex flex-wrap gap-2 border-t border-[var(--border)] pt-4">
                {canPay && Number(detail.balanceDue) > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setPayAmount(detail.balanceDue);
                      setPayOpen(true);
                    }}
                    className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-white"
                  >
                    Record payment
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => openFeeActionModal("reschedule", detail)}
                  className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm font-medium"
                >
                  Reschedule
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const next =
                      calculateNextPcoExpiry(detail.vehicle.pcoExpiryDate) ??
                      detail.vehicle.pcoExpiryDate;
                    setNextExpiry(next);
                    setCompleteOpen(true);
                  }}
                  className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm font-medium"
                >
                  Complete booking
                </button>
                <button
                  type="button"
                  onClick={() => openFeeActionModal("cancel", detail)}
                  className="rounded-lg border border-red-300 px-3 py-1.5 text-sm text-red-700 dark:border-red-900 dark:text-red-400"
                >
                  Cancel booking
                </button>
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal title="Add booking details" open={scheduleOpen} onClose={() => setScheduleOpen(false)}>
        <form onSubmit={(e) => void scheduleBooking(e)} className="space-y-3">
          <p className="text-sm text-[var(--muted)]">
            Centre, date, time, and who pays for the TfL booking slot.
          </p>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--muted)]">
              Booking centre
            </label>
            <Select
              value={scheduleDraft.bookingCentreId}
              onChange={(v) => setScheduleDraft((d) => ({ ...d, bookingCentreId: v }))}
              options={
                centreOptions.length > 0
                  ? centreOptions
                  : [{ value: "", label: "Add a centre in Settings first" }]
              }
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--muted)]">
                Booking date
              </label>
              <input
                type="date"
                value={scheduleDraft.bookingDate}
                min={minBookingDateIso()}
                onChange={(e) => setScheduleDraft((d) => ({ ...d, bookingDate: e.target.value }))}
                className={inputClass}
                required
              />
              <p className="mt-1 text-xs text-[var(--muted)]">Must be a future date.</p>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Time (HH:mm)</label>
              <input
                value={scheduleDraft.bookingTime}
                onChange={(e) => setScheduleDraft((d) => ({ ...d, bookingTime: e.target.value }))}
                placeholder="14:30"
                pattern="\d{2}:\d{2}"
                className={inputClass}
                required
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--muted)]">
              Who pays for the booking slot?
            </label>
            <Select
              value={scheduleDraft.slotPaidBy}
              onChange={(v) =>
                setScheduleDraft((d) => ({
                  ...d,
                  slotPaidBy: v as PcoBookingSlotPaidBy,
                  slotCreditSourceBookingId:
                    v === "TFL_CREDIT" ? d.slotCreditSourceBookingId : "",
                }))
              }
              options={PCO_BOOKING_SLOT_PAID_BY_OPTIONS.filter(
                (m) => m !== "TFL_CREDIT" || slotCredits.length > 0,
              ).map((m) => ({
                value: m,
                label: PCO_BOOKING_SLOT_PAID_BY_LABEL[m],
              }))}
            />
            {scheduleDraft.slotPaidBy === "CUSTOMER" && (
              <p className="mt-1 text-xs text-[var(--muted)]">
                Customer pays the centre — no expense recorded for the garage.
              </p>
            )}
            {scheduleDraft.slotPaidBy === "NA" && (
              <p className="mt-1 text-xs text-[var(--muted)]">
                No booking slot fee applies for this appointment.
              </p>
            )}
            {scheduleDraft.slotPaidBy === "TFL_CREDIT" && (
              <p className="mt-1 text-xs text-[var(--muted)]">
                Uses a retained TfL slot fee from a cancelled booking — no new ledger expense.
              </p>
            )}
          </div>
          {scheduleDraft.slotPaidBy === "TFL_CREDIT" && (
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--muted)]">
                TfL credit
              </label>
              <Select
                value={scheduleDraft.slotCreditSourceBookingId}
                onChange={(v) =>
                  setScheduleDraft((d) => ({
                    ...d,
                    slotCreditSourceBookingId: v,
                    slotChargeGross:
                      slotCredits.find((c) => c.bookingId === v)?.amountGross ??
                      d.slotChargeGross,
                  }))
                }
                options={slotCredits.map((c) => ({
                  value: c.bookingId,
                  label: `${c.bookingNumber} — ${formatGbp(c.amountGross)}`,
                }))}
              />
            </div>
          )}
          {scheduleDraft.slotPaidBy === "US" && (
            <>
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--muted)]">
                  Paid from account
                </label>
                <Select
                  value={scheduleDraft.slotPaymentAccountId}
                  onChange={(v) =>
                    setScheduleDraft((d) => ({ ...d, slotPaymentAccountId: v }))
                  }
                  options={
                    accounts.length > 0
                      ? accounts.map((a) => ({ value: a.id, label: a.name }))
                      : [{ value: "", label: "Add a bank/cash account in Ledger first" }]
                  }
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--muted)]">
                  Slot expense amount (£)
                </label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={scheduleDraft.slotChargeGross}
                  onChange={(e) =>
                    setScheduleDraft((d) => ({ ...d, slotChargeGross: e.target.value }))
                  }
                  className={inputClass}
                  required
                />
                <p className="mt-1 text-xs text-[var(--muted)]">
                  Posted to the ledger as a PCO booking slot expense (default £
                  {PCO_DEFAULT_BOOKING_CHARGE}).
                </p>
              </div>
            </>
          )}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setScheduleOpen(false)}
              className="rounded-lg border px-4 py-2 text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || centreOptions.length === 0}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save booking details"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal title="Add notes" open={notesOpen} onClose={() => setNotesOpen(false)}>
        <form onSubmit={(e) => void saveNotes(e)} className="space-y-3">
          {detail?.notes ? (
            <div>
              <p className="mb-1 text-xs font-medium text-[var(--muted)]">Existing notes</p>
              <div className="max-h-40 overflow-y-auto whitespace-pre-wrap rounded-lg border border-[var(--border)] bg-[var(--background)] p-3 text-sm text-[var(--muted)]">
                {detail.notes}
              </div>
            </div>
          ) : null}
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--muted)]">New note</label>
            <textarea
              value={notesDraft}
              onChange={(e) => setNotesDraft(e.target.value)}
              rows={4}
              className={inputClass}
              placeholder="Write a new note…"
              autoFocus
              required
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setNotesOpen(false)}
              className="rounded-lg border px-4 py-2 text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !notesDraft.trim()}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {saving ? "Saving…" : "Add note"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal title="Record payment" open={payOpen} onClose={() => setPayOpen(false)}>
        <form onSubmit={(e) => void recordPayment(e)} className="space-y-3">
          <p className="text-sm text-[var(--muted)]">
            Posts income to the ledger with source <strong>PCO</strong> (no VAT).
          </p>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Amount</label>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={payAmount}
              onChange={(e) => setPayAmount(e.target.value)}
              className={inputClass}
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Account</label>
            <Select
              value={payAccountId}
              onChange={(id) => {
                setPayAccountId(id);
                const acc = accounts.find((a) => a.id === id);
                if (acc) setPayMethod(defaultPaymentMethodForAccount(acc.type));
              }}
              options={accounts.map((a) => ({ value: a.id, label: a.name }))}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Method</label>
            <Select
              value={payMethod}
              onChange={(v) => setPayMethod(v as PaymentMethod)}
              options={PAYMENT_METHOD_OPTIONS}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Date</label>
            <input
              type="date"
              value={payDate}
              onChange={(e) => setPayDate(e.target.value)}
              className={inputClass}
            />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setPayOpen(false)} className="rounded-lg border px-4 py-2 text-sm">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              Record
            </button>
          </div>
        </form>
      </Modal>

      <Modal title="Complete booking" open={completeOpen} onClose={() => setCompleteOpen(false)}>
        <p className="mb-3 text-sm text-[var(--muted)]">
          Moves this booking to past and updates the vehicle PCO expiry (default: previous expiry + 1
          year).
        </p>
        <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Next PCO expiry</label>
        <input
          type="date"
          value={nextExpiry}
          onChange={(e) => setNextExpiry(e.target.value)}
          className={inputClass}
        />
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={() => setCompleteOpen(false)} className="rounded-lg border px-4 py-2 text-sm">
            Cancel
          </button>
          <button
            type="button"
            disabled={saving || !nextExpiry}
            onClick={() => void completeBooking()}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            Complete
          </button>
        </div>
      </Modal>

      <Modal
        title="Add to To book"
        open={renewDueOpen}
        onClose={() => setRenewDueOpen(false)}
        size="lg"
      >
        {renewDueVehicle && (
          <form onSubmit={(e) => void submitRenewDue(e)} className="space-y-4">
            <p className="text-sm text-[var(--muted)]">
              Adding <strong>{formatRegistrationDisplay(renewDueVehicle.vrm)}</strong> (
              {PCO_JOB_TYPE_LABEL[renewJobType]}) to the To book list.
            </p>

            <label className="flex items-start gap-2 rounded-lg border border-[var(--border)] bg-[var(--background)] p-3 text-sm">
              <input
                type="checkbox"
                checked={renewClientConsent}
                onChange={(e) => setRenewClientConsent(e.target.checked)}
                className="mt-0.5"
                required
              />
              <span>
                The client has confirmed they are happy for us to process this PCO booking on their
                behalf.
              </span>
            </label>

            <div className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-3">
              <p className="mb-2 text-sm font-medium">Are the details in our system still correct?</p>
              <div className="mb-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => setRenewDetailsCorrect(true)}
                  className={`rounded-lg px-3 py-1.5 text-sm ${
                    renewDetailsCorrect === true
                      ? "bg-accent text-white"
                      : "border border-[var(--border)]"
                  }`}
                >
                  Yes, same details
                </button>
                <button
                  type="button"
                  onClick={() => setRenewDetailsCorrect(false)}
                  className={`rounded-lg px-3 py-1.5 text-sm ${
                    renewDetailsCorrect === false
                      ? "bg-accent text-white"
                      : "border border-[var(--border)]"
                  }`}
                >
                  No, update details
                </button>
              </div>

              {renewDetailsCorrect === true && (
                <dl className="grid gap-1 text-sm sm:grid-cols-2">
                  <DetailRow label="Keeper">{renewDraft.registeredKeeper}</DetailRow>
                  <DetailRow label="Client contact">{renewDraft.phone || "—"}</DetailRow>
                  <DetailRow label="PCO account number">
                    {renewDraft.pcoAccountPhone || "—"}
                  </DetailRow>
                  <DetailRow label="Email">{renewDraft.email || "—"}</DetailRow>
                  <DetailRow label="PCO expiry">{renewDraft.pcoExpiryDate}</DetailRow>
                  {(renewDraft.make || renewDraft.model) && (
                    <DetailRow label="Vehicle">
                      {[renewDraft.make, renewDraft.model].filter(Boolean).join(" ")}
                    </DetailRow>
                  )}
                </dl>
              )}

              {renewDetailsCorrect === false && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-xs font-medium text-[var(--muted)]">
                      Registered keeper
                    </label>
                    <input
                      value={renewDraft.registeredKeeper}
                      onChange={(e) =>
                        setRenewDraft((d) => ({ ...d, registeredKeeper: e.target.value }))
                      }
                      className={inputClass}
                      required
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[var(--muted)]">
                      Client contact number
                    </label>
                    <input
                      value={renewDraft.phone}
                      onChange={(e) => setRenewDraft((d) => ({ ...d, phone: e.target.value }))}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[var(--muted)]">
                      PCO account number
                    </label>
                    <input
                      value={renewDraft.pcoAccountPhone}
                      onChange={(e) =>
                        setRenewDraft((d) => ({ ...d, pcoAccountPhone: e.target.value }))
                      }
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Email</label>
                    <input
                      type="email"
                      value={renewDraft.email}
                      onChange={(e) => setRenewDraft((d) => ({ ...d, email: e.target.value }))}
                      className={inputClass}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Address</label>
                    <input
                      value={renewDraft.addressLine1}
                      onChange={(e) =>
                        setRenewDraft((d) => ({ ...d, addressLine1: e.target.value }))
                      }
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[var(--muted)]">City</label>
                    <input
                      value={renewDraft.city}
                      onChange={(e) => setRenewDraft((d) => ({ ...d, city: e.target.value }))}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Postcode</label>
                    <input
                      value={renewDraft.postcode}
                      onChange={(e) => setRenewDraft((d) => ({ ...d, postcode: e.target.value }))}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Make</label>
                    <input
                      value={renewDraft.make}
                      onChange={(e) => setRenewDraft((d) => ({ ...d, make: e.target.value }))}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Model</label>
                    <input
                      value={renewDraft.model}
                      onChange={(e) => setRenewDraft((d) => ({ ...d, model: e.target.value }))}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[var(--muted)]">PCO expiry</label>
                    <input
                      type="date"
                      value={renewDraft.pcoExpiryDate}
                      onChange={(e) =>
                        setRenewDraft((d) => ({ ...d, pcoExpiryDate: e.target.value }))
                      }
                      className={inputClass}
                      required
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[var(--muted)]">
                      First registration
                    </label>
                    <input
                      type="date"
                      value={renewDraft.firstRegistrationDate}
                      onChange={(e) =>
                        setRenewDraft((d) => ({ ...d, firstRegistrationDate: e.target.value }))
                      }
                      className={inputClass}
                      required
                    />
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Notes</label>
              <textarea
                value={renewDraft.notes}
                onChange={(e) => setRenewDraft((d) => ({ ...d, notes: e.target.value }))}
                rows={3}
                className={inputClass}
                placeholder="Any notes for this request…"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRenewDueOpen(false)}
                className="rounded-lg border px-4 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || !renewClientConsent || renewDetailsCorrect === null}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                Add to To book
              </button>
            </div>
          </form>
        )}
      </Modal>

      <Modal title="Edit request" open={editOpen} onClose={() => setEditOpen(false)} size="lg">
        <form onSubmit={(e) => void saveEditPending(e)} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--muted)]">
                Registered keeper
              </label>
              <input
                value={editDraft.registeredKeeper}
                onChange={(e) =>
                  setEditDraft((d) => ({ ...d, registeredKeeper: e.target.value }))
                }
                className={inputClass}
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Email</label>
              <input
                type="email"
                value={editDraft.email}
                onChange={(e) => setEditDraft((d) => ({ ...d, email: e.target.value }))}
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--muted)]">
                Client contact number
              </label>
              <input
                value={editDraft.phone}
                onChange={(e) => setEditDraft((d) => ({ ...d, phone: e.target.value }))}
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--muted)]">
                PCO account number
              </label>
              <input
                value={editDraft.pcoAccountPhone}
                onChange={(e) => setEditDraft((d) => ({ ...d, pcoAccountPhone: e.target.value }))}
                className={inputClass}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Address</label>
              <input
                value={editDraft.addressLine1}
                onChange={(e) => setEditDraft((d) => ({ ...d, addressLine1: e.target.value }))}
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--muted)]">City</label>
              <input
                value={editDraft.city}
                onChange={(e) => setEditDraft((d) => ({ ...d, city: e.target.value }))}
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Postcode</label>
              <input
                value={editDraft.postcode}
                onChange={(e) => setEditDraft((d) => ({ ...d, postcode: e.target.value }))}
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--muted)]">PCO expiry</label>
              <input
                type="date"
                value={editDraft.pcoExpiryDate}
                onChange={(e) => setEditDraft((d) => ({ ...d, pcoExpiryDate: e.target.value }))}
                className={inputClass}
              />
            </div>
          </div>

          <details className="rounded-lg border border-[var(--border)] p-3">
            <summary className="cursor-pointer text-sm font-medium">Vehicle details (optional)</summary>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Make</label>
                <input
                  value={editDraft.make}
                  onChange={(e) => setEditDraft((d) => ({ ...d, make: e.target.value }))}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Model</label>
                <input
                  value={editDraft.model}
                  onChange={(e) => setEditDraft((d) => ({ ...d, model: e.target.value }))}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Colour</label>
                <input
                  value={editDraft.color}
                  onChange={(e) => setEditDraft((d) => ({ ...d, color: e.target.value }))}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Fuel type</label>
                <Select
                  value={editDraft.fuelType}
                  onChange={(v) => setEditDraft((d) => ({ ...d, fuelType: v }))}
                  options={[
                    { value: "", label: "—" },
                    ...PCO_FUEL_TYPES.map((f) => ({ value: f, label: f })),
                  ]}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Seats</label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={editDraft.seatCount}
                  onChange={(e) => setEditDraft((d) => ({ ...d, seatCount: e.target.value }))}
                  className={inputClass}
                />
              </div>
            </div>
          </details>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Job type</label>
              <Select
                value={editDraft.jobType}
                onChange={(v) => setEditDraft((d) => ({ ...d, jobType: v as PcoJobType }))}
                options={PCO_JOB_TYPES.map((t) => ({ value: t, label: PCO_JOB_TYPE_LABEL[t] }))}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Priority</label>
              <Select
                value={editDraft.priority}
                onChange={(v) => setEditDraft((d) => ({ ...d, priority: v as PcoPriority }))}
                options={(["LOW", "MEDIUM", "HIGH"] as const).map((p) => ({
                  value: p,
                  label: PCO_PRIORITY_LABEL[p],
                }))}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--muted)]">
                Estimated customer charge (£)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={editDraft.chargeGross}
                onChange={(e) => setEditDraft((d) => ({ ...d, chargeGross: e.target.value }))}
                className={inputClass}
                placeholder="From last job if available"
              />
              <p className="mt-1 text-xs text-[var(--muted)]">
                Customer charge only — not the TfL slot fee (£{PCO_DEFAULT_BOOKING_CHARGE}).
              </p>
            </div>
          </div>

          {editDraft.jobType === "ADMIN" && (
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Job details</label>
              <textarea
                value={editDraft.jobDetails}
                onChange={(e) => setEditDraft((d) => ({ ...d, jobDetails: e.target.value }))}
                rows={3}
                className={inputClass}
              />
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Notes</label>
            <textarea
              value={editDraft.notes}
              onChange={(e) => setEditDraft((d) => ({ ...d, notes: e.target.value }))}
              rows={3}
              className={inputClass}
              placeholder="Any notes for this request…"
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setEditOpen(false)}
              className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!confirmDeleteCentre}
        title="Remove booking centre?"
        description={
          confirmDeleteCentre
            ? `"${confirmDeleteCentre.label}" will be removed from the list. Existing bookings that used this centre are unchanged.`
            : ""
        }
        confirmLabel="Remove"
        variant="danger"
        onConfirm={() => void removeCentre()}
        onCancel={() => setConfirmDeleteCentre(null)}
      />

      <Modal
        title={
          feeActionModal?.mode === "reschedule" ? "Reschedule booking?" : "Cancel booking?"
        }
        open={!!feeActionModal}
        onClose={() => setFeeActionModal(null)}
      >
        {feeActionModal && (
          <div className="space-y-4">
            <p className="text-sm text-[var(--muted)]">
              {feeActionModal.mode === "reschedule" ? (
                <>
                  <strong>{formatRegistrationDisplay(feeActionModal.booking.vehicle.vrm)}</strong> (
                  {feeActionModal.booking.bookingNumber}) will be cancelled and a new entry added to{" "}
                  <strong>To book</strong> for a new appointment.
                </>
              ) : (
                <>
                  <strong>{formatRegistrationDisplay(feeActionModal.booking.vehicle.vrm)}</strong> (
                  {feeActionModal.booking.bookingNumber}) will be marked cancelled. Payments already
                  recorded stay on the ledger.
                </>
              )}
            </p>
            {bookingHadActiveSlotFee(feeActionModal.booking) && (
              <div className="space-y-3 rounded-lg border border-[var(--border)] p-3">
                <p className="text-sm font-medium">Booking slot fee</p>
                <div className="space-y-2">
                  {(["RETAINED", "REFUND_REQUESTED"] as const).map((value) => (
                    <label key={value} className="flex cursor-pointer items-start gap-2 text-sm">
                      <input
                        type="radio"
                        name="slotFeeDisposition"
                        checked={slotFeeDisposition === value}
                        onChange={() => setSlotFeeDisposition(value)}
                        className="mt-0.5"
                      />
                      <span>{PCO_SLOT_FEE_DISPOSITION_LABEL[value]}</span>
                    </label>
                  ))}
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-[var(--muted)]">
                    Cancellation note
                  </label>
                  <textarea
                    value={cancellationNote}
                    onChange={(e) => setCancellationNote(e.target.value)}
                    rows={3}
                    className={inputClass}
                    placeholder="Required — e.g. TfL reference or reason for refund"
                  />
                </div>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setFeeActionModal(null)}
                className="rounded-lg border px-4 py-2 text-sm"
              >
                Back
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void submitFeeAction()}
                className={`rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 ${
                  feeActionModal.mode === "cancel" ? "bg-red-600" : "bg-accent"
                }`}
              >
                {saving
                  ? "Saving…"
                  : feeActionModal.mode === "reschedule"
                    ? "Reschedule"
                    : "Cancel booking"}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
