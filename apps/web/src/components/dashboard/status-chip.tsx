import { cn } from "@/lib/utils";

const variants = {
  progress: "bg-[var(--chip-progress-bg)] text-[var(--chip-progress-fg)]",
  parts: "bg-[var(--chip-parts-bg)] text-[var(--chip-parts-fg)]",
  ready: "bg-[var(--chip-ready-bg)] text-[var(--chip-ready-fg)]",
} as const;

export function StatusChip({
  children,
  variant,
}: {
  children: React.ReactNode;
  variant: keyof typeof variants;
}) {
  return (
    <span
      className={cn(
        "inline-block rounded-md px-2 py-0.5 text-[11px] font-semibold",
        variants[variant],
      )}
    >
      {children}
    </span>
  );
}
