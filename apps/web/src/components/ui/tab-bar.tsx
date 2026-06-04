"use client";

export type TabItem<T extends string> = {
  id: T;
  label: string;
};

type Props<T extends string> = {
  tabs: TabItem<T>[];
  active: T;
  onChange: (tab: T) => void;
  className?: string;
};

export function TabBar<T extends string>({ tabs, active, onChange, className = "" }: Props<T>) {
  return (
    <div
      className={`flex gap-1 overflow-x-auto border-b border-[var(--border)] px-1 ${className}`}
      role="tablist"
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={active === tab.id}
          onClick={() => onChange(tab.id)}
          className={`shrink-0 rounded-t-lg px-4 py-2.5 text-sm font-medium transition-colors ${
            active === tab.id
              ? "border border-b-0 border-[var(--border)] bg-[var(--surface)] text-accent"
              : "text-[var(--muted)] hover:bg-[var(--background)] hover:text-[var(--foreground)]"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
