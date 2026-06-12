"use client";

import type { SupplierDto } from "@mygaragepro/shared";
import type { Dispatch, FormEvent, SetStateAction } from "react";

export type DraftSupplier = {
  id?: string;
  name: string;
  email: string;
  phone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  postcode: string;
  vatNumber: string;
  notes: string;
};

export function toDraftSupplier(s: SupplierDto): DraftSupplier {
  return {
    id: s.id,
    name: s.name ?? "",
    email: s.email ?? "",
    phone: s.phone ?? "",
    addressLine1: s.addressLine1 ?? "",
    addressLine2: s.addressLine2 ?? "",
    city: s.city ?? "",
    postcode: s.postcode ?? "",
    vatNumber: s.vatNumber ?? "",
    notes: s.notes ?? "",
  };
}

export function emptyDraftSupplier(): DraftSupplier {
  return {
    name: "",
    email: "",
    phone: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    postcode: "",
    vatNumber: "",
    notes: "",
  };
}

type SupplierFormProps = {
  draft: DraftSupplier;
  setDraft: Dispatch<SetStateAction<DraftSupplier>>;
  onSubmit: (e: FormEvent) => void;
  saving: boolean;
  onCancel: () => void;
};

export function SupplierForm({ draft, setDraft, onSubmit, saving, onCancel }: SupplierFormProps) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Supplier name</label>
          <input
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
            placeholder="e.g. Euro Car Parts"
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Email</label>
          <input
            value={draft.email}
            onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
            placeholder="accounts@supplier.com"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Phone</label>
          <input
            value={draft.phone}
            onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value }))}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
            placeholder="020 7946 0123"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--muted)]">VAT number</label>
          <input
            value={draft.vatNumber}
            onChange={(e) => setDraft((d) => ({ ...d, vatNumber: e.target.value }))}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
            placeholder="GB123456789"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Postcode</label>
          <input
            value={draft.postcode}
            onChange={(e) => setDraft((d) => ({ ...d, postcode: e.target.value }))}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
            placeholder="SW1A 1AA"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Address line 1</label>
          <input
            value={draft.addressLine1}
            onChange={(e) => setDraft((d) => ({ ...d, addressLine1: e.target.value }))}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
            placeholder="1 Supplier Street"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Address line 2</label>
          <input
            value={draft.addressLine2}
            onChange={(e) => setDraft((d) => ({ ...d, addressLine2: e.target.value }))}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
            placeholder="Optional"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--muted)]">City</label>
          <input
            value={draft.city}
            onChange={(e) => setDraft((d) => ({ ...d, city: e.target.value }))}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
            placeholder="London"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Notes</label>
          <textarea
            value={draft.notes}
            onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
            className="min-h-[90px] w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
            placeholder="Account number, preferred contact, delivery instructions…"
          />
        </div>
      </div>

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
