"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { useMounted } from "@/lib/use-mounted";

export type SelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

export const selectTriggerClassName =
  "flex w-full min-h-[2.5rem] items-end justify-between rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 pr-9 text-left text-sm text-[var(--foreground)] transition-colors hover:border-[var(--muted)] focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25 disabled:cursor-not-allowed disabled:opacity-50";

type SelectProps = {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  triggerClassName?: string;
  id?: string;
  "aria-label"?: string;
};

type MenuPosition = {
  top: number;
  left: number;
  width: number;
  openAbove: boolean;
};

const MENU_MAX_HEIGHT_PX = 240;

function ChevronDown() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden
      className="text-[var(--muted)]"
    >
      <path
        d="M4 6l4 4 4-4"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Select({
  value,
  onChange,
  options,
  placeholder = "Select…",
  disabled = false,
  required = false,
  className = "",
  triggerClassName = "",
  id: idProp,
  "aria-label": ariaLabel,
}: SelectProps) {
  const mounted = useMounted();
  const autoId = useId();
  const id = idProp ?? autoId;
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);

  const selected = options.find((o) => o.value === value);
  const displayLabel = selected?.label ?? (value ? value : "");

  const updateMenuPosition = () => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const openAbove =
      spaceBelow < MENU_MAX_HEIGHT_PX + 8 && spaceAbove > spaceBelow;
    setMenuPosition({
      top: openAbove ? rect.top - 4 : rect.bottom + 4,
      left: rect.left,
      width: rect.width,
      openAbove,
    });
  };

  useLayoutEffect(() => {
    if (!open) {
      setMenuPosition(null);
      return;
    }
    updateMenuPosition();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      const target = e.target as Node;
      if (rootRef.current?.contains(target)) return;
      if ((e.target as Element).closest?.("[data-select-menu]")) return;
      setOpen(false);
    }
    function onEscape(e: globalThis.KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    function onReposition() {
      updateMenuPosition();
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onEscape);
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onEscape);
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [open]);

  function pick(next: string) {
    onChange(next);
    setOpen(false);
  }

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    if (disabled) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setOpen((o) => !o);
    }
    if (e.key === "Escape") setOpen(false);
  }

  if (!mounted) {
    return (
      <div className={`relative w-full ${className}`.trim()}>
        <div
          className={`${selectTriggerClassName} ${triggerClassName} pointer-events-none`.trim()}
          aria-hidden
        >
          <span
            className={`min-w-0 flex-1 truncate pb-0.5 ${!displayLabel ? "text-[var(--muted)]" : ""}`}
          >
            {displayLabel || placeholder}
          </span>
          <span className="pointer-events-none absolute bottom-2 right-2.5">
            <ChevronDown />
          </span>
        </div>
      </div>
    );
  }

  const menu =
    open && menuPosition ? (
      <ul
        data-select-menu
        role="listbox"
        aria-labelledby={id}
        style={{
          position: "fixed",
          top: menuPosition.top,
          left: menuPosition.left,
          width: menuPosition.width,
          transform: menuPosition.openAbove ? "translateY(-100%)" : undefined,
        }}
        className="z-[200] max-h-60 overflow-auto rounded-lg border border-[var(--border)] bg-[var(--surface)] py-1 text-sm shadow-lg"
      >
        {options.map((opt) => (
          <li key={opt.value || "__empty"} role="presentation">
            <button
              type="button"
              role="option"
              aria-selected={opt.value === value}
              disabled={opt.disabled}
              className={`w-full px-3 py-2 text-left hover:bg-[var(--background)] disabled:cursor-not-allowed disabled:opacity-40 ${
                opt.value === value ? "bg-accent/10 font-medium text-accent" : "text-[var(--foreground)]"
              }`}
              onClick={() => !opt.disabled && pick(opt.value)}
            >
              {opt.label}
            </button>
          </li>
        ))}
      </ul>
    ) : null;

  return (
    <div ref={rootRef} className={`relative w-full ${open ? "z-10" : ""} ${className}`.trim()}>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        aria-required={required || undefined}
        className={`${selectTriggerClassName} ${triggerClassName}`.trim()}
        onClick={() => !disabled && setOpen((o) => !o)}
        onKeyDown={onKeyDown}
      >
        <span className={`min-w-0 flex-1 truncate pb-0.5 ${!displayLabel ? "text-[var(--muted)]" : ""}`}>
          {displayLabel || placeholder}
        </span>
        <span
          className={`pointer-events-none absolute bottom-2 right-2.5 transition-transform ${open ? "rotate-180" : ""}`}
        >
          <ChevronDown />
        </span>
      </button>

      {mounted && menu ? createPortal(menu, document.body) : null}
    </div>
  );
}
