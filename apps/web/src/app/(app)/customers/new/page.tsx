"use client";

import { PermissionGate } from "@/components/layout/permission-gate";
import { apiFetch, ApiError } from "@/lib/api-client";
import type { BillingCycle, CustomerType } from "@mygaragepro/shared";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export default function NewCustomerPage() {
  const router = useRouter();
  const [type, setType] = useState<CustomerType>("INDIVIDUAL");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [registration, setRegistration] = useState("");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [isAccountCustomer, setIsAccountCustomer] = useState(false);
  const [paymentTermsDays, setPaymentTermsDays] = useState(30);
  const [creditLimit, setCreditLimit] = useState("");
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("MONTHLY");
  const [error, setError] = useState("");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      const body: Record<string, unknown> = {
        type,
        email: email || undefined,
        phone: phone || undefined,
        isAccountCustomer,
      };
      if (type === "INDIVIDUAL") {
        body.firstName = firstName;
        body.lastName = lastName;
      } else {
        body.companyName = companyName;
      }
      if (isAccountCustomer) {
        body.accountTerms = {
          paymentTermsDays,
          creditLimit: creditLimit || undefined,
          billingCycle,
        };
      }
      if (registration.trim()) {
        body.vehicles = [{ registration: registration.trim(), make, model }];
      }
      const created = await apiFetch<{ id: string }>("/customers", {
        method: "POST",
        body: JSON.stringify(body),
      });
      router.push(`/customers/${created.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create customer");
    }
  }

  return (
    <PermissionGate permission="customers.write">
      <p className="mb-2 text-xs text-[var(--muted)]">
        <Link href="/customers" className="hover:text-accent">
          Customers
        </Link>{" "}
        / <span className="text-accent">New</span>
      </p>
      <h1 className="mb-6 text-2xl font-bold">Add customer</h1>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <form onSubmit={onSubmit} className="max-w-xl space-y-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <div>
          <label className="mb-1 block text-sm font-medium">Type</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as CustomerType)}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
          >
            <option value="INDIVIDUAL">Individual</option>
            <option value="BUSINESS">Business</option>
          </select>
        </div>

        {type === "INDIVIDUAL" ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              placeholder="First name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              required
            />
            <input
              placeholder="Last name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
            />
          </div>
        ) : (
          <input
            placeholder="Company name"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
            required
          />
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
          />
          <input
            placeholder="Phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
          />
        </div>

        <fieldset className="rounded-lg border border-[var(--border)] p-3">
          <legend className="px-1 text-sm font-medium">Vehicle (optional)</legend>
          <div className="grid gap-3 sm:grid-cols-3">
            <input
              placeholder="Reg e.g. AB12 CDE"
              value={registration}
              onChange={(e) => setRegistration(e.target.value)}
              className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm font-mono uppercase"
            />
            <input
              placeholder="Make"
              value={make}
              onChange={(e) => setMake(e.target.value)}
              className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
            />
            <input
              placeholder="Model"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
            />
          </div>
        </fieldset>

        {type === "BUSINESS" && (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isAccountCustomer}
              onChange={(e) => setIsAccountCustomer(e.target.checked)}
            />
            Account customer (credit terms &amp; statements)
          </label>
        )}

        {isAccountCustomer && (
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              type="number"
              placeholder="Payment terms (days)"
              value={paymentTermsDays}
              onChange={(e) => setPaymentTermsDays(Number(e.target.value))}
              className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
            />
            <input
              placeholder="Credit limit (£)"
              value={creditLimit}
              onChange={(e) => setCreditLimit(e.target.value)}
              className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
            />
            <select
              value={billingCycle}
              onChange={(e) => setBillingCycle(e.target.value as BillingCycle)}
              className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm sm:col-span-2"
            >
              <option value="PER_JOB">Bill per job</option>
              <option value="WEEKLY">Weekly statement</option>
              <option value="MONTHLY">Monthly statement</option>
            </select>
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <button type="submit" className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white">
            Save customer
          </button>
          <Link
            href="/customers"
            className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium"
          >
            Cancel
          </Link>
        </div>
      </form>
    </PermissionGate>
  );
}
