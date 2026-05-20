"use client";

import type { CreateGarageRequestDto } from "@mygaragepro/shared";
import { FormEvent, useState } from "react";

export const defaultCreateGarageForm = (): CreateGarageRequestDto => ({
  name: "",
  slug: "",
  directorOwnerName: "",
  address: "",
  contactNumber: "",
  phoneNumber: "",
  vatNumber: "",
  ownerEmail: "",
  tempPassword: "",
});

type Props = {
  value: CreateGarageRequestDto;
  onChange: (next: CreateGarageRequestDto) => void;
  onSubmit: (e: FormEvent) => void;
  onCancel: () => void;
  saving: boolean;
  error: string;
};

function slugFromName(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const inputClass =
  "w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm";

export function CreateGarageForm({
  value,
  onChange,
  onSubmit,
  onCancel,
  saving,
  error,
}: Props) {
  const [slugTouched, setSlugTouched] = useState(false);

  function patch(partial: Partial<CreateGarageRequestDto>) {
    onChange({ ...value, ...partial });
  }

  return (
    <form onSubmit={onSubmit} className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
          Garage details
        </h3>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--muted)]">
              Garage name *
            </label>
            <input
              value={value.name}
              onChange={(e) => {
                const name = e.target.value;
                patch({
                  name,
                  slug: slugTouched ? value.slug : slugFromName(name),
                });
              }}
              placeholder="Acme Motors Ltd"
              className={inputClass}
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--muted)]">
              URL slug *
            </label>
            <input
              value={value.slug}
              onChange={(e) => {
                setSlugTouched(true);
                patch({
                  slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
                });
              }}
              placeholder="acme-motors"
              className={`${inputClass} font-mono`}
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--muted)]">
              Director / owner full name *
            </label>
            <input
              value={value.directorOwnerName}
              onChange={(e) => patch({ directorOwnerName: e.target.value })}
              placeholder="James Smith"
              className={inputClass}
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--muted)]">
              Garage address *
            </label>
            <textarea
              value={value.address}
              onChange={(e) => patch({ address: e.target.value })}
              placeholder="123 High Street, London, SW1A 1AA"
              rows={2}
              className={inputClass}
              required
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--muted)]">
                Contact number *
              </label>
              <input
                type="tel"
                value={value.contactNumber}
                onChange={(e) => patch({ contactNumber: e.target.value })}
                placeholder="020 7123 4567"
                className={inputClass}
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--muted)]">
                Phone number *
              </label>
              <input
                type="tel"
                value={value.phoneNumber}
                onChange={(e) => patch({ phoneNumber: e.target.value })}
                placeholder="07700 900123"
                className={inputClass}
                required
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--muted)]">
              VAT number (if applicable)
            </label>
            <input
              value={value.vatNumber ?? ""}
              onChange={(e) => patch({ vatNumber: e.target.value })}
              placeholder="GB123456789"
              className={inputClass}
            />
          </div>
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
          Owner login
        </h3>
        <p className="mb-3 text-xs text-[var(--muted)]">
          The owner signs in with this email and temporary password. They must set a new password
          on first login.
        </p>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--muted)]">
              Owner email *
            </label>
            <input
              type="email"
              value={value.ownerEmail}
              onChange={(e) => patch({ ownerEmail: e.target.value })}
              placeholder="owner@acme-motors.co.uk"
              className={inputClass}
              required
              autoComplete="off"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--muted)]">
              Temporary password *
            </label>
            <input
              type="text"
              value={value.tempPassword}
              onChange={(e) => patch({ tempPassword: e.target.value })}
              placeholder="Min. 8 characters"
              className={inputClass}
              required
              minLength={8}
              autoComplete="new-password"
            />
          </div>
        </div>
      </section>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="sticky bottom-0 flex justify-end gap-2 border-t border-[var(--border)] bg-[var(--surface)] pt-3">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {saving ? "Creating…" : "Create garage"}
        </button>
      </div>
    </form>
  );
}
