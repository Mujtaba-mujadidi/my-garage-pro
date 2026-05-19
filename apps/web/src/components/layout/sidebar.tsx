"use client";

import { SignOutButton } from "@/components/layout/sign-out-button";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: "◉", enabled: true },
  { href: "/dashboard", label: "Repair jobs", icon: "⚙", enabled: false },
  { href: "/dashboard", label: "Used cars", icon: "🚗", enabled: false },
  { href: "/dashboard", label: "Customers", icon: "👤", enabled: false },
  { href: "/dashboard", label: "Invoices", icon: "📄", enabled: false },
  { href: "/dashboard", label: "Reports", icon: "📈", enabled: false },
] as const;

type SidebarProps = {
  isDesktop: boolean;
  mobileOpen: boolean;
  desktopCollapsed: boolean;
  onCloseMobile: () => void;
  onToggleDesktop: () => void;
};

export function Sidebar({
  isDesktop,
  mobileOpen,
  desktopCollapsed,
  onCloseMobile,
  onToggleDesktop,
}: SidebarProps) {
  const pathname = usePathname();
  const collapsed = isDesktop && desktopCollapsed;
  const showLabels = !collapsed;

  useEffect(() => {
    if (!isDesktop) onCloseMobile();
  }, [pathname, isDesktop, onCloseMobile]);

  return (
    <aside
      className={cn(
        "flex flex-col bg-rail text-white transition-[transform,width] duration-200 ease-out",
        isDesktop
          ? "relative z-auto min-h-0 shrink-0 self-stretch"
          : "fixed inset-y-0 left-0 z-50 w-[min(280px,85vw)] shadow-2xl",
        !isDesktop && (mobileOpen ? "translate-x-0" : "-translate-x-full pointer-events-none"),
      )}
      style={isDesktop ? { width: collapsed ? "68px" : "220px" } : undefined}
      aria-hidden={!isDesktop && !mobileOpen}
    >
      <div
        className={cn(
          "flex shrink-0 border-b border-white/10 pb-4 pt-4",
          collapsed ? "flex-col items-center gap-2 px-2" : "flex-row items-center gap-2 px-3",
        )}
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-accent to-orange-400 text-[11px] font-bold">
          MGP
        </div>

        {showLabels && (
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-bold">MyGaragePro</p>
            <p className="truncate text-[11px] text-rail-foreground">Demo Garage Ltd</p>
          </div>
        )}

        {!isDesktop && (
          <button
            type="button"
            onClick={onCloseMobile}
            className="ml-auto flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-rail-foreground hover:bg-white/10 hover:text-white"
            aria-label="Close menu"
          >
            ✕
          </button>
        )}

        {isDesktop && (
          <button
            type="button"
            onClick={onToggleDesktop}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-rail-foreground hover:bg-white/10 hover:text-white"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? "»" : "«"}
          </button>
        )}
      </div>

      <nav className="min-h-0 flex-1 space-y-0.5 overflow-y-auto p-2">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href && item.label === "Dashboard";
          return (
            <Link
              key={item.label}
              href={item.enabled ? item.href : "#"}
              onClick={(e) => {
                if (!item.enabled) e.preventDefault();
                else if (!isDesktop) onCloseMobile();
              }}
              title={collapsed ? item.label : undefined}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-colors",
                collapsed && "justify-center px-2",
                active
                  ? "bg-accent text-white"
                  : "text-rail-foreground hover:bg-white/5 hover:text-white",
                !item.enabled && "cursor-not-allowed opacity-40",
              )}
            >
              <span className="w-5 shrink-0 text-center text-xs">{item.icon}</span>
              {showLabels && <span>{item.label}</span>}
              {showLabels && !item.enabled && (
                <span className="ml-auto text-[10px] uppercase">Soon</span>
              )}
            </Link>
          );
        })}
        {showLabels && (
          <p className="px-3 pb-1 pt-4 text-[10px] font-medium uppercase tracking-wider text-slate-500">
            Settings
          </p>
        )}
      </nav>

      <div className="mt-auto shrink-0 space-y-1 border-t border-white/10 p-2">
        <SignOutButton
          variant="sidebar"
          sidebarCollapsed={collapsed}
          className={cn(collapsed && "justify-center px-2")}
        />
        {showLabels && (
          <p className="px-2 pb-1 text-[10px] text-rail-foreground">Phase 0 — UI shell</p>
        )}
      </div>
    </aside>
  );
}
