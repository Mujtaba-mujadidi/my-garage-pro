"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { useMounted } from "@/lib/use-mounted";
import { selectTriggerClassName, type SelectOption } from "./select";

type SearchableSelectProps = {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  id?: string;
  "aria-label"?: string;
  searchPlaceholder?: string;
  /** Show "Add …" when search text does not match an existing option. */
  allowCreate?: boolean;
  onCreate?: (label: string) => void | Promise<void>;
  createHint?: (query: string) => string;
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

export function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = "Select…",
  disabled = false,
  required = false,
  className = "",
  id: idProp,
  "aria-label": ariaLabel,
  searchPlaceholder = "Search…",
  allowCreate = false,
  onCreate,
  createHint = (q) => `Add "${q}"`,
}: SearchableSelectProps) {
  const mounted = useMounted();
  const autoId = useId();
  const id = idProp ?? autoId;
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);

  const selected = options.find((o) => o.value === value);
  const displayLabel = selected?.label ?? (value ? value : "");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  const canCreate = useMemo(() => {
    if (!allowCreate || !onCreate || !query.trim() || creating) return false;
    const q = query.trim().toLowerCase();
    return !options.some((o) => o.label.toLowerCase() === q);
  }, [allowCreate, onCreate, query, options, creating]);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => searchRef.current?.focus(), 0);
    function onPointerDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    function onEscape(e: globalThis.KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onEscape);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onEscape);
    };
  }, [open]);

  function pick(next: string) {
    onChange(next);
    setOpen(false);
    setQuery("");
  }

  async function handleCreate() {
    if (!onCreate || !query.trim()) return;
    setCreating(true);
    try {
      await onCreate(query.trim());
      setOpen(false);
      setQuery("");
    } finally {
      setCreating(false);
    }
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
        <div className={`${selectTriggerClassName} pointer-events-none`} aria-hidden>
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
        <div className="absolute right-0 top-full z-50 mt-1 min-w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] py-1 text-sm shadow-lg">
          <div className="border-b border-[var(--border)] px-2 py-1.5">
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-2.5 py-1.5 text-sm text-[var(--foreground)] focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25"
              onKeyDown={(e) => {
                if (e.key === "Enter" && canCreate) {
                  e.preventDefault();
                  void handleCreate();
                }
              }}
            />
          </div>
          <ul role="listbox" aria-labelledby={id} className="max-h-52 overflow-auto py-1">
            {filtered.length === 0 && !canCreate ? (
              <li className="px-3 py-2 text-[var(--muted)]">No matches</li>
            ) : (
              filtered.map((opt) => (
                <li key={opt.value || "__empty"} role="presentation">
                  <button
                    type="button"
                    role="option"
                    aria-selected={opt.value === value}
                    disabled={opt.disabled}
                    className={`w-full px-3 py-2 text-left hover:bg-[var(--background)] disabled:cursor-not-allowed disabled:opacity-40 ${
                      opt.value === value
                        ? "bg-accent/10 font-medium text-accent"
                        : "text-[var(--foreground)]"
                    }`}
                    onClick={() => !opt.disabled && pick(opt.value)}
                  >
                    {opt.label}
                  </button>
                </li>
              ))
            )}
            {canCreate ? (
              <li role="presentation" className="border-t border-[var(--border)]">
                <button
                  type="button"
                  className="w-full px-3 py-2 text-left font-medium text-accent hover:bg-[var(--background)] disabled:opacity-50"
                  disabled={creating}
                  onClick={() => void handleCreate()}
                >
                  {creating ? "Adding…" : createHint(query.trim())}
                </button>
              </li>
            ) : null}
          </ul>
        </div>
      )}
    </div>
  );
}
