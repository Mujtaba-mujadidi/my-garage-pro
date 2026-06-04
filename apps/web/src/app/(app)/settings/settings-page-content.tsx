"use client";

import { Suspense, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PermissionGate } from "@/components/layout/permission-gate";
import { useSession } from "@/components/providers/session-provider";
import { GeneralSettingsPanel } from "@/components/settings/general-settings-panel";
import { RolesAccessPanel } from "@/components/settings/roles-access-panel";
import { TabBar, type TabItem } from "@/components/ui/tab-bar";

export type SettingsTab = "general" | "roles";

const ALL_TABS: TabItem<SettingsTab>[] = [
  { id: "general", label: "General" },
  { id: "roles", label: "Roles & access" },
];

function SettingsPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { hasPermission } = useSession();

  const canManageRoles = hasPermission("permissions.manage");

  const tabs = useMemo(
    () => (canManageRoles ? ALL_TABS : ALL_TABS.filter((t) => t.id === "general")),
    [canManageRoles],
  );

  const tabParam = searchParams.get("tab");
  const activeTab: SettingsTab =
    tabParam === "roles" && canManageRoles ? "roles" : "general";

  function setTab(tab: SettingsTab) {
    const params = new URLSearchParams(searchParams.toString());
    if (tab === "general") {
      params.delete("tab");
    } else {
      params.set("tab", tab);
    }
    const q = params.toString();
    router.replace(q ? `/settings?${q}` : "/settings", { scroll: false });
  }

  return (
    <PermissionGate permission="settings.read">
      <p className="mb-2 text-xs text-[var(--muted)]">
        Home / <span className="text-accent">Settings</span>
      </p>
      <h1 className="mb-6 text-2xl font-bold text-[var(--foreground)]">Garage settings</h1>

      <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
        {tabs.length > 1 && (
          <TabBar tabs={tabs} active={activeTab} onChange={setTab} className="bg-[var(--surface)]" />
        )}
        <div className="p-4 sm:p-5" role="tabpanel">
          {activeTab === "general" && <GeneralSettingsPanel />}
          {activeTab === "roles" && canManageRoles && (
            <PermissionGate permission="permissions.manage">
              <RolesAccessPanel />
            </PermissionGate>
          )}
        </div>
      </div>
    </PermissionGate>
  );
}

export function SettingsPageContent() {
  return (
    <Suspense
      fallback={
        <div>
          <p className="mb-2 text-xs text-[var(--muted)]">
            Home / <span className="text-accent">Settings</span>
          </p>
          <h1 className="mb-6 text-2xl font-bold">Garage settings</h1>
          <p className="text-sm text-[var(--muted)]">Loading…</p>
        </div>
      }
    >
      <SettingsPageInner />
    </Suspense>
  );
}
