"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

type TopbarProps = {
  onToggleSidebar: () => void;
  sidebarCollapsed: boolean;
};

export function Topbar({ onToggleSidebar }: TopbarProps) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const isDark = mounted && (resolvedTheme === "dark" || theme === "dark");

  return (
    <header className="flex shrink-0 items-center gap-3 border-b border-[var(--border)] bg-[var(--surface)] px-4 py-3">
      <button
        type="button"
        onClick={onToggleSidebar}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--background)] text-lg text-[var(--foreground)]"
        aria-label="Toggle sidebar"
      >
        ☰
      </button>
      <input
        type="search"
        placeholder="Search reg, customer, job #…"
        className="max-w-xs flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)]"
      />
      <div className="ml-auto flex items-center gap-3">
        <button
          type="button"
          onClick={() => setTheme(isDark ? "light" : "dark")}
          className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-xs font-medium text-[var(--foreground)]"
        >
          {mounted ? (isDark ? "Light" : "Dark") : "Theme"}
        </button>
        <button
          type="button"
          className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--background)]"
          aria-label="Notifications"
        >
          🔔
          <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white">
            3
          </span>
        </button>
        <div className="flex items-center gap-2 text-sm font-medium text-[var(--foreground)]">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--chart-a)] text-xs font-semibold text-white">
            JO
          </span>
          <span className="hidden sm:inline">James Owner</span>
        </div>
      </div>
    </header>
  );
}
