"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: "◉", enabled: true },
  { href: "/dashboard", label: "Repair jobs", icon: "⚙", enabled: false },
  { href: "/dashboard", label: "Used cars", icon: "🚗", enabled: false },
  { href: "/dashboard", label: "Customers", icon: "👤", enabled: false },
  { href: "/dashboard", label: "Invoices", icon: "📄", enabled: false },
  { href: "/dashboard", label: "Reports", icon: "📈", enabled: false },
] as const;

export function Sidebar({ collapsed }: { collapsed: boolean }) {
  const pathname = usePathname();
  const width = collapsed ? "68px" : "220px";

  return (
    <aside
      className="flex min-h-0 shrink-0 flex-col self-stretch bg-rail text-white transition-[width] duration-200"
      style={{ width }}
    >
      <div
        className={cn(
          "flex border-b border-white/10 pb-5 pt-4",
          collapsed ? "justify-center px-2" : "gap-3 px-4",
        )}
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-accent to-orange-400 text-[11px] font-bold">
          MGP
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="truncate text-[15px] font-bold">MyGaragePro</p>
            <p className="truncate text-[11px] text-rail-foreground">Demo Garage Ltd</p>
          </div>
        )}
      </div>

      <nav className="min-h-0 flex-1 space-y-0.5 overflow-y-auto p-2">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href && item.label === "Dashboard";
          return (
            <Link
              key={item.label}
              href={item.enabled ? item.href : "#"}
              onClick={(e) => !item.enabled && e.preventDefault()}
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
              {!collapsed && <span>{item.label}</span>}
              {!collapsed && !item.enabled && (
                <span className="ml-auto text-[10px] uppercase">Soon</span>
              )}
            </Link>
          );
        })}
        {!collapsed && (
          <p className="px-3 pb-1 pt-4 text-[10px] font-medium uppercase tracking-wider text-slate-500">
            Settings
          </p>
        )}
      </nav>

      <div className="mt-auto shrink-0">
        {!collapsed && (
          <p className="border-t border-white/10 px-4 py-3 text-[10px] text-rail-foreground">
            Phase 0 — UI shell
          </p>
        )}
      </div>
    </aside>
  );
}
