"use client";

import { ModuleGate } from "@/components/layout/module-gate";
import { PermissionGate } from "@/components/layout/permission-gate";
import { useSession } from "@/components/providers/session-provider";
import { apiFetch, ApiError } from "@/lib/api-client";
import type { CustomerDto } from "@mygaragepro/shared";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { hasPermission, session } = useSession();
  const [customer, setCustomer] = useState<CustomerDto | null>(null);
  const [error, setError] = useState("");
  const [newReg, setNewReg] = useState("");
  const [newMake, setNewMake] = useState("");
  const [newModel, setNewModel] = useState("");
  const [addingVehicle, setAddingVehicle] = useState(false);

  const load = useCallback(async () => {
    const data = await apiFetch<CustomerDto>(`/customers/${id}`);
    setCustomer(data);
  }, [id]);

  useEffect(() => {
    void load().catch(() => setError("Customer not found"));
  }, [load]);

  async function handleDelete() {
    if (!confirm("Archive this customer?")) return;
    try {
      await apiFetch(`/customers/${id}`, { method: "DELETE" });
      router.push("/customers");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Delete failed");
    }
  }

  async function handleRestore() {
    try {
      await apiFetch(`/customers/${id}/restore`, { method: "POST" });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Restore failed");
    }
  }

  async function addVehicle() {
    if (!newReg.trim()) return;
    setAddingVehicle(true);
    setError("");
    try {
      await apiFetch(`/customers/${id}/vehicles`, {
        method: "POST",
        body: JSON.stringify({
          registration: newReg.trim(),
          make: newMake.trim() || undefined,
          model: newModel.trim() || undefined,
        }),
      });
      setNewReg("");
      setNewMake("");
      setNewModel("");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not add vehicle");
    } finally {
      setAddingVehicle(false);
    }
  }

  if (!customer) {
    return (
      <ModuleGate moduleKey="customers">
        <PermissionGate permission="customers.read">
          <p className="text-sm text-[var(--muted)]">{error || "Loading…"}</p>
        </PermissionGate>
      </ModuleGate>
    );
  }

  const canRestore = customer.deletedAt && hasPermission("customers.write");

  return (
    <ModuleGate moduleKey="customers">
    <PermissionGate permission="customers.read">
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
              onClick={handleDelete}
              className="rounded-lg border border-red-300 px-3 py-1.5 text-sm text-red-600"
            >
              Archive
            </button>
          )}
          {canRestore && (
            <button
              type="button"
              onClick={handleRestore}
              className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white"
            >
              Restore
            </button>
          )}
        </div>
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      {customer.deletedAt && (
        <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100">
          Archived {new Date(customer.deletedAt).toLocaleString()}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 text-sm">
          <h2 className="mb-3 font-semibold">Contact</h2>
          <p>Type: {customer.type}</p>
          <p>Email: {customer.email ?? "—"}</p>
          <p>Phone: {customer.phone ?? "—"}</p>
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
                  onChange={(e) => setNewReg(e.target.value)}
                  placeholder="Reg e.g. AB12 CDE"
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
    </PermissionGate>
    </ModuleGate>
  );
}
