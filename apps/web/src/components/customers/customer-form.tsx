"use client";

import { Select } from "@/components/ui/select";
import type { BillingCycle, CustomerType } from "@mygaragepro/shared";
import type { Dispatch, FormEvent, SetStateAction } from "react";

export type DraftCustomer = {
  id?: string;
  type: CustomerType;
  firstName: string;
  lastName: string;
  companyName: string;
  email: string;
  phone: string;
  registration: string;
  make: string;
  model: string;
  isAccountCustomer: boolean;
  paymentTermsDays: number;
  creditLimit: string;
  billingCycle: BillingCycle;
};

export function emptyDraft(): DraftCustomer {
  return {
    type: "INDIVIDUAL",
    firstName: "",
    lastName: "",
    companyName: "",
    email: "",
    phone: "",
    registration: "",
    make: "",
    model: "",
    isAccountCustomer: false,
    paymentTermsDays: 30,
    creditLimit: "",
    billingCycle: "MONTHLY",
  };
}

type Props = {
  draft: DraftCustomer;
  setDraft: Dispatch<SetStateAction<DraftCustomer>>;
  saving: boolean;
  onSubmit: (e: FormEvent) => void;
  onCancel: () => void;
};

export function CustomerForm({ draft, setDraft, saving, onSubmit, onCancel }: Props) {
  const isEdit = Boolean(draft.id);

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Type</label>
        <Select
          value={draft.type}
          disabled={isEdit}
          onChange={(v) =>
            setDraft((d) => ({
              ...d,
              type: v as CustomerType,
              isAccountCustomer: v === "BUSINESS" ? d.isAccountCustomer : false,
            }))
          }
          options={[
            { value: "INDIVIDUAL", label: "Individual" },
            { value: "BUSINESS", label: "Business" },
          ]}
        />
      </div>

      {draft.type === "INDIVIDUAL" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--muted)]">First name</label>
            <input
              value={draft.firstName}
              onChange={(e) => setDraft((d) => ({ ...d, firstName: e.target.value }))}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Last name</label>
            <input
              value={draft.lastName}
              onChange={(e) => setDraft((d) => ({ ...d, lastName: e.target.value }))}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
            />
          </div>
        </div>
      ) : (
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Company name</label>
          <input
            value={draft.companyName}
            onChange={(e) => setDraft((d) => ({ ...d, companyName: e.target.value }))}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
            required
          />
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Email</label>
          <input
            type="email"
            value={draft.email}
            onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
            placeholder="email@example.com"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Phone</label>
          <input
            value={draft.phone}
            onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value }))}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
            placeholder="07700 900123"
          />
        </div>
      </div>

      {!isEdit && (
        <fieldset className="rounded-lg border border-[var(--border)] p-3">
          <legend className="px-1 text-xs font-medium text-[var(--muted)]">Vehicle (optional)</legend>
          <div className="grid gap-3 sm:grid-cols-3">
            <input
              placeholder="Reg e.g. AB12 CDE"
              value={draft.registration}
              onChange={(e) => setDraft((d) => ({ ...d, registration: e.target.value }))}
              className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 font-mono text-sm uppercase"
            />
            <input
              placeholder="Make"
              value={draft.make}
              onChange={(e) => setDraft((d) => ({ ...d, make: e.target.value }))}
              className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
            />
            <input
              placeholder="Model"
              value={draft.model}
              onChange={(e) => setDraft((d) => ({ ...d, model: e.target.value }))}
              className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
            />
          </div>
        </fieldset>
      )}

      {draft.type === "BUSINESS" && (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={draft.isAccountCustomer}
            onChange={(e) => setDraft((d) => ({ ...d, isAccountCustomer: e.target.checked }))}
            className="h-4 w-4 rounded border border-[var(--border)]"
          />
          Account customer (credit terms &amp; statements)
        </label>
      )}

      {draft.isAccountCustomer && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Payment terms (days)</label>
            <input
              type="number"
              value={draft.paymentTermsDays}
              onChange={(e) => setDraft((d) => ({ ...d, paymentTermsDays: Number(e.target.value) }))}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Credit limit (£)</label>
            <input
              value={draft.creditLimit}
              onChange={(e) => setDraft((d) => ({ ...d, creditLimit: e.target.value }))}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Billing cycle</label>
            <Select
              value={draft.billingCycle}
              onChange={(v) => setDraft((d) => ({ ...d, billingCycle: v as BillingCycle }))}
              options={[
                { value: "PER_JOB", label: "Bill per job" },
                { value: "WEEKLY", label: "Weekly statement" },
                { value: "MONTHLY", label: "Monthly statement" },
              ]}
            />
          </div>
        </div>
      )}

      <div className="flex flex-wrap justify-end gap-2 pt-1">
        <button
          type="button"
          disabled={saving}
          onClick={onCancel}
          className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium hover:bg-[var(--background)] disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}
