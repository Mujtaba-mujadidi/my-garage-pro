"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";

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
  id?: string;
  "aria-label"?: string;
};

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
  id: idProp,
  "aria-label": ariaLabel,
}: SelectProps) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  const selected = options.find((o) => o.value === value);
  const displayLabel = selected?.label ?? (value ? value : "");

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onEscape(e: globalThis.KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onEscape);
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

  return (
    <div ref={rootRef} className={`relative w-full ${className}`.trim()}>
      <button
        id={id}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        aria-required={required || undefined}
        className={selectTriggerClassName}
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

      {open && (
        <ul
          role="listbox"
          aria-labelledby={id}
          className="absolute right-0 top-full z-50 mt-1 max-h-60 min-w-full overflow-auto rounded-lg border border-[var(--border)] bg-[var(--surface)] py-1 text-sm shadow-lg"
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
      )}
    </div>
  );
}
