type KpiCardProps = {
  label: string;
  value: string;
  delta?: string;
  deltaTone?: "up" | "down" | "warn";
};

export function KpiCard({ label, value, delta, deltaTone = "up" }: KpiCardProps) {
  const deltaClass =
    deltaTone === "down"
      ? "bg-[var(--delta-down-bg)] text-red-500"
      : deltaTone === "warn"
        ? "bg-[var(--delta-warn-bg)] text-amber-600 dark:text-amber-400"
        : "bg-[var(--delta-up-bg)] text-emerald-600 dark:text-emerald-400";

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 text-[var(--foreground)]">
      <p className="text-xs font-medium text-[var(--muted)]">{label}</p>
      <p className="mt-1 text-3xl font-bold tabular-nums">{value}</p>
      {delta && (
        <span className={`mt-2 inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${deltaClass}`}>
          {delta}
        </span>
      )}
    </div>
  );
}
