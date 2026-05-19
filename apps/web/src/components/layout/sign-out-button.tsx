"use client";

import { clearDemoSession } from "@/lib/demo-auth";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

type SignOutButtonProps = {
  variant?: "topbar" | "sidebar";
  sidebarCollapsed?: boolean;
  className?: string;
};

export function SignOutButton({
  variant = "topbar",
  sidebarCollapsed = false,
  className,
}: SignOutButtonProps) {
  const router = useRouter();

  function handleSignOut() {
    clearDemoSession();
    router.replace("/login");
  }

  if (variant === "sidebar") {
    return (
      <button
        type="button"
        onClick={handleSignOut}
        title="Sign out"
        className={cn(
          "flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-[13px] font-medium text-rail-foreground transition-colors hover:bg-white/5 hover:text-white",
          className,
        )}
      >
        <span className="w-5 shrink-0 text-center text-xs">⎋</span>
        {!sidebarCollapsed && <span>Sign out</span>}
        {sidebarCollapsed && <span className="sr-only">Sign out</span>}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      className={cn(
        "shrink-0 rounded-lg border border-[var(--border)] bg-[var(--background)] px-2.5 py-2 text-xs font-medium text-[var(--foreground)] hover:bg-[var(--border)]/30 sm:px-3",
        className,
      )}
    >
      Sign out
    </button>
  );
}
