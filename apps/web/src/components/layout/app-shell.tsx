"use client";

import { useCallback, useEffect, useState } from "react";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { StagingBanner } from "./staging-banner";

const DESKTOP_MIN = "(min-width: 1024px)";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [isDesktop, setIsDesktop] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);

  useEffect(() => {
    document.documentElement.classList.add("app-shell-active");
    document.body.classList.add("overflow-hidden");
    return () => {
      document.documentElement.classList.remove("app-shell-active");
      document.body.classList.remove("overflow-hidden");
    };
  }, []);

  useEffect(() => {
    const mq = window.matchMedia(DESKTOP_MIN);
    const sync = () => {
      const desktop = mq.matches;
      setIsDesktop(desktop);
      if (desktop) setMobileOpen(false);
    };
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  const closeMobile = useCallback(() => setMobileOpen(false), []);
  const openMobile = useCallback(() => setMobileOpen(true), []);
  const toggleDesktop = useCallback(() => setDesktopCollapsed((c) => !c), []);

  return (
    <div className="flex h-dvh max-h-dvh flex-col overflow-hidden">
      <StagingBanner />
      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        {!isDesktop && mobileOpen && (
          <button
            type="button"
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            aria-label="Close menu"
            onClick={closeMobile}
          />
        )}

        <Sidebar
          isDesktop={isDesktop}
          mobileOpen={mobileOpen}
          desktopCollapsed={desktopCollapsed}
          onCloseMobile={closeMobile}
          onToggleDesktop={toggleDesktop}
        />

        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[var(--background)] text-[var(--foreground)]">
          <Topbar showMenuButton={!isDesktop} onOpenMobileMenu={openMobile} />
          <main className="scroll-pane h-0 flex-1 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-5">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
