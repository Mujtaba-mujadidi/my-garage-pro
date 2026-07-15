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
import { selectTriggerClassName, type SelectOption } from "@/components/ui/select";

export type MultiSelectOption = SelectOption;

type MultiSelectProps = {
  values: string[];
  onChange: (values: string[]) => void;
  options: MultiSelectOption[];
  placeholder?: string;
  disabled?: boolean;
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

export function MultiSelect({
  values,
  onChange,
  options,
  placeholder = "Select…",
  disabled = false,
  className = "",
  triggerClassName = "",
  id: idProp,
  "aria-label": ariaLabel,
}: MultiSelectProps) {
  const mounted = useMounted();
  const autoId = useId();
  const id = idProp ?? autoId;
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);

  const selectedLabels = options
    .filter((o) => values.includes(o.value))
    .map((o) => o.label);
  const displayLabel =
    selectedLabels.length === 0
      ? ""
      : selectedLabels.length <= 2
        ? selectedLabels.join(", ")
        : `${selectedLabels.slice(0, 2).join(", ")} +${selectedLabels.length - 2}`;

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
      if ((e.target as Element).closest?.("[data-multi-select-menu]")) return;
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

  function toggle(value: string) {
    if (values.includes(value)) {
      onChange(values.filter((v) => v !== value));
    } else {
      onChange([...values, value]);
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
        data-multi-select-menu
        role="listbox"
        aria-multiselectable
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
        {options.map((opt) => {
          const selected = values.includes(opt.value);
          return (
            <li key={opt.value || "__empty"} role="presentation">
              <button
                type="button"
                role="option"
                aria-selected={selected}
                disabled={opt.disabled}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-[var(--background)] disabled:cursor-not-allowed disabled:opacity-40 ${
                  selected ? "bg-accent/10 font-medium text-accent" : "text-[var(--foreground)]"
                }`}
                onClick={() => !opt.disabled && toggle(opt.value)}
              >
                <span
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] ${
                    selected
                      ? "border-accent bg-accent text-white"
                      : "border-[var(--border)] bg-[var(--background)]"
                  }`}
                  aria-hidden
                >
                  {selected ? "✓" : ""}
                </span>
                {opt.label}
              </button>
            </li>
          );
        })}
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
