"use client";

import { diffModules } from "@/lib/module-utils";
import { MODULE_LABELS, type ModuleKey } from "@mygaragepro/shared";

type Props = {
  garageName: string;
  before: ModuleKey[];
  after: ModuleKey[];
};

function ModuleChips({ keys, tone }: { keys: ModuleKey[]; tone: "add" | "remove" }) {
  if (keys.length === 0) return null;
  const className =
    tone === "add"
      ? "border-green-200 bg-green-50 text-green-800 dark:border-green-900 dark:bg-green-950/50 dark:text-green-300"
      : "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300";

  return (
    <ul className="mt-2 flex flex-wrap gap-1.5">
      {keys.map((key) => (
        <li
          key={key}
          className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${className}`}
        >
          {tone === "add" ? "+ " : "− "}
          {MODULE_LABELS[key]}
        </li>
      ))}
    </ul>
  );
}

export function ModuleSaveConfirmBody({ garageName, before, after }: Props) {
  const { added, removed } = diffModules(before, after);

  return (
    <>
      <p>
        Save module access for <strong className="text-[var(--foreground)]">{garageName}</strong>?
      </p>

      <div className="mt-4 rounded-lg border border-[var(--border)] bg-[var(--background)] p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
          After save
        </p>
        <p className="mt-1 text-sm text-[var(--foreground)]">
          <span className="text-2xl font-bold text-accent">{after.length}</span>{" "}
          module{after.length === 1 ? "" : "s"} enabled
        </p>
      </div>

      {added.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-medium text-green-700 dark:text-green-400">Enabling</p>
          <ModuleChips keys={added} tone="add" />
        </div>
      )}

      {removed.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-medium text-red-700 dark:text-red-400">Disabling</p>
          <ModuleChips keys={removed} tone="remove" />
        </div>
      )}

      <p className="mt-4 text-xs leading-relaxed">
        Staff may need to sign out and back in for sidebar changes to apply.
      </p>
    </>
  );
}
