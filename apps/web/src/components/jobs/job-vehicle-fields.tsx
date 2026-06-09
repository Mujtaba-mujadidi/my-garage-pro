"use client";

import { SearchableSelect } from "@/components/ui/searchable-select";
import { useCustomerVehicles } from "@/lib/use-customer-vehicles";
import { normalizeRegistration } from "@/lib/vehicle-registration";
import { useEffect, useState } from "react";

const inputClass =
  "w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm";

type Props = {
  customerId: string;
  registration: string;
  make: string;
  model: string;
  onRegistrationChange: (value: string) => void;
  onMakeChange: (value: string) => void;
  onModelChange: (value: string) => void;
};

export function JobVehicleFields({
  customerId,
  registration,
  make,
  model,
  onRegistrationChange,
  onMakeChange,
  onModelChange,
}: Props) {
  const vehicles = useCustomerVehicles(customerId);
  const [selectedRegistration, setSelectedRegistration] = useState("");

  useEffect(() => {
    setSelectedRegistration("");
  }, [customerId]);

  const fieldsDisabled = !customerId;

  return (
    <div className="space-y-3">
      <div className="min-h-[4.5rem]">
        {!customerId ? (
          <p className="text-xs text-[var(--muted)]">Select a customer to choose or add a vehicle.</p>
        ) : vehicles.length > 0 ? (
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Vehicle</label>
            <SearchableSelect
              value={selectedRegistration}
              onChange={(reg) => {
                setSelectedRegistration(reg);
                const vehicle = vehicles.find((v) => v.registration === reg);
                if (vehicle) {
                  onRegistrationChange(vehicle.registration);
                  onMakeChange(vehicle.make ?? "");
                  onModelChange(vehicle.model ?? "");
                }
              }}
              options={[
                { value: "", label: "Select a vehicle…" },
                ...vehicles.map((v) => ({ value: v.registration, label: v.label })),
              ]}
              searchPlaceholder="Search registrations…"
            />
          </div>
        ) : null}
      </div>

      {customerId && (
        <p className="min-h-[2.25rem] border-t border-[var(--border)] pt-3 text-xs font-medium text-[var(--muted)]">
          {vehicles.length > 0 ? "Or add a new vehicle" : "Vehicle details"}
        </p>
      )}

      <div
        className={`grid gap-3 sm:grid-cols-3 ${fieldsDisabled ? "pointer-events-none opacity-40" : ""}`}
      >
        <div className="sm:col-span-3">
          <p className="text-xs text-[var(--muted)]">
            Registration without spaces (e.g. WP67LUV). New vehicles are saved to the customer when
            the job is created.
          </p>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--muted)]">
            Registration <span className="text-red-600">*</span>
          </label>
          <input
            value={registration}
            onChange={(e) => {
              const value = normalizeRegistration(e.target.value);
              onRegistrationChange(value);
              if (value !== selectedRegistration) setSelectedRegistration("");
            }}
            className={`${inputClass} font-mono uppercase`}
            placeholder="AB12CDE"
            required
            disabled={fieldsDisabled}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Make</label>
          <input
            value={make}
            onChange={(e) => {
              onMakeChange(e.target.value);
              if (registration !== selectedRegistration) setSelectedRegistration("");
            }}
            className={inputClass}
            disabled={fieldsDisabled}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Model</label>
          <input
            value={model}
            onChange={(e) => {
              onModelChange(e.target.value);
              if (registration !== selectedRegistration) setSelectedRegistration("");
            }}
            className={inputClass}
            disabled={fieldsDisabled}
          />
        </div>
      </div>
    </div>
  );
}
