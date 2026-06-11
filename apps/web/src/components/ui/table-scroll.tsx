"use client";

import type { ReactNode } from "react";

/** Caps table height so long lists scroll instead of stretching the page. */
export const TABLE_SCROLL_MAX_HEIGHT =
  "max-h-[min(28rem,calc(100vh-14rem))]";

/** Shorter cap for tables inside modals or compact panels. */
export const TABLE_SCROLL_COMPACT_MAX_HEIGHT = "max-h-56";

type TableScrollProps = {
  children: ReactNode;
  className?: string;
  maxHeightClass?: string;
};

export function TableScroll({
  children,
  className = "",
  maxHeightClass = TABLE_SCROLL_MAX_HEIGHT,
}: TableScrollProps) {
  return (
    <div className={`overflow-auto ${maxHeightClass}${className ? ` ${className}` : ""}`}>
      {children}
    </div>
  );
}

/** Keep column headers visible while scrolling table body. */
export const STICKY_TABLE_HEAD_CLASS =
  "sticky top-0 z-10 bg-[var(--background)] shadow-[0_1px_0_var(--border)]";
