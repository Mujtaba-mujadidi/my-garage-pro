"use client";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useMounted } from "@/lib/use-mounted";

export type TableRowAction = {
  label: string;
  onClick?: () => void;
  href?: string;
  variant?: "default" | "danger";
};

type MenuPosition = {
  top: number;
  left: number;
  transform: string;
};

type TableRowActionsMenuProps = {
  actions: TableRowAction[];
  /** Accessible label for the menu trigger, e.g. "Actions for Jane Doe" */
  triggerLabel?: string;
};

const GAP = 4;
const MENU_MIN_WIDTH = 144;

function computePosition(trigger: HTMLElement, menuHeight: number): MenuPosition {
  const rect = trigger.getBoundingClientRect();
  const spaceBelow = window.innerHeight - rect.bottom;
  const openUp = spaceBelow < menuHeight + GAP && rect.top > spaceBelow;

  if (openUp) {
    return {
      top: rect.top - GAP,
      left: rect.right,
      transform: "translate(-100%, -100%)",
    };
  }

  return {
    top: rect.bottom + GAP,
    left: rect.right,
    transform: "translateX(-100%)",
  };
}

export function TableRowActionsMenu({
  actions,
  triggerLabel = "Row actions",
}: TableRowActionsMenuProps) {
  const mounted = useMounted();
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<MenuPosition | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const menuHeight = menuRef.current?.offsetHeight ?? actions.length * 36 + 8;
    setPosition(computePosition(trigger, menuHeight));
  }, [actions.length]);

  useLayoutEffect(() => {
    if (!open || !menuRef.current) return;
    updatePosition();
  }, [open, updatePosition, actions]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    function onScrollOrResize() {
      updatePosition();
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", onScrollOrResize);
    window.addEventListener("scroll", onScrollOrResize, true);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onScrollOrResize);
      window.removeEventListener("scroll", onScrollOrResize, true);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) setPosition(null);
  }, [open]);

  if (actions.length === 0) return null;

  const itemClass =
    "block w-full px-3 py-2 text-left text-xs font-medium hover:bg-[var(--background)]";

  const menu =
    open && position ? (
      <div
        ref={menuRef}
        role="menu"
        style={{
          position: "fixed",
          top: position.top,
          left: position.left,
          transform: position.transform,
          minWidth: MENU_MIN_WIDTH,
          zIndex: 50,
        }}
        className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)] py-1 shadow-lg"
      >
        {actions.map((action) => {
          const className = `${itemClass} ${
            action.variant === "danger"
              ? "text-red-600 dark:text-red-400"
              : "text-[var(--foreground)]"
          }`;

          if (action.href) {
            return (
              <Link
                key={action.label}
                role="menuitem"
                href={action.href}
                className={className}
                onClick={() => setOpen(false)}
              >
                {action.label}
              </Link>
            );
          }

          return (
            <button
              key={action.label}
              type="button"
              role="menuitem"
              className={className}
              onClick={() => {
                action.onClick?.();
                setOpen(false);
              }}
            >
              {action.label}
            </button>
          );
        })}
      </div>
    ) : null;

  return (
    <>
      <div className="inline-flex justify-end">
        <button
          ref={triggerRef}
          type="button"
          aria-expanded={open}
          aria-haspopup="menu"
          aria-label={triggerLabel}
          onClick={() => {
            if (open) {
              setOpen(false);
              return;
            }
            const trigger = triggerRef.current;
            if (trigger) {
              setPosition(computePosition(trigger, actions.length * 36 + 8));
            }
            setOpen(true);
          }}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--background)]"
        >
          ⋮
        </button>
      </div>
      {mounted && menu ? createPortal(menu, document.body) : null}
    </>
  );
}
