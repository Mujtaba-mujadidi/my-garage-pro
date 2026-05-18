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
    <div className="flex min-h-screen flex-col">
      <StagingBanner />
      <div className="flex min-h-0 flex-1">
        <Sidebar collapsed={collapsed} />
        <div className="flex min-w-0 flex-1 flex-col bg-[var(--background)] text-[var(--foreground)]">
          <Topbar
            onToggleSidebar={() => setCollapsed((c) => !c)}
            sidebarCollapsed={collapsed}
          />
          <main className="flex-1 overflow-auto p-5">{children}</main>
        </div>
      </div>
    </div>
  );
}
