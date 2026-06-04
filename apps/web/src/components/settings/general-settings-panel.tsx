"use client";

import { useSession } from "@/components/providers/session-provider";
import { apiFetch, ApiError } from "@/lib/api-client";
import type { SettingOptionDto } from "@mygaragepro/shared";
import { FormEvent, useCallback, useEffect, useState } from "react";

type SettingRow = SettingOptionDto & { id: string };

export function GeneralSettingsPanel() {
  const { hasPermission } = useSession();
  const [expenseCategories, setExpenseCategories] = useState<SettingRow[]>([]);
  const [vatRates, setVatRates] = useState<SettingRow[]>([]);
  const [newCategory, setNewCategory] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const [expenses, vats] = await Promise.all([
      apiFetch<SettingRow[]>("/settings?optionType=expense_category"),
      apiFetch<SettingRow[]>("/settings?optionType=vat_rate"),
    ]);
    setExpenseCategories(expenses);
    setVatRates(vats);
  }, []);

  useEffect(() => {
    void load().catch(() => setError("Could not load settings"));
  }, [load]);

  async function addCategory(e: FormEvent) {
    e.preventDefault();
    if (!newCategory.trim()) return;
    setMessage("");
    setError("");
    try {
      await apiFetch("/settings", {
        method: "POST",
        body: JSON.stringify({
          optionType: "expense_category",
          label: newCategory.trim(),
          value: newCategory.trim().toLowerCase().replace(/\s+/g, "_"),
        }),
      });
      setNewCategory("");
      setMessage("Category added.");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to add category");
    }
  }

  return (
    <div>
      {message && <p className="mb-4 text-sm text-green-700 dark:text-green-400">{message}</p>}
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-4">
          <h2 className="mb-3 text-sm font-semibold">Expense categories</h2>
          <ul className="mb-4 max-h-48 space-y-1 overflow-y-auto text-sm">
            {expenseCategories.map((c) => (
              <li key={c.id} className="rounded-lg bg-[var(--surface)] px-3 py-2">
                {c.label}
              </li>
            ))}
          </ul>
          {hasPermission("settings.write") && (
            <form onSubmit={addCategory} className="flex gap-2">
              <input
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                placeholder="New category name"
                className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
              />
              <button
                type="submit"
                className="shrink-0 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white"
              >
                Add
              </button>
            </form>
          )}
        </section>

        <section className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-4">
          <h2 className="mb-3 text-sm font-semibold">VAT rates</h2>
          <ul className="max-h-64 space-y-1 overflow-y-auto text-sm">
            {vatRates.map((v) => (
              <li
                key={v.id}
                className="flex justify-between rounded-lg bg-[var(--surface)] px-3 py-2"
              >
                <span>{v.label}</span>
                <span className="font-mono text-[var(--muted)]">{v.value}%</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
