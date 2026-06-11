"use client";

import { useSession } from "@/components/providers/session-provider";
import { useMounted } from "@/lib/use-mounted";
import type { Permission } from "@mygaragepro/shared";
import Link from "next/link";
import { GateLoading } from "./gate-loading";

export function PermissionGate({
  permission,
  children,
}: {
  permission: Permission | Permission[];
  children: React.ReactNode;
}) {
  const mounted = useMounted();
  const { hasPermission, session, loading } = useSession();
  const required = Array.isArray(permission) ? permission : [permission];
  const allowed = required.some((p) => hasPermission(p));

  if (!mounted) {
    return <GateLoading />;
  }

  if (loading && !session) {
    return <GateLoading />;
  }

  if (!allowed) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center">
        <h1 className="text-lg font-semibold text-[var(--foreground)]">Access denied</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Your role does not have permission to view this area.
        </p>
        <Link href="/dashboard" className="mt-4 inline-block text-sm font-medium text-accent hover:underline">
          Back to dashboard
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}
