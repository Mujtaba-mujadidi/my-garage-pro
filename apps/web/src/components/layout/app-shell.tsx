"use client";

import { useEffect, useState } from "react";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { StagingBanner } from "./staging-banner";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(max-width: 1024px)").matches) {
      setCollapsed(true);
    }
  }, []);

  return (
    <div className="flex h-dvh max-h-dvh flex-col overflow-hidden">
      <StagingBanner />
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <Sidebar collapsed={collapsed} />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[var(--background)] text-[var(--foreground)]">
          <Topbar
            onToggleSidebar={() => setCollapsed((c) => !c)}
            sidebarCollapsed={collapsed}
          />
          <main className="min-h-0 flex-1 overflow-y-auto p-5">{children}</main>
        </div>
      </div>
    </div>
  );
}
