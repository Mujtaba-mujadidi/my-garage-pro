"use client";

import { PermissionGate } from "@/components/layout/permission-gate";
import { apiFetch, ApiError } from "@/lib/api-client";
import type { AuditLogDto, GarageAccountDto, ModuleKey } from "@mygaragepro/shared";
import { MODULE_KEYS, MODULE_LABELS } from "@mygaragepro/shared";
import { FormEvent, useCallback, useEffect, useState } from "react";

export default function AdminPage() {
  const [garages, setGarages] = useState<GarageAccountDto[]>([]);
  const [audit, setAudit] = useState<AuditLogDto[]>([]);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const [g, a] = await Promise.all([
      apiFetch<GarageAccountDto[]>("/platform/garages"),
      apiFetch<AuditLogDto[]>("/platform/audit?limit=30"),
    ]);
    setGarages(g);
    setAudit(a);
  }, []);

  useEffect(() => {
    void load().catch(() => setError("Failed to load platform data"));
  }, [load]);

  async function createGarage(e: FormEvent) {
    e.preventDefault();
    setMessage("");
    setError("");
    try {
      await apiFetch("/platform/garages", {
        method: "POST",
        body: JSON.stringify({ name, slug }),
      });
      setName("");
      setSlug("");
      setMessage("Garage created.");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Create failed");
    }
  }

  async function toggleModule(garageId: string, current: ModuleKey[], moduleKey: ModuleKey) {
    const next = current.includes(moduleKey)
      ? current.filter((m) => m !== moduleKey)
      : [...current, moduleKey];
    try {
      await apiFetch(`/platform/garages/${garageId}/modules`, {
        method: "PATCH",
        body: JSON.stringify({ enabledModules: next }),
      });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Module update failed");
    }
  }

  return (
    <PermissionGate permission="platform.garage.manage">
      <p className="mb-2 text-xs text-[var(--muted)]">
        Home / <span className="text-accent">Super Admin</span>
      </p>
      <h1 className="mb-6 text-2xl font-bold text-[var(--foreground)]">Platform admin</h1>

      {message && <p className="mb-4 text-sm text-green-700 dark:text-green-400">{message}</p>}
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <section className="mb-8 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <h2 className="mb-3 text-sm font-semibold">Create garage</h2>
        <form onSubmit={createGarage} className="flex flex-wrap gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Garage name"
            className="min-w-[12rem] flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
            required
          />
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
            placeholder="slug (e.g. acme-motors)"
            className="min-w-[12rem] flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm font-mono"
            required
          />
          <button type="submit" className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white">
            Create
          </button>
        </form>
      </section>

      <section className="mb-8 space-y-4">
        <h2 className="text-sm font-semibold">Garages</h2>
        {garages.map((g) => (
          <div key={g.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-semibold text-[var(--foreground)]">{g.name}</p>
                <p className="text-xs text-[var(--muted)]">{g.slug} · {g.status}</p>
              </div>
              <div className="flex gap-2">
                {g.status === "ACTIVE" ? (
                  <button
                    type="button"
                    onClick={() =>
                      void apiFetch(`/platform/garages/${g.id}/suspend`, { method: "PATCH" }).then(load)
                    }
                    className="rounded-lg border border-[var(--border)] px-2 py-1 text-xs"
                  >
                    Suspend
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() =>
                      void apiFetch(`/platform/garages/${g.id}/activate`, { method: "PATCH" }).then(load)
                    }
                    className="rounded-lg border border-[var(--border)] px-2 py-1 text-xs"
                  >
                    Activate
                  </button>
                )}
              </div>
            </div>
            <p className="mb-2 text-[11px] uppercase text-[var(--muted)]">Modules</p>
            <div className="flex flex-wrap gap-1">
              {MODULE_KEYS.map((key) => {
                const on = g.enabledModules.includes(key);
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => void toggleModule(g.id, g.enabledModules, key)}
                    className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      on ? "bg-accent text-white" : "bg-[var(--background)] text-[var(--muted)]"
                    }`}
                  >
                    {MODULE_LABELS[key]}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </section>

      <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <h2 className="mb-3 text-sm font-semibold">Recent audit log</h2>
        <ul className="max-h-80 space-y-2 overflow-y-auto text-xs">
          {audit.map((row) => (
            <li key={row.id} className="rounded-lg bg-[var(--background)] px-3 py-2">
              <span className="font-mono text-accent">{row.action}</span>
              <span className="text-[var(--muted)]"> · {row.userEmail ?? "system"}</span>
              {row.garageName && <span className="text-[var(--muted)]"> · {row.garageName}</span>}
              <br />
              <span className="text-[var(--muted)]">{new Date(row.createdAt).toLocaleString()}</span>
            </li>
          ))}
        </ul>
      </section>
    </PermissionGate>
  );
}
