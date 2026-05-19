"use client";

import { useSession } from "@/components/providers/session-provider";
import type { Permission } from "@mygaragepro/shared";
import Link from "next/link";

export function PermissionGate({
  permission,
  children,
}: {
  permission: Permission;
  children: React.ReactNode;
}) {
  const { hasPermission } = useSession();

  if (!hasPermission(permission)) {
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
