"use client";

import { useSession } from "@/components/providers/session-provider";
import { useMounted } from "@/lib/use-mounted";
import { canAccessNavItem } from "@/lib/nav-access";
import { MAIN_NAV } from "@/lib/nav-items";
import type { ModuleKey } from "@mygaragepro/shared";
import Link from "next/link";
import { GateLoading } from "./gate-loading";

export function ModuleGate({
  moduleKey,
  children,
}: {
  moduleKey: ModuleKey;
  children: React.ReactNode;
}) {
  const mounted = useMounted();
  const { session, loading } = useSession();
  const role = session?.user.role ?? "";
  const permissions = session?.permissions ?? [];
  const enabledModules = session?.enabledModules ?? [];

  const navItem = MAIN_NAV.find((item) => item.moduleKey === moduleKey);
  const allowed =
    session !== null &&
    navItem !== undefined &&
    canAccessNavItem(navItem, role, permissions, enabledModules);

  if (!mounted) {
    return <GateLoading />;
  }

  if (loading && !session) {
    return <GateLoading />;
  }

  if (!allowed) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center">
        <h1 className="text-lg font-semibold text-[var(--foreground)]">Module not available</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          This module is not enabled for your garage or your role cannot access it.
        </p>
        <Link
          href="/dashboard"
          className="mt-4 inline-block text-sm font-medium text-accent hover:underline"
        >
          Back to dashboard
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}
