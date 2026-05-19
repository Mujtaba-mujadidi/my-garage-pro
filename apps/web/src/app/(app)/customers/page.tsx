"use client";

import { PermissionGate } from "@/components/layout/permission-gate";
import { useSession } from "@/components/providers/session-provider";
import { apiFetch } from "@/lib/api-client";
import type { CustomerDto } from "@mygaragepro/shared";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

export default function CustomersPage() {
  const { hasPermission } = useSession();
  const [q, setQ] = useState("");
  const [customers, setCustomers] = useState<CustomerDto[]>([]);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const params = q.trim() ? `?q=${encodeURIComponent(q.trim())}` : "";
    const data = await apiFetch<CustomerDto[]>(`/customers${params}`);
    setCustomers(data);
  }, [q]);

  useEffect(() => {
    const t = setTimeout(() => {
      void load().catch(() => setError("Could not load customers"));
    }, 300);
    return () => clearTimeout(t);
  }, [load]);

  return (
    <PermissionGate permission="customers.read">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="mb-1 text-xs text-[var(--muted)]">
            Home / <span className="text-accent">Customers</span>
          </p>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Customers</h1>
        </div>
        {hasPermission("customers.write") && (
          <Link
            href="/customers/new"
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
          >
            Add customer
          </Link>
        )}
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <div className="mb-4">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name, company, email, or reg…"
          className="w-full max-w-md rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] text-left text-[11px] uppercase text-[var(--muted)]">
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Type</th>
              <th className="px-4 py-2">Phone</th>
              <th className="px-4 py-2">Vehicles</th>
              <th className="px-4 py-2">Account</th>
            </tr>
          </thead>
          <tbody>
            {customers.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-[var(--muted)]">
                  No customers found.
                </td>
              </tr>
            )}
            {customers.map((c) => (
              <tr key={c.id} className="border-b border-[var(--border)] hover:bg-[var(--background)]">
                <td className="px-4 py-2.5">
                  <Link href={`/customers/${c.id}`} className="font-medium text-accent hover:underline">
                    {c.displayName}
                  </Link>
                </td>
                <td className="px-4 py-2.5 capitalize">{c.type.toLowerCase()}</td>
                <td className="px-4 py-2.5">{c.phone ?? "—"}</td>
                <td className="px-4 py-2.5">
                  {c.vehicles.length
                    ? c.vehicles.map((v) => v.registration).join(", ")
                    : "—"}
                </td>
                <td className="px-4 py-2.5">
                  {c.isAccountCustomer ? (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-900 dark:bg-amber-950 dark:text-amber-100">
                      Account
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PermissionGate>
  );
}
