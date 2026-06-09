"use client";

import {
  CustomerForm,
  emptyDraft,
  type DraftCustomer,
} from "@/components/customers/customer-form";
import { JobVehicleFields } from "@/components/jobs/job-vehicle-fields";
import { useSession } from "@/components/providers/session-provider";
import { Modal } from "@/components/ui/modal";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { SearchableTable, type TableColumn } from "@/components/ui/searchable-table";
import { apiFetch, ApiError } from "@/lib/api-client";
import { buildCustomerPayload } from "@/lib/customer-payload";
import type {
  CustomerDto,
  RepairJobListDto,
  RepairJobSource,
  RepairJobStatus,
} from "@mygaragepro/shared";
import {
  REPAIR_JOB_SOURCE_LABEL,
  REPAIR_JOB_STATUS_LABEL,
  isWorkshopStaffView,
} from "@mygaragepro/shared";
import { useMounted } from "@/lib/use-mounted";
import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

const inputClass =
  "w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm";

type WorkScope = "all" | "mine" | "available";

function tasksDoneCell(r: RepairJobListDto) {
  if (r.taskCount === 0) return <span className="text-[var(--muted)]">—</span>;
  const completed = r.completedTaskCount ?? 0;
  const allDone = completed >= r.taskCount;
  return (
    <span
      className={
        allDone ? "font-medium text-green-700 dark:text-green-400" : "text-[var(--foreground)]"
      }
    >
      {completed}/{r.taskCount}
    </span>
  );
}

function statusChip(status: RepairJobStatus) {
  const tone =
    status === "COMPLETED"
      ? "bg-green-100 text-green-800 dark:bg-green-950/50 dark:text-green-300"
      : status === "CANCELLED"
        ? "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300"
        : status === "AWAITING_VEHICLE"
          ? "bg-violet-100 text-violet-900 dark:bg-violet-950/50 dark:text-violet-200"
          : status === "AWAITING_PARTS"
            ? "bg-orange-100 text-orange-900 dark:bg-orange-950/50 dark:text-orange-200"
            : status === "ON_HOLD"
              ? "bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200"
              : status === "IN_PROGRESS" || status === "READY"
                ? "bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200"
                : status === "TESTING"
                  ? "bg-cyan-100 text-cyan-900 dark:bg-cyan-950/50 dark:text-cyan-200"
                  : "bg-[var(--background)] text-[var(--foreground)]";
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${tone}`}>
      {REPAIR_JOB_STATUS_LABEL[status]}
    </span>
  );
}

function formatDateGb(iso: string) {
  const d = new Date(iso);
  const day = String(d.getUTCDate()).padStart(2, "0");
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const year = d.getUTCFullYear();
  return `${day}/${month}/${year}`;
}

export function RepairPageContent() {
  const mounted = useMounted();
  const { session, hasPermission } = useSession();
  const canWrite = hasPermission("repair.write");
  const canChargeVat = Boolean(session?.garage?.vatNumber?.trim());
  const canCreateCustomer = hasPermission("customers.write");
  const isWorkView =
    mounted &&
    isWorkshopStaffView(
      session?.permissions ?? [],
      "repair",
    );

  const [jobs, setJobs] = useState<RepairJobListDto[]>([]);
  const [customers, setCustomers] = useState<CustomerDto[]>([]);
  const [workScope, setWorkScope] = useState<WorkScope>("all");
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [customerDraft, setCustomerDraft] = useState<DraftCustomer>(emptyDraft());
  const [customerSaving, setCustomerSaving] = useState(false);
  const [customerNotice, setCustomerNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [customerId, setCustomerId] = useState("");
  const [vehicleRegistration, setVehicleRegistration] = useState("");
  const [vehicleMake, setVehicleMake] = useState("");
  const [vehicleModel, setVehicleModel] = useState("");
  const [customerConcern, setCustomerConcern] = useState("");
  const [source, setSource] = useState<RepairJobSource>("CUSTOMER");
  const [vatEnabled, setVatEnabled] = useState(true);

  const load = useCallback(async () => {
    setError("");
    const params = new URLSearchParams();
    if (isWorkView && workScope !== "all") params.set("scope", workScope);
    const qs = params.toString();
    const data = await apiFetch<RepairJobListDto[]>(`/repair-jobs${qs ? `?${qs}` : ""}`);
    setJobs(data);
  }, [isWorkView, workScope]);

  useEffect(() => {
    void load().catch((err) =>
      setError(err instanceof ApiError ? err.message : "Could not load repair jobs"),
    );
  }, [load]);

  useEffect(() => {
    if (!canWrite) return;
    void apiFetch<CustomerDto[]>("/customers")
      .then(setCustomers)
      .catch(() => setCustomers([]));
  }, [canWrite]);

  function resetVehicleFields() {
    setVehicleRegistration("");
    setVehicleMake("");
    setVehicleModel("");
  }

  function selectCustomer(id: string) {
    setCustomerId(id);
    resetVehicleFields();
  }

  const customerOptions = useMemo(
    () => customers.map((c) => ({ value: c.id, label: c.displayName })),
    [customers],
  );

  function openNewCustomerModal() {
    setCustomerNotice("");
    setCustomerDraft({
      ...emptyDraft(),
      registration: vehicleRegistration,
      make: vehicleMake,
      model: vehicleModel,
    });
    setCustomerModalOpen(true);
  }

  async function saveNewCustomer(e: FormEvent) {
    e.preventDefault();
    if (!customerDraft.email.trim()) {
      setCustomerNotice("Email is required — it identifies walk-in customers and avoids duplicates.");
      return;
    }
    setCustomerSaving(true);
    setCustomerNotice("");
    try {
      const customer = await apiFetch<CustomerDto>("/customers", {
        method: "POST",
        body: JSON.stringify(buildCustomerPayload(customerDraft, false)),
      });
      setCustomers((prev) =>
        [...prev, customer].sort((a, b) => a.displayName.localeCompare(b.displayName)),
      );
      setCustomerId(customer.id);
      if (customer.vehicles.length > 0) {
        const vehicle = customer.vehicles[0];
        setVehicleRegistration(vehicle.registration);
        setVehicleMake(vehicle.make ?? "");
        setVehicleModel(vehicle.model ?? "");
      } else if (customerDraft.registration.trim()) {
        setVehicleRegistration(customerDraft.registration);
        setVehicleMake(customerDraft.make);
        setVehicleModel(customerDraft.model);
      } else {
        resetVehicleFields();
      }
      setCustomerModalOpen(false);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        const refreshed = await apiFetch<CustomerDto[]>("/customers").catch(() => customers);
        setCustomers(refreshed);
        const email = customerDraft.email.trim().toLowerCase();
        const existing = refreshed.find((c) => c.email?.toLowerCase() === email);
        if (existing) {
          selectCustomer(existing.id);
          setCustomerModalOpen(false);
          setCustomerNotice(`Selected existing customer ${existing.displayName}.`);
          return;
        }
      }
      setCustomerNotice(err instanceof ApiError ? err.message : "Could not save customer");
    } finally {
      setCustomerSaving(false);
    }
  }

  async function createJob(e: FormEvent) {
    e.preventDefault();
    if (!customerId) {
      setError("Select a customer.");
      return;
    }
    if (!vehicleRegistration.trim()) {
      setError("Select a vehicle or enter registration for a new vehicle.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const job = await apiFetch<RepairJobListDto>("/repair-jobs", {
        method: "POST",
        body: JSON.stringify({
          customerId,
          source,
          vehicleRegistration: vehicleRegistration.trim(),
          vehicleMake: vehicleMake.trim() || undefined,
          vehicleModel: vehicleModel.trim() || undefined,
          customerConcern: customerConcern.trim() || undefined,
          ...(canChargeVat ? { vatEnabled } : { vatEnabled: false }),
        }),
      });
      setModalOpen(false);
      window.location.href = `/repair/${job.id}`;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create job");
    } finally {
      setSaving(false);
    }
  }

  const columns: TableColumn<RepairJobListDto>[] = useMemo(() => {
    if (isWorkView) {
      return [
        {
          id: "job",
          header: "Job",
          searchText: (r) =>
            `${r.jobNumber} ${r.customerName} ${r.vehicleRegistration ?? ""} ${r.customerConcern ?? ""}`,
          cell: (r) => (
            <div>
              <Link href={`/repair/${r.id}`} className="font-medium text-accent hover:underline">
                {r.jobNumber}
              </Link>
              <p className="text-xs text-[var(--muted)]">
                {r.customerName}
                {r.vehicleLabel ? ` · ${r.vehicleLabel}` : ""}
              </p>
            </div>
          ),
        },
        {
          id: "status",
          header: "Status",
          searchText: (r) => REPAIR_JOB_STATUS_LABEL[r.status],
          cell: (r) => statusChip(r.status),
        },
        {
          id: "tasksDone",
          header: "Tasks done",
          align: "right",
          cell: (r) => tasksDoneCell(r),
        },
        {
          id: "myTasks",
          header: "My tasks",
          align: "right",
          cell: (r) => r.myTaskCount ?? 0,
        },
        {
          id: "available",
          header: "To claim",
          align: "right",
          cell: (r) => r.availableTaskCount ?? 0,
        },
        {
          id: "updated",
          header: "Updated",
          cell: (r) => formatDateGb(r.updatedAt),
        },
      ];
    }

    return [
      {
        id: "job",
        header: "Job",
        searchText: (r) =>
          `${r.jobNumber} ${r.customerName} ${r.vehicleRegistration ?? ""} ${r.customerConcern ?? ""}`,
        cell: (r) => (
          <div>
            <Link href={`/repair/${r.id}`} className="font-medium text-accent hover:underline">
              {r.jobNumber}
            </Link>
            <p className="text-xs text-[var(--muted)]">
              {r.customerName}
              {r.vehicleLabel ? ` · ${r.vehicleLabel}` : ""}
            </p>
          </div>
        ),
      },
      {
        id: "status",
        header: "Status",
        searchText: (r) => REPAIR_JOB_STATUS_LABEL[r.status],
        cell: (r) => statusChip(r.status),
      },
      {
        id: "tasksDone",
        header: "Tasks done",
        align: "right",
        cell: (r) => tasksDoneCell(r),
      },
      {
        id: "invoice",
        header: "Invoice",
        searchText: (r) =>
          `${r.invoiceNumber ?? ""} ${r.invoiceInSync === false ? "out of date" : ""}`,
        cell: (r) =>
          r.invoiceNumber ? (
            <div>
              <span>{r.invoiceNumber}</span>
              {r.invoiceInSync === false && (
                <span className="mt-0.5 block text-xs font-medium text-amber-700 dark:text-amber-300">
                  Invoice out of date
                </span>
              )}
            </div>
          ) : (
            "—"
          ),
      },
      {
        id: "updated",
        header: "Updated",
        cell: (r) => new Date(r.updatedAt).toLocaleDateString("en-GB"),
      },
    ];
  }, [isWorkView]);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{isWorkView ? "My workshop jobs" : "Repair jobs"}</h1>
          <p className="text-sm text-[var(--muted)]">
            {isWorkView
              ? "Tasks assigned to you and approved jobs you can pick up."
              : "Job cards from intake through quote, workshop, and invoice."}
          </p>
        </div>
        {canWrite && (
          <button
            type="button"
            onClick={() => {
              setCustomerId("");
              setVehicleRegistration("");
              setVehicleMake("");
              setVehicleModel("");
              setCustomerConcern("");
              setSource("CUSTOMER");
              setVatEnabled(canChargeVat);
              setModalOpen(true);
            }}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white"
          >
            New repair job
          </button>
        )}
      </div>

      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      {isWorkView && (
        <div className="mb-4 flex flex-wrap gap-2">
          {(
            [
              { value: "all", label: "All" },
              { value: "mine", label: "My tasks" },
              { value: "available", label: "Available to claim" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setWorkScope(tab.value)}
              className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${
                workScope === tab.value
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-[var(--border)] hover:bg-[var(--background)]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      <SearchableTable<RepairJobListDto>
        columns={columns}
        rows={jobs}
        getRowId={(r) => r.id}
        searchPlaceholder="Job number, customer, reg…"
        countLabel={(f, t) => `${f} of ${t} jobs`}
        emptyLabel={isWorkView ? "No jobs in your workshop queue" : "No repair jobs yet"}
      />

      {canWrite && (
        <Modal title="New repair job" open={modalOpen} onClose={() => setModalOpen(false)} size="lg" fixedHeight>
          <form onSubmit={(e) => void createJob(e)} className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
            <div>
              <div className="mb-1 flex items-center justify-between gap-2">
                <label className="text-xs font-medium text-[var(--muted)]">Customer</label>
                {canCreateCustomer && (
                  <button
                    type="button"
                    onClick={openNewCustomerModal}
                    className="text-xs font-medium text-accent hover:underline"
                  >
                    New customer
                  </button>
                )}
              </div>
              <SearchableSelect
                value={customerId}
                onChange={selectCustomer}
                options={customerOptions}
                placeholder="Select customer…"
                searchPlaceholder="Search customers…"
                aria-label="Customer"
              />
              {customerNotice && (
                <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">{customerNotice}</p>
              )}
              <p className="mt-1 text-xs text-[var(--muted)]">
                {canCreateCustomer ? (
                  <>
                    Walk-in? Use <span className="font-medium">New customer</span> — email is required
                    so we do not create duplicates.
                  </>
                ) : (
                  <>
                    Customer must exist first.{" "}
                    <Link href="/customers" className="text-accent hover:underline">
                      Add in Customers
                    </Link>
                  </>
                )}
              </p>
            </div>
            <JobVehicleFields
              customerId={customerId}
              registration={vehicleRegistration}
              make={vehicleMake}
              model={vehicleModel}
              onRegistrationChange={setVehicleRegistration}
              onMakeChange={setVehicleMake}
              onModelChange={setVehicleModel}
            />
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Job source</label>
              <select
                value={source}
                onChange={(e) => setSource(e.target.value as RepairJobSource)}
                className={inputClass}
              >
                {Object.entries(REPAIR_JOB_SOURCE_LABEL).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Customer concern</label>
              <textarea
                value={customerConcern}
                onChange={(e) => setCustomerConcern(e.target.value)}
                rows={3}
                className={inputClass}
                placeholder="What is the customer reporting?"
              />
            </div>
            {canChargeVat ? (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={vatEnabled}
                  onChange={(e) => setVatEnabled(e.target.checked)}
                  className="h-4 w-4 rounded border border-[var(--border)]"
                />
                Charge VAT on this job (20% on tasks and invoice)
              </label>
            ) : (
              <p className="text-xs text-[var(--muted)]">
                VAT is not available — this garage has no VAT registration number.
              </p>
            )}
            </div>
            <div className="flex shrink-0 justify-end gap-2 border-t border-[var(--border)] pt-3">
              <button type="button" onClick={() => setModalOpen(false)} className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm">
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || !customerId || !vehicleRegistration.trim()}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {saving ? "Creating…" : "Create job"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {canCreateCustomer && (
        <Modal
          title="New customer"
          open={customerModalOpen}
          onClose={() => setCustomerModalOpen(false)}
          size="lg"
          autoHeight
        >
          {customerNotice && !customerSaving && (
            <p className="mb-3 text-sm text-red-600">{customerNotice}</p>
          )}
          <CustomerForm
            draft={customerDraft}
            setDraft={setCustomerDraft}
            saving={customerSaving}
            onSubmit={(e) => void saveNewCustomer(e)}
            onCancel={() => setCustomerModalOpen(false)}
            emailRequired
          />
        </Modal>
      )}
    </div>
  );
}
