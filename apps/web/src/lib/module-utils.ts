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

export function diffModules(
  before: ModuleKey[],
  after: ModuleKey[],
): { added: ModuleKey[]; removed: ModuleKey[] } {
  const beforeSet = new Set(before);
  const afterSet = new Set(after);
  const added = after.filter((m) => !beforeSet.has(m));
  const removed = before.filter((m) => !afterSet.has(m));
  return { added, removed };
}
