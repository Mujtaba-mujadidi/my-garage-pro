"use client";

import { SignOutButton } from "@/components/layout/sign-out-button";
import { useSession } from "@/components/providers/session-provider";
import { FOOTER_NAV, MAIN_NAV, type NavItem } from "@/lib/nav-items";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { cn } from "@/lib/utils";

type SidebarProps = {
  isDesktop: boolean;
  mobileOpen: boolean;
  desktopCollapsed: boolean;
  onCloseMobile: () => void;
  onToggleDesktop: () => void;
};

function isNavVisible(item: NavItem, role: string, permissions: string[]): boolean {
  if (item.superAdminOnly) return role === "SUPER_ADMIN";
  if (role === "SUPER_ADMIN") return item.href === "/dashboard";
  if (item.permission) return permissions.includes(item.permission);
  return true;
}

function isNavEnabled(
  item: NavItem,
  permissions: string[],
  enabledModules: string[],
): boolean {
  if (item.href === "/dashboard") return true;
  if (item.href === "/admin") return permissions.includes("platform.garage.manage");
  if (item.href === "/settings") return permissions.includes("settings.read");
  if (item.href === "/users") return permissions.includes("users.read");
  if (item.permission) return permissions.includes(item.permission);
  if (item.moduleKey) return enabledModules.includes(item.moduleKey);
  return true;
}

export function Sidebar({
  isDesktop,
  mobileOpen,
  desktopCollapsed,
  onCloseMobile,
  onToggleDesktop,
}: SidebarProps) {
  const pathname = usePathname();
  const { session } = useSession();
  const collapsed = isDesktop && desktopCollapsed;
  const showLabels = !collapsed;

  const role = session?.user.role ?? "";
  const enabledModules = session?.enabledModules ?? [];
  const permissions = session?.permissions ?? [];

  useEffect(() => {
    if (!isDesktop) onCloseMobile();
  }, [pathname, isDesktop, onCloseMobile]);

  const visibleMain = MAIN_NAV.filter((item) => isNavVisible(item, role, permissions));
  const visibleFooter = FOOTER_NAV.filter((item) => isNavVisible(item, role, permissions));

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
            <p className="truncate text-[11px] text-rail-foreground">
              {session?.garage?.name ?? "Platform"}
            </p>
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
          >
            {collapsed ? "»" : "«"}
          </button>
        )}
      </div>

      <nav className="min-h-0 flex-1 space-y-0.5 overflow-y-auto p-2">
        {visibleMain.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const enabled = isNavEnabled(item, permissions, enabledModules);
          return (
            <Link
              key={item.href + item.label}
              href={enabled ? item.href : "#"}
              onClick={(e) => {
                if (!enabled) e.preventDefault();
                else if (!isDesktop) onCloseMobile();
              }}
              title={collapsed ? item.label : undefined}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-colors",
                collapsed && "justify-center px-2",
                active
                  ? "bg-accent text-white"
                  : "text-rail-foreground hover:bg-white/5 hover:text-white",
                !enabled && "cursor-not-allowed opacity-40",
              )}
            >
              <span className="w-5 shrink-0 text-center text-xs">{item.icon}</span>
              {showLabels && <span className="min-w-0 flex-1 truncate">{item.label}</span>}
              {showLabels && !enabled && item.phaseLabel && (
                <span className="shrink-0 text-[10px] uppercase">{item.phaseLabel}</span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto shrink-0 space-y-1 border-t border-white/10 p-2">
        {visibleFooter.map((item) => {
          const active = pathname === item.href;
          const enabled = isNavEnabled(item, permissions, enabledModules);
          return (
            <Link
              key={item.href}
              href={enabled ? item.href : "#"}
              onClick={(e) => {
                if (!enabled) e.preventDefault();
                else if (!isDesktop) onCloseMobile();
              }}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-colors",
                collapsed && "justify-center px-2",
                active ? "bg-white/10 text-white" : "text-rail-foreground hover:bg-white/5",
              )}
            >
              <span className="w-5 shrink-0 text-center text-xs">{item.icon}</span>
              {showLabels && <span>{item.label}</span>}
            </Link>
          );
        })}
        <SignOutButton variant="sidebar" sidebarCollapsed={collapsed} />
        {showLabels && (
          <p className="px-2 pb-1 text-[10px] text-rail-foreground">Phase 1 — Auth & settings</p>
        )}
      </div>
    </aside>
  );
}
