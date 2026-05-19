import type { ModuleKey } from "@mygaragepro/shared";

export function modulesEqual(a: ModuleKey[], b: ModuleKey[]): boolean {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  return b.every((m) => set.has(m));
}

export function toggleModuleList(
  current: ModuleKey[],
  moduleKey: ModuleKey,
  enabled: boolean,
): ModuleKey[] {
  if (enabled) {
    return current.includes(moduleKey) ? current : [...current, moduleKey];
  }
  return current.filter((m) => m !== moduleKey);
}
