"use client";

import {
  MODULE_DESCRIPTIONS,
  MODULE_KEYS,
  MODULE_LABELS,
  type ModuleKey,
} from "@mygaragepro/shared";

type Props = {
  enabledModules: ModuleKey[];
  onToggle: (moduleKey: ModuleKey, enabled: boolean) => void;
  disabled?: boolean;
};

export function ModuleToggleList({ enabledModules, onToggle, disabled }: Props) {
  return (
    <ul className="divide-y divide-[var(--border)] overflow-hidden rounded-lg border border-[var(--border)]">
      {MODULE_KEYS.map((key) => {
        const on = enabledModules.includes(key);
        return (
          <li key={key}>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onToggle(key, !on)}
              aria-pressed={on}
              className={`flex w-full cursor-pointer items-center justify-between gap-4 bg-[var(--background)] px-4 py-3 text-left transition-colors hover:bg-[var(--surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-60`}
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-[var(--foreground)]">
                  {MODULE_LABELS[key]}
                </p>
                <p className="text-xs text-[var(--muted)]">{MODULE_DESCRIPTIONS[key]}</p>
              </div>
              <span className="relative inline-flex h-6 w-11 shrink-0 items-center">
                <span
                  className={`block h-6 w-11 rounded-full transition-colors ${
                    on ? "bg-accent" : "bg-[var(--border)]"
                  }`}
                />
                <span
                  className={`pointer-events-none absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                    on ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
