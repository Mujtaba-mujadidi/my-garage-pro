"use client";

import { RecordPaymentModal } from "@/components/invoices/record-payment-modal";
import { useSession } from "@/components/providers/session-provider";
import { Modal } from "@/components/ui/modal";
import {
  STICKY_TABLE_HEAD_CLASS,
  TABLE_SCROLL_COMPACT_MAX_HEIGHT,
  TableScroll,
} from "@/components/ui/table-scroll";
import { TableRowActionsMenu } from "@/components/ui/table-row-actions-menu";
import { apiFetch, ApiError, downloadAuthenticatedPdf } from "@/lib/api-client";
import { normalizeRegistration } from "@/lib/vehicle-registration";
import type {
  CustomerBalanceDto,
  CustomerDto,
  InvoiceDto,
  InvoiceStatus,
  RepairJobListDto,
  RepairJobStatus,
} from "@mygaragepro/shared";
import { REPAIR_JOB_STATUS_LABEL, formatDateTimeUk, formatDateUk } from "@mygaragepro/shared";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

const PAST_JOB_STATUSES: RepairJobStatus[] = ["COMPLETED", "CANCELLED"];

const INVOICE_STATUS_LABEL: Record<InvoiceStatus, string> = {
  DRAFT: "Draft",
  SENT: "Sent",
  PART_PAID: "Part paid",
  PAID: "Paid",
  CANCELLED: "Cancelled",
};

function formatMoney(value: string) {
  const n = Number(value);
  if (Number.isNaN(n)) return value;
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(n);
}

function jobStatusChip(status: RepairJobStatus) {
  const label = REPAIR_JOB_STATUS_LABEL[status];
  const tone =
    status === "COMPLETED"
      ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200"
      : status === "CANCELLED"
        ? "bg-[var(--background)] text-[var(--muted)]"
        : "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200";
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${tone}`}>
      {label}
    </span>
  );
}

function tasksDoneCell(job: RepairJobListDto) {
  return (
    <span className="tabular-nums">
      {job.completedTaskCount}/{job.taskCount}
    </span>
  );
}

type Props = { customerId: string };

export function CustomerDetailContent({ customerId }: Props) {
  const router = useRouter();
  const { hasPermission, session } = useSession();
  const hasRepair =
    (session?.enabledModules.includes("repair") ?? false) && hasPermission("repair.read");
  const hasInvoices =
    (session?.enabledModules.includes("invoices") ?? false) && hasPermission("invoices.read");
  const canRecordPayment = hasInvoices && hasPermission("invoices.write");

  const [customer, setCustomer] = useState<CustomerDto | null>(null);
  const [jobs, setJobs] = useState<RepairJobListDto[]>([]);
  const [invoices, setInvoices] = useState<InvoiceDto[]>([]);
  const [balance, setBalance] = useState<CustomerBalanceDto | null>(null);
  const [error, setError] = useState("");
  const [newReg, setNewReg] = useState("");
  const [newMake, setNewMake] = useState("");
  const [newModel, setNewModel] = useState("");
  const [addingVehicle, setAddingVehicle] = useState(false);
  const [viewInvoice, setViewInvoice] = useState<InvoiceDto | null>(null);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [message, setMessage] = useState("");

  const loadCustomer = useCallback(async () => {
    const data = await apiFetch<CustomerDto>(`/customers/${customerId}`);
    setCustomer(data);
  }, [customerId]);

  const loadRelated = useCallback(async () => {
    const fetches: Promise<void>[] = [];
    if (hasRepair) {
      fetches.push(
        apiFetch<RepairJobListDto[]>(`/repair-jobs?customerId=${customerId}`)
          .then(setJobs)
          .catch(() => setJobs([])),
      );
    }
    if (hasInvoices) {
      fetches.push(
        apiFetch<InvoiceDto[]>(`/invoices?customerId=${customerId}`)
          .then(setInvoices)
          .catch(() => setInvoices([])),
      );
      fetches.push(
        apiFetch<CustomerBalanceDto>(`/invoices/customers/${customerId}/balance`)
          .then(setBalance)
          .catch(() => setBalance(null)),
      );
    }
    await Promise.all(fetches);
  }, [customerId, hasRepair, hasInvoices]);

  useEffect(() => {
    void loadCustomer()
      .then(() => loadRelated())
      .catch(() => setError("Customer not found"));
  }, [loadCustomer, loadRelated]);

  const activeJobs = useMemo(
    () => jobs.filter((j) => !PAST_JOB_STATUSES.includes(j.status)),
    [jobs],
  );
  const pastJobs = useMemo(
    () => jobs.filter((j) => PAST_JOB_STATUSES.includes(j.status)),
    [jobs],
  );
  const unpaidInvoices = useMemo(
    () => invoices.filter((i) => i.status === "SENT" || i.status === "PART_PAID"),
    [invoices],
  );
  const hasBalanceDue = useMemo(
    () => balance !== null && Number(balance.balanceDue) > 0.009,
    [balance],
  );

  async function handleDelete() {
    if (!confirm("Archive this customer?")) return;
    try {
      await apiFetch(`/customers/${customerId}`, { method: "DELETE" });
      router.push("/customers");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Delete failed");
    }
  }

  async function handleRestore() {
    try {
      await apiFetch(`/customers/${customerId}/restore`, { method: "POST" });
      await loadCustomer();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Restore failed");
    }
  }

  async function addVehicle() {
    if (!newReg.trim()) return;
    setAddingVehicle(true);
    setError("");
    try {
      await apiFetch(`/customers/${customerId}/vehicles`, {
        method: "POST",
        body: JSON.stringify({
          registration: normalizeRegistration(newReg),
          make: newMake.trim() || undefined,
          model: newModel.trim() || undefined,
        }),
      });
      setNewReg("");
      setNewMake("");
      setNewModel("");
      await loadCustomer();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not add vehicle");
    } finally {
      setAddingVehicle(false);
    }
  }

  async function handleDownloadPdf(invoice: InvoiceDto) {
    try {
      await downloadAuthenticatedPdf(invoice.id, `${invoice.invoiceNumber}.pdf`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not download PDF");
    }
  }

  if (!customer) {
    return <p className="text-sm text-[var(--muted)]">{error || "Loading…"}</p>;
  }

  const canRestore = customer.deletedAt && hasPermission("customers.write");

  return (
    <>
      <p className="mb-2 text-xs text-[var(--muted)]">
        <Link href="/customers" className="hover:text-accent">
          Customers
        </Link>{" "}
        / <span className="text-accent">{customer.displayName}</span>
      </p>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <h1 className="text-2xl font-bold">{customer.displayName}</h1>
        <div className="flex flex-wrap gap-2">
          {hasPermission("customers.write") && !customer.deletedAt && (
            <button
              type="button"
              onClick={() => void handleDelete()}
              className="rounded-lg border border-red-300 px-3 py-1.5 text-sm text-red-600"
            >
              Archive
            </button>
          )}
          {canRestore && (
            <button
              type="button"
              onClick={() => void handleRestore()}
              className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white"
            >
              Restore
            </button>
          )}
        </div>
      </div>

      {message && <p className="mb-4 text-sm text-green-700 dark:text-green-400">{message}</p>}
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      {customer.deletedAt && (
        <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100">
          Archived {formatDateTimeUk(customer.deletedAt)}
        </p>
      )}

      {hasInvoices && balance && (
        <section className="mb-6 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">Account balance</h2>
            <Link href="/invoices" className="text-xs font-medium text-accent hover:underline">
              All invoices →
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg bg-[var(--background)] p-3">
              <p className="text-xs text-[var(--muted)]">Balance due</p>
              <p className="mt-1 text-xl font-semibold tabular-nums">
                {formatMoney(balance.balanceDue)}
              </p>
            </div>
            <div className="rounded-lg bg-[var(--background)] p-3">
              <p className="text-xs text-[var(--muted)]">Open invoices (inc VAT)</p>
              <p className="mt-1 text-lg font-medium tabular-nums">
                {formatMoney(balance.totalInvoiced)}
              </p>
            </div>
            <div className="rounded-lg bg-[var(--background)] p-3">
              <p className="text-xs text-[var(--muted)]">Unallocated credit</p>
              <p className="mt-1 text-lg font-medium tabular-nums">
                {formatMoney(balance.creditUnallocated)}
              </p>
            </div>
          </div>
          {unpaidInvoices.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-xs font-medium text-[var(--muted)]">Unpaid invoices</p>
              <ul className="space-y-2 text-sm">
                {unpaidInvoices.map((inv) => (
                  <li
                    key={inv.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--border)] px-3 py-2"
                  >
                    <div>
                      <span className="font-medium">{inv.invoiceNumber}</span>
                      <span className="ml-2 text-[var(--muted)]">
                        {INVOICE_STATUS_LABEL[inv.status]}
                        {inv.dueDate ? ` · due ${formatDateUk(inv.dueDate)}` : ""}
                      </span>
                    </div>
                    <span className="font-mono tabular-nums">{formatMoney(inv.balanceDue)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 text-sm">
          <h2 className="mb-3 font-semibold">Contact</h2>
          <p>Type: {customer.type}</p>
          <p>Email: {customer.email ?? "—"}</p>
          <p>Phone: {customer.phone ?? "—"}</p>
          {(customer.addressLine1 || customer.city || customer.postcode) && (
            <div className="mt-3">
              <p className="font-medium">Address</p>
              {customer.addressLine1 && <p>{customer.addressLine1}</p>}
              {customer.addressLine2 && <p>{customer.addressLine2}</p>}
              {(customer.city || customer.postcode) && (
                <p>{[customer.city, customer.postcode].filter(Boolean).join(", ")}</p>
              )}
            </div>
          )}
          {customer.isAccountCustomer && customer.accountTerms && (
            <div className="mt-3 rounded-lg bg-[var(--background)] p-3">
              <p className="font-medium">Account terms</p>
              <p>Net {customer.accountTerms.paymentTermsDays} days</p>
              <p>Credit limit: £{customer.accountTerms.creditLimit ?? "—"}</p>
              <p>Billing: {customer.accountTerms.billingCycle}</p>
            </div>
          )}
        </section>

        <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 text-sm">
          <h2 className="mb-3 font-semibold">Vehicles</h2>
          <ul className="mb-3 space-y-1">
            {customer.vehicles.map((v) => (
              <li key={v.id} className="font-mono font-semibold">
                {v.registration}
                {(v.make || v.model) && (
                  <span className="ml-2 font-sans font-normal text-[var(--muted)]">
                    {[v.make, v.model].filter(Boolean).join(" ")}
                  </span>
                )}
              </li>
            ))}
            {customer.vehicles.length === 0 && (
              <li className="text-[var(--muted)]">No vehicles yet</li>
            )}
          </ul>
          {hasPermission("customers.write") && !customer.deletedAt && (
            <div className="space-y-2 border-t border-[var(--border)] pt-3">
              <p className="text-xs font-medium text-[var(--muted)]">Add vehicle</p>
              <div className="grid gap-2 sm:grid-cols-3">
                <input
                  value={newReg}
                  onChange={(e) => setNewReg(normalizeRegistration(e.target.value))}
                  placeholder="Reg e.g. AB12CDE"
                  className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 font-mono text-sm uppercase"
                />
                <input
                  value={newMake}
                  onChange={(e) => setNewMake(e.target.value)}
                  placeholder="Make"
                  className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                />
                <input
                  value={newModel}
                  onChange={(e) => setNewModel(e.target.value)}
                  placeholder="Model"
                  className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                />
              </div>
              <button
                type="button"
                onClick={() => void addVehicle()}
                disabled={addingVehicle || !newReg.trim()}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {addingVehicle ? "Adding…" : "Add vehicle"}
              </button>
            </div>
          )}
        </section>
      </div>

      {hasRepair && (
        <section className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--surface)]">
          <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
            <h2 className="text-sm font-semibold">Jobs in progress</h2>
            <Link href="/repair" className="text-xs font-medium text-accent hover:underline">
              All repair jobs →
            </Link>
          </div>
          {activeJobs.length === 0 ? (
            <p className="px-4 py-6 text-sm text-[var(--muted)]">No active repair jobs.</p>
          ) : (
            <JobTable jobs={activeJobs} />
          )}
        </section>
      )}

      {hasRepair && pastJobs.length > 0 && (
        <section className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--surface)]">
          <div className="border-b border-[var(--border)] px-4 py-3">
            <h2 className="text-sm font-semibold">Past jobs</h2>
          </div>
          <JobTable jobs={pastJobs} />
        </section>
      )}

      {hasInvoices && (
        <section className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--surface)]">
          <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
            <h2 className="text-sm font-semibold">Invoices</h2>
            {canRecordPayment && (
              <button
                type="button"
                onClick={() => setPaymentModalOpen(true)}
                disabled={!hasBalanceDue}
                title={!hasBalanceDue ? "No balance due" : undefined}
                className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                Record payment
              </button>
            )}
          </div>
          {invoices.length === 0 ? (
            <p className="px-4 py-6 text-sm text-[var(--muted)]">No invoices yet.</p>
          ) : (
            <TableScroll>
              <table className="w-full min-w-[40rem] text-left text-sm">
                <thead className={`${STICKY_TABLE_HEAD_CLASS} text-xs text-[var(--muted)]`}>
                  <tr>
                    <th className="px-4 py-2 font-medium">Invoice</th>
                    <th className="px-4 py-2 font-medium">Status</th>
                    <th className="px-4 py-2 font-medium">Issued</th>
                    <th className="px-4 py-2 text-right font-medium">Total (inc VAT)</th>
                    <th className="px-4 py-2 text-right font-medium">Balance due</th>
                    <th className="px-4 py-2 text-right font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="border-t border-[var(--border)]">
                      <td className="px-4 py-3">
                        <p className="font-medium">{inv.invoiceNumber}</p>
                        {inv.vehicleRegistration && (
                          <p className="text-xs text-[var(--muted)] font-mono">
                            {inv.vehicleRegistration}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3">{INVOICE_STATUS_LABEL[inv.status]}</td>
                      <td className="px-4 py-3">{formatDateUk(inv.issueDate)}</td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums">
                        {formatMoney(inv.amountGross)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums">
                        {formatMoney(inv.balanceDue)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <TableRowActionsMenu
                          triggerLabel={`Actions for ${inv.invoiceNumber}`}
                          actions={[
                            { label: "View", onClick: () => setViewInvoice(inv) },
                            {
                              label: "Download PDF",
                              onClick: () => void handleDownloadPdf(inv),
                            },
                          ]}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableScroll>
          )}
        </section>
      )}

      <Modal
        title={viewInvoice ? viewInvoice.invoiceNumber : "Invoice"}
        open={viewInvoice !== null}
        onClose={() => setViewInvoice(null)}
        size="lg"
      >
        {viewInvoice && (
          <div className="space-y-4 text-sm">
            <div className="grid gap-2 sm:grid-cols-2">
              <p>
                <span className="text-[var(--muted)]">Status </span>
                {INVOICE_STATUS_LABEL[viewInvoice.status]}
              </p>
              {viewInvoice.vehicleRegistration && (
                <p>
                  <span className="text-[var(--muted)]">Vehicle </span>
                  <span className="font-mono">{viewInvoice.vehicleRegistration}</span>
                </p>
              )}
              {viewInvoice.issueDate && (
                <p>
                  <span className="text-[var(--muted)]">Issued </span>
                  {formatDateUk(viewInvoice.issueDate)}
                </p>
              )}
              {viewInvoice.dueDate && (
                <p>
                  <span className="text-[var(--muted)]">Due </span>
                  {formatDateUk(viewInvoice.dueDate)}
                </p>
              )}
            </div>
            <TableScroll
              className="rounded-lg border border-[var(--border)]"
              maxHeightClass={TABLE_SCROLL_COMPACT_MAX_HEIGHT}
            >
              <table className="w-full min-w-[36rem] text-left text-sm">
                <thead className={`${STICKY_TABLE_HEAD_CLASS} text-xs text-[var(--muted)]`}>
                  <tr>
                    <th className="px-3 py-2 font-medium">Description</th>
                    <th className="px-3 py-2 text-right font-medium">Qty</th>
                    <th className="px-3 py-2 text-right font-medium">Unit (ex VAT)</th>
                    <th className="px-3 py-2 text-right font-medium">VAT</th>
                    <th className="px-3 py-2 text-right font-medium">Line total (inc VAT)</th>
                  </tr>
                </thead>
                <tbody>
                  {viewInvoice.lines.map((line) => (
                    <tr key={line.id} className="border-t border-[var(--border)]">
                      <td className="px-3 py-2">{line.description}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{line.quantity}</td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums">
                        {formatMoney(line.unitPriceNet)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums">
                        {formatMoney(line.vatAmount)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums">
                        {formatMoney(line.amountGross)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableScroll>
            <dl className="ml-auto max-w-xs space-y-1 text-right">
              <div className="flex justify-between gap-4">
                <dt className="text-[var(--muted)]">Net</dt>
                <dd className="font-mono tabular-nums">{formatMoney(viewInvoice.amountNet)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-[var(--muted)]">VAT</dt>
                <dd className="font-mono tabular-nums">{formatMoney(viewInvoice.vatAmount)}</dd>
              </div>
              <div className="flex justify-between gap-4 font-semibold">
                <dt>Total (inc VAT)</dt>
                <dd className="font-mono tabular-nums">{formatMoney(viewInvoice.amountGross)}</dd>
              </div>
              <div className="flex justify-between gap-4 border-t border-[var(--border)] pt-1">
                <dt className="text-[var(--muted)]">Balance due</dt>
                <dd className="font-mono tabular-nums">{formatMoney(viewInvoice.balanceDue)}</dd>
              </div>
            </dl>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setViewInvoice(null)}
                className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => void handleDownloadPdf(viewInvoice)}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white"
              >
                Download PDF
              </button>
            </div>
          </div>
        )}
      </Modal>

      {canRecordPayment && customer && (
        <RecordPaymentModal
          open={paymentModalOpen}
          onClose={() => setPaymentModalOpen(false)}
          fixedCustomerId={customerId}
          fixedCustomerName={customer.displayName}
          onSuccess={(msg) => {
            setMessage(msg);
            setError("");
            void loadRelated();
          }}
        />
      )}
    </>
  );
}

function JobTable({ jobs }: { jobs: RepairJobListDto[] }) {
  return (
    <TableScroll>
      <table className="w-full min-w-[36rem] text-left text-sm">
        <thead className={`${STICKY_TABLE_HEAD_CLASS} text-xs text-[var(--muted)]`}>
          <tr>
            <th className="px-4 py-2 font-medium">Job</th>
            <th className="px-4 py-2 font-medium">Status</th>
            <th className="px-4 py-2 font-medium">Tasks done</th>
            <th className="px-4 py-2 font-medium">Invoice</th>
            <th className="px-4 py-2 font-medium">Updated</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((job) => (
            <tr key={job.id} className="border-t border-[var(--border)] hover:bg-[var(--background)]">
              <td className="px-4 py-3">
                <Link href={`/repair/${job.id}`} className="font-medium text-accent hover:underline">
                  {job.jobNumber}
                </Link>
                {job.vehicleLabel && (
                  <p className="text-xs text-[var(--muted)]">{job.vehicleLabel}</p>
                )}
                {job.customerConcern && (
                  <p className="mt-0.5 text-xs text-[var(--muted)] line-clamp-2">
                    {job.customerConcern}
                  </p>
                )}
              </td>
              <td className="px-4 py-3">{jobStatusChip(job.status)}</td>
              <td className="px-4 py-3 tabular-nums">{tasksDoneCell(job)}</td>
              <td className="px-4 py-3 text-[var(--muted)]">
                {job.invoiceNumber ?? "—"}
                {job.invoiceAmountGross && (
                  <span className="block font-mono text-xs">
                    {formatMoney(job.invoiceAmountGross)}
                  </span>
                )}
              </td>
              <td className="px-4 py-3 text-[var(--muted)]">{formatDateTimeUk(job.updatedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableScroll>
  );
}
