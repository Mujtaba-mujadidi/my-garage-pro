import Link from "next/link";

export function ModulePlaceholder({
  title,
  phaseLabel,
}: {
  title: string;
  phaseLabel: string;
}) {
  return (
    <>
      <p className="mb-2 text-xs text-[var(--muted)]">
        <Link href="/dashboard" className="hover:text-accent">
          Home
        </Link>{" "}
        / <span className="text-accent">{title}</span>
      </p>
      <h1 className="mb-2 text-2xl font-bold text-[var(--foreground)]">{title}</h1>
      <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface)] p-8 text-center">
        <p className="text-sm text-[var(--muted)]">
          This module is enabled for your garage but not built yet.
        </p>
        <p className="mt-2 text-xs font-medium uppercase tracking-wide text-accent">{phaseLabel}</p>
      </div>
    </>
  );
}
