"use client";

import { useSession } from "@/components/providers/session-provider";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { session, loading } = useSession();

  useEffect(() => {
    if (loading) return;
    if (!session) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }
    if (session.user.mustChangePassword) {
      router.replace("/login/change-password");
    }
  }, [loading, session, router, pathname]);

  if (loading) {
    return (
      <div className="flex h-dvh items-center justify-center bg-[var(--background)] text-sm text-[var(--muted)]">
        Loading…
      </div>
    );
  }

  if (!session || session.user.mustChangePassword) return null;

  return <>{children}</>;
}
