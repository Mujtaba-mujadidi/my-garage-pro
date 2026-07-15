"use client";

import type { GarageAccountDto, UpdateGarageRequestDto } from "@mygaragepro/shared";
import { formatDateTimeUk } from "@mygaragepro/shared";
import { useState } from "react";

const inputClass =
  "w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm";

function slugFromName(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function garageToDetailsDraft(garage: GarageAccountDto): UpdateGarageRequestDto {
  return {
    name: garage.name,
    slug: garage.slug,
    directorOwnerName: garage.directorOwnerName,
    address: garage.address,
    contactNumber: garage.contactNumber,
    phoneNumber: garage.phoneNumber,
    vatNumber: garage.vatNumber ?? "",
    ownerEmail: garage.ownerEmail ?? "",
  };
}

function normalizeDetails(d: UpdateGarageRequestDto): UpdateGarageRequestDto {
  return {
    ...d,
    vatNumber: d.vatNumber?.trim() ?? "",
    ownerEmail: d.ownerEmail?.trim() ?? "",
  };
}

export function detailsEqual(a: UpdateGarageRequestDto, b: UpdateGarageRequestDto): boolean {
  const left = normalizeDetails(a);
  const right = normalizeDetails(b);
  return (
    left.name === right.name &&
    left.slug === right.slug &&
    left.directorOwnerName === right.directorOwnerName &&
    left.address === right.address &&
    left.contactNumber === right.contactNumber &&
    left.phoneNumber === right.phoneNumber &&
    left.vatNumber === right.vatNumber &&
    left.ownerEmail === right.ownerEmail
  );
}

type Props = {
  value: UpdateGarageRequestDto;
  onChange: (next: UpdateGarageRequestDto) => void;
  garage: GarageAccountDto;
  disabled?: boolean;
};

export function GarageDetailsForm({ value, onChange, garage, disabled }: Props) {
  const [slugTouched, setSlugTouched] = useState(false);

  function patch(partial: Partial<UpdateGarageRequestDto>) {
    onChange({ ...value, ...partial });
  }

  return (
    <div className="space-y-4">
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
              disabled={disabled}
              onChange={(e) => {
                const name = e.target.value;
                patch({
                  name,
                  slug: slugTouched ? value.slug : slugFromName(name),
                });
              }}
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
              disabled={disabled}
              onChange={(e) => {
                setSlugTouched(true);
                patch({
                  slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
                });
              }}
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
              disabled={disabled}
              onChange={(e) => patch({ directorOwnerName: e.target.value })}
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
              disabled={disabled}
              onChange={(e) => patch({ address: e.target.value })}
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
                disabled={disabled}
                onChange={(e) => patch({ contactNumber: e.target.value })}
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
                disabled={disabled}
                onChange={(e) => patch({ phoneNumber: e.target.value })}
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
              disabled={disabled}
              onChange={(e) => patch({ vatNumber: e.target.value })}
              className={inputClass}
            />
          </div>
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
          Owner login
        </h3>
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--muted)]">
            Owner email
          </label>
          <input
            type="email"
            value={value.ownerEmail ?? ""}
            disabled={disabled || !garage.ownerEmail}
            onChange={(e) => patch({ ownerEmail: e.target.value })}
            placeholder={garage.ownerEmail ? undefined : "No owner on record"}
            className={inputClass}
            autoComplete="off"
          />
          {!garage.ownerEmail && (
            <p className="mt-1 text-xs text-[var(--muted)]">No owner account linked to this garage.</p>
          )}
        </div>
      </section>

      <section className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-xs text-[var(--muted)]">
        <p>
          <span className="font-medium text-[var(--foreground)]">Status:</span>{" "}
          <span
            className={
              garage.status === "ACTIVE"
                ? "text-green-700 dark:text-green-400"
                : "text-amber-700 dark:text-amber-400"
            }
          >
            {garage.status}
          </span>
        </p>
        <p className="mt-1">
          <span className="font-medium text-[var(--foreground)]">Created:</span>{" "}
          {formatDateTimeUk(garage.createdAt)}
        </p>
      </section>
    </div>
  );
}
