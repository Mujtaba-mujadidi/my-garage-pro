"use client";

import { UkNumberPlate } from "@/components/jobs/uk-number-plate";
import { useSession } from "@/components/providers/session-provider";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Modal } from "@/components/ui/modal";
import { SearchableTable, type TableColumn } from "@/components/ui/searchable-table";
import { Select } from "@/components/ui/select";
import { TabBar } from "@/components/ui/tab-bar";
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
  PcoVrmLookupDto,
} from "@mygaragepro/shared";
import {
  PCO_JOB_TYPE_LABEL,
  PCO_JOB_TYPES,
  PCO_PRIORITY_LABEL,
  PCO_BOOKING_STATUS_LABEL,
  calculateLogbookExpiryFromFirstRegistration,
  calculateNextPcoExpiry,
  defaultPaymentMethodForAccount,
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
  return new Date().toISOString().slice(0, 10);
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
    firstRegistrationDate: "",
    pcoExpiryDate: "",
    logbookExpiryDate: "",
    note: "",
    jobType: "RENEWAL" as PcoJobType,
    jobDetails: "",
    priority: "MEDIUM" as PcoPriority,
    chargeGross: "",
    bookingDate: "",
    bookingTime: "",
    bookingCentreId: "",
    clientInformed: false,
    clientResponded: false,
    bookingPaymentMethod: "" as PaymentMethod | "",
  };
}

export function PcoPageContent() {
  const { hasPermission } = useSession();
  const canWrite = hasPermission("pco.write");
  const canPay = canWrite && hasPermission("ledger.write");

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
  const [saving, setSaving] = useState(false);

  const [detail, setDetail] = useState<PcoBookingDto | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const [payOpen, setPayOpen] = useState(false);
  const [payAmount, setPayAmount] = useState("");
  const [payAccountId, setPayAccountId] = useState("");
  const [payMethod, setPayMethod] = useState<PaymentMethod>("BANK_TRANSFER");
  const [payDate, setPayDate] = useState(todayIso());

  const [completeOpen, setCompleteOpen] = useState(false);
  const [nextExpiry, setNextExpiry] = useState("");

  const [centreName, setCentreName] = useState("");
  const [confirmDeleteCentre, setConfirmDeleteCentre] = useState<PcoCentreDto | null>(null);
  const [confirmCancel, setConfirmCancel] = useState<PcoBookingDto | null>(null);

  const centreOptions = useMemo(
    () => [{ value: "", label: "No centre" }, ...centres.map((c) => ({ value: c.id, label: c.label }))],
    [centres],
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
      if (tab === "renewals_due" || tab === "logbook_due") {
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
    if (!canPay) return;
    void apiFetch<PaymentAccountDto[]>("/ledger/accounts")
      .then((a) => {
        setAccounts(a);
        if (a[0]) {
          setPayAccountId(a[0].id);
          setPayMethod(defaultPaymentMethodForAccount(a[0].type));
        }
      })
      .catch(() => []);
  }, [canPay]);

  async function lookupVrm(vrm: string) {
    const n = normalizeRegistration(vrm);
    if (n.length < 3) {
      setVrmHint(null);
      return;
    }
    try {
      const data = await apiFetch<PcoVrmLookupDto>(`/pco/lookup?vrm=${encodeURIComponent(n)}`);
      setVrmHint(data);
      if (data.activeVehicle) {
        const v = data.activeVehicle;
        setDraft((d) => ({
          ...d,
          registeredKeeper: v.registeredKeeper,
          addressLine1: v.addressLine1 ?? "",
          addressLine2: v.addressLine2 ?? "",
          city: v.city ?? "",
          postcode: v.postcode ?? "",
          email: v.email ?? "",
          phone: v.phone ?? "",
          firstRegistrationDate: v.firstRegistrationDate,
          pcoExpiryDate: v.pcoExpiryDate,
          logbookExpiryDate: v.logbookExpiryDate,
          note: v.note ?? "",
        }));
      }
    } catch {
      setVrmHint(null);
    }
  }

  function openCreate(prefill?: Partial<ReturnType<typeof emptyDraft>>) {
    setDraft({ ...emptyDraft(), ...prefill });
    setVrmHint(null);
    setModalOpen(true);
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
          firstRegistrationDate: draft.firstRegistrationDate,
          pcoExpiryDate: draft.pcoExpiryDate,
          logbookExpiryDate: logbook,
          note: draft.note || undefined,
          jobType: draft.jobType,
          jobDetails: draft.jobDetails || undefined,
          priority: draft.priority,
          chargeGross: draft.chargeGross ? Number(draft.chargeGross) : 0,
          bookingDate: draft.bookingDate || undefined,
          bookingTime: draft.bookingTime || undefined,
          bookingCentreId: draft.bookingCentreId || undefined,
          clientInformed: draft.clientInformed,
          clientResponded: draft.clientResponded,
          bookingPaymentMethod: draft.bookingPaymentMethod || undefined,
        }),
      });
      setModalOpen(false);
      setMessage("PCO booking created");
      setTab("active");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create booking");
    } finally {
      setSaving(false);
    }
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

  async function cancelBooking() {
    if (!confirmCancel) return;
    setSaving(true);
    try {
      await apiFetch(`/pco/bookings/${confirmCancel.id}/cancel`, { method: "POST" });
      setConfirmCancel(null);
      setDetailOpen(false);
      setMessage("Booking cancelled");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not cancel");
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
        header: "VRM",
        searchText: (r) => formatRegistrationDisplay(r.vrm),
        cell: (r) => <VrmText vrm={r.vrm} />,
      },
      {
        id: "keeper",
        header: "Keeper",
        searchText: (r) =>
          [r.registeredKeeper, r.email, r.phone, r.addressLine1, r.city, r.postcode]
            .filter(Boolean)
            .join(" "),
        cell: (r) => (
          <KeeperCell
            name={r.registeredKeeper}
            email={r.email}
            phone={r.phone}
            addressLine1={r.addressLine1}
            city={r.city}
            postcode={r.postcode}
          />
        ),
      },
      {
        id: "expiries",
        header: "Licence dates",
        searchText: (r) =>
          `${r.pcoExpiryDate} ${r.logbookExpiryDate} ${r.firstRegistrationDate}`,
        cell: (r) => (
          <div className="text-xs">
            <p>
              <span className="text-[var(--muted)]">PCO </span>
              {r.pcoExpiryDate}
            </p>
            <p>
              <span className="text-[var(--muted)]">Logbook </span>
              {r.logbookExpiryDate}
            </p>
            <p className="text-[var(--muted)]">1st reg {r.firstRegistrationDate}</p>
          </div>
        ),
      },
      {
        id: "job",
        header: "Job",
        searchText: (r) => `${r.bookingNumber} ${PCO_JOB_TYPE_LABEL[r.jobType]}`,
        cell: (r) => (
          <div>
            <p>{PCO_JOB_TYPE_LABEL[r.jobType]}</p>
            <p className="text-xs text-[var(--muted)]">
              {r.bookingNumber} · {PCO_PRIORITY_LABEL[r.priority]}
            </p>
          </div>
        ),
      },
      {
        id: "booking",
        header: "Appointment",
        cell: (r) =>
          r.bookingDate ? (
            <div className="text-sm">
              <p>
                {r.bookingDate}
                {r.bookingTime ? ` ${r.bookingTime}` : ""}
              </p>
              {r.bookingCentreName && (
                <p className="text-xs text-[var(--muted)]">{r.bookingCentreName}</p>
              )}
            </div>
          ) : (
            "—"
          ),
      },
      {
        id: "charge",
        header: "Charge / paid",
        align: "right",
        cell: (r) => (
          <div className="text-right tabular-nums">
            <div>{formatGbp(r.chargeGross)}</div>
            <div className="text-xs text-[var(--muted)]">
              {Number(r.balanceDue) > 0 ? `${formatGbp(r.balanceDue)} due` : "Paid"}
            </div>
          </div>
        ),
      },
      {
        id: "flags",
        header: "Client",
        cell: (r) => (
          <span className="text-xs text-[var(--muted)]">
            {r.clientInformed ? "Informed" : "Not informed"}
            {r.clientResponded ? " · Responded" : ""}
          </span>
        ),
      },
      {
        id: "actions",
        header: "",
        align: "right",
        cell: (r) => (
          <button
            type="button"
            onClick={() => void openDetail(r.id)}
            className="text-sm font-medium text-accent"
          >
            Open
          </button>
        ),
      },
    ];
    return cols;
  }, []);

  const dueColumns: TableColumn<PcoDueVehicleDto>[] = useMemo(
    () => [
      {
        id: "vrm",
        header: "VRM",
        searchText: (r) => formatRegistrationDisplay(r.vrm),
        cell: (r) => <VrmText vrm={r.vrm} />,
      },
      {
        id: "keeper",
        header: "Keeper",
        searchText: (r) =>
          [r.registeredKeeper, r.email, r.phone, r.addressLine1, r.city, r.postcode]
            .filter(Boolean)
            .join(" "),
        cell: (r) => (
          <KeeperCell
            name={r.registeredKeeper}
            email={r.email}
            phone={r.phone}
            addressLine1={r.addressLine1}
            city={r.city}
            postcode={r.postcode}
          />
        ),
      },
      {
        id: "expiries",
        header: "Licence dates",
        cell: (r) => (
          <div className="text-xs">
            {tab === "renewals_due" && r.pcoExpiryDate && (
              <p>
                <span className="text-[var(--muted)]">PCO </span>
                {r.pcoExpiryDate}
              </p>
            )}
            {tab === "logbook_due" && (
              <p>
                <span className="text-[var(--muted)]">Logbook </span>
                {r.logbookExpiryDate}
              </p>
            )}
            <p className="text-[var(--muted)]">1st reg {r.firstRegistrationDate}</p>
          </div>
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
            <span>
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
              cell: (r: PcoDueVehicleDto) => (
                <button
                  type="button"
                  onClick={() =>
                    openCreate({
                      vrm: r.vrm,
                      registeredKeeper: r.registeredKeeper,
                      email: r.email ?? "",
                      phone: r.phone ?? "",
                      addressLine1: r.addressLine1 ?? "",
                      city: r.city ?? "",
                      postcode: r.postcode ?? "",
                      firstRegistrationDate: r.firstRegistrationDate,
                      pcoExpiryDate: r.pcoExpiryDate ?? "",
                      logbookExpiryDate: r.logbookExpiryDate,
                      jobType: tab === "renewals_due" ? "RENEWAL" : "LOGBOOK_EXPIRING",
                    })
                  }
                  className="text-sm font-medium text-accent"
                >
                  New booking
                </button>
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
            Private-hire licensing admin — payments post to ledger as PCO income (no VAT).
          </p>
        </div>
        {canWrite && tab !== "settings" && (
          <button
            type="button"
            onClick={() => openCreate()}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white"
          >
            New PCO booking
          </button>
        )}
      </div>

      {message && <p className="mb-3 text-sm text-green-700 dark:text-green-400">{message}</p>}
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      <TabBar
        tabs={[
          { id: "active", label: "Active" },
          { id: "past", label: "Past" },
          { id: "renewals_due", label: "Renewals due" },
          { id: "logbook_due", label: "Logbook due" },
          ...(canWrite ? [{ id: "settings" as const, label: "Centres" }] : []),
        ]}
        active={tab}
        onChange={(t) => setTab(t as TabId)}
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
      ) : tab === "renewals_due" || tab === "logbook_due" ? (
        <SearchableTable
          rows={dueRows}
          columns={dueColumns}
          getRowId={(r) => r.vehicleId}
          searchPlaceholder="Search keeper or VRM…"
          emptyLabel="No vehicles due in the next 30 days"
        />
      ) : (
        <SearchableTable
          rows={rows}
          columns={bookingColumns}
          getRowId={(r) => r.id}
          searchPlaceholder="Search VRM, keeper, booking no…"
          emptyLabel={tab === "past" ? "No past bookings" : "No active bookings"}
          minWidth="72rem"
        />
      )}

      <Modal title="New PCO booking" open={modalOpen} onClose={() => setModalOpen(false)} size="lg">
        <form onSubmit={(e) => void saveBooking(e)} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--muted)]">VRM</label>
              <input
                value={draft.vrm}
                onChange={(e) => {
                  const v = normalizeRegistration(e.target.value);
                  setDraft((d) => ({ ...d, vrm: v }));
                }}
                onBlur={() => void lookupVrm(draft.vrm)}
                className={`${inputClass} font-mono uppercase`}
                required
              />
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
              <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Phone</label>
              <input
                value={draft.phone}
                onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value }))}
                className={inputClass}
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
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Job type</label>
              <Select
                value={draft.jobType}
                onChange={(v) => setDraft((d) => ({ ...d, jobType: v as PcoJobType }))}
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
              <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Charge (£)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={draft.chargeGross}
                onChange={(e) => setDraft((d) => ({ ...d, chargeGross: e.target.value }))}
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--muted)]">
                Booking centre
              </label>
              <Select
                value={draft.bookingCentreId}
                onChange={(v) => setDraft((d) => ({ ...d, bookingCentreId: v }))}
                options={centreOptions}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--muted)]">
                Booking date
              </label>
              <input
                type="date"
                value={draft.bookingDate}
                onChange={(e) => setDraft((d) => ({ ...d, bookingDate: e.target.value }))}
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Time (HH:mm)</label>
              <input
                value={draft.bookingTime}
                onChange={(e) => setDraft((d) => ({ ...d, bookingTime: e.target.value }))}
                placeholder="14:30"
                pattern="\d{2}:\d{2}"
                className={inputClass}
              />
            </div>
          </div>

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

          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={draft.clientInformed}
                onChange={(e) => setDraft((d) => ({ ...d, clientInformed: e.target.checked }))}
              />
              Client informed
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={draft.clientResponded}
                onChange={(e) => setDraft((d) => ({ ...d, clientResponded: e.target.checked }))}
              />
              Client responded
            </label>
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
              {saving ? "Saving…" : "Create booking"}
            </button>
          </div>
        </form>
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
                  detail.status === "ACTIVE"
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
                <DetailRow label="Phone">{detail.vehicle.phone ?? "—"}</DetailRow>
                <DetailRow label="Email">{detail.vehicle.email ?? "—"}</DetailRow>
                <DetailRow label="Address">{formatKeeperAddress(detail.vehicle)}</DetailRow>
                <DetailRow label="First registration">{detail.vehicle.firstRegistrationDate}</DetailRow>
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
                    : "—"}
                </DetailRow>
                <DetailRow label="Centre">{detail.bookingCentreName ?? "—"}</DetailRow>
                <DetailRow label="Payment method at booking">
                  {detail.bookingPaymentMethod ?? "—"}
                </DetailRow>
                <DetailRow label="Client informed">
                  {detail.clientInformed
                    ? detail.clientInformedAt
                      ? `Yes · ${formatDateTime(detail.clientInformedAt)}`
                      : "Yes"
                    : "No"}
                </DetailRow>
                <DetailRow label="Client responded">
                  {detail.clientResponded
                    ? detail.clientRespondedAt
                      ? `Yes · ${formatDateTime(detail.clientRespondedAt)}`
                      : "Yes"
                    : "No"}
                </DetailRow>
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
                  onClick={() => setConfirmCancel(detail)}
                  className="rounded-lg border border-red-300 px-3 py-1.5 text-sm text-red-700 dark:border-red-900 dark:text-red-400"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        )}
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

      <ConfirmDialog
        open={!!confirmCancel}
        title="Cancel booking?"
        description="This booking will be marked cancelled. Payments already recorded stay on the ledger."
        confirmLabel="Cancel booking"
        variant="danger"
        onConfirm={() => void cancelBooking()}
        onCancel={() => setConfirmCancel(null)}
      />
    </div>
  );
}
