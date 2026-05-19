"use client";

import { SignOutButton } from "@/components/layout/sign-out-button";
import { useSession } from "@/components/providers/session-provider";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

type TopbarProps = {
  showMenuButton: boolean;
  onOpenMobileMenu: () => void;
};

export function Topbar({ showMenuButton, onOpenMobileMenu }: TopbarProps) {
  const { session } = useSession();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const initials = session?.user.displayName
    ?.split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() ?? "?";

  useEffect(() => setMounted(true), []);

  const isDark = mounted && (resolvedTheme === "dark" || theme === "dark");

  return (
    <header className="shrink-0 border-b border-[var(--border)] bg-[var(--surface)]">
      <div className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:gap-3 sm:px-4 sm:py-3">
        <div className="flex min-w-0 items-center gap-2">
          {showMenuButton && (
            <button
              type="button"
              onClick={onOpenMobileMenu}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--background)] text-lg text-[var(--foreground)] lg:hidden"
              aria-label="Open menu"
            >
              ☰
            </button>
          )}
          <input
            type="search"
            placeholder="Search…"
            className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] sm:max-w-xs sm:flex-none sm:min-w-[12rem] lg:min-w-[16rem]"
          />
        </div>

        <div className="flex min-w-0 flex-wrap items-center justify-end gap-2 sm:ml-auto sm:shrink-0 sm:flex-nowrap">
          <button
            type="button"
            onClick={() => setTheme(isDark ? "light" : "dark")}
            className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-2.5 py-2 text-xs font-medium text-[var(--foreground)] sm:px-3"
            aria-label={mounted ? (isDark ? "Switch to light mode" : "Switch to dark mode") : "Toggle theme"}
          >
            {mounted ? (isDark ? "Light" : "Dark") : "Theme"}
          </button>
          <button
            type="button"
            className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--background)]"
            aria-label="Notifications"
          >
            🔔
            <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white">
              3
            </span>
          </button>
          <div className="flex min-w-0 items-center gap-2 text-sm font-medium text-[var(--foreground)]">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--chart-a)] text-xs font-semibold text-white">
              {initials}
            </span>
            <span className="hidden max-w-[7rem] truncate sm:inline md:max-w-none">
              {session?.user.displayName ?? "User"}
            </span>
          </div>
          <SignOutButton />
        </div>
      </div>
    </header>
  );
}
