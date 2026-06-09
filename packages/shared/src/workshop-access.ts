import { BODYWORK_CLAIMABLE_JOB_STATUSES } from "./bodywork-types";
import type { GaragePermission } from "./permission-matrix";
import { REPAIR_CLAIMABLE_JOB_STATUSES } from "./repair-types";

export type WorkshopModuleKey = "repair" | "bodywork";

function readPerm(moduleKey: WorkshopModuleKey): GaragePermission {
  return `${moduleKey}.read`;
}

function writePerm(moduleKey: WorkshopModuleKey): GaragePermission {
  return `${moduleKey}.write`;
}

function workPerm(moduleKey: WorkshopModuleKey): GaragePermission {
  return `${moduleKey}.work`;
}

/**
 * Workshop staff queue: module view access (read or legacy work) without write.
 * Any role with View on repair/bodywork uses this — not tied to role name "mechanic".
 */
export function isWorkshopStaffView(
  permissions: readonly string[],
  moduleKey: WorkshopModuleKey,
): boolean {
  if (permissions.includes(writePerm(moduleKey))) return false;
  return (
    permissions.includes(readPerm(moduleKey)) || permissions.includes(workPerm(moduleKey))
  );
}

/** Can open the repair/bodywork module in the app. */
export function canAccessWorkshopModule(
  permissions: readonly string[],
  moduleKey: WorkshopModuleKey,
): boolean {
  return (
    permissions.includes(readPerm(moduleKey)) ||
    permissions.includes(workPerm(moduleKey)) ||
    permissions.includes(writePerm(moduleKey))
  );
}

/** Permissions granted when a role is set to View for repair/bodywork in the role editor. */
export function workshopViewRolePermissions(
  moduleKey: WorkshopModuleKey,
): GaragePermission[] {
  return [readPerm(moduleKey), workPerm(moduleKey)];
}

/** HTTP guard: open module, list jobs, claim tasks (view + full access). */
export function workshopStaffHttpPermissions(
  moduleKey: WorkshopModuleKey,
): GaragePermission[] {
  return [readPerm(moduleKey), workPerm(moduleKey), writePerm(moduleKey)];
}

/** HTTP guard: patch tasks — workshop staff or managers. */
export function workshopTaskPatchHttpPermissions(
  moduleKey: WorkshopModuleKey,
): GaragePermission[] {
  return workshopStaffHttpPermissions(moduleKey);
}

export function workshopMapOptions(
  permissions: readonly string[],
  moduleKey: WorkshopModuleKey,
  userId: string,
): { viewMode: "work"; userId: string } | { viewMode: "full" } {
  if (isWorkshopStaffView(permissions, moduleKey)) {
    return { viewMode: "work", userId };
  }
  return { viewMode: "full" };
}

function claimableJobStatuses(moduleKey: WorkshopModuleKey): readonly string[] {
  return moduleKey === "bodywork"
    ? BODYWORK_CLAIMABLE_JOB_STATUSES
    : REPAIR_CLAIMABLE_JOB_STATUSES;
}

/** Whether a workshop user can claim this task (mirrors API mapper when viewMode is work). */
export function isWorkshopTaskClaimable(
  task: { assigneeId: string | null; status: string; claimable?: boolean },
  jobStatus: string,
  moduleKey: WorkshopModuleKey,
): boolean {
  if (task.claimable) return true;
  return (
    !task.assigneeId &&
    task.status === "AVAILABLE" &&
    claimableJobStatuses(moduleKey).includes(jobStatus)
  );
}

/** Assignee label in workshop job detail (all tasks visible for job context). */
/**
 * Ensures legacy view roles have both read + work (mechanic-equivalent) at login.
 * Does not elevate users with write (managers keep full access).
 */
export function normalizeWorkshopViewPermissions(
  permissions: readonly string[],
): string[] {
  const set = new Set(permissions);
  for (const moduleKey of ["repair", "bodywork"] as const) {
    const read = readPerm(moduleKey);
    const work = workPerm(moduleKey);
    const write = writePerm(moduleKey);
    if (set.has(read) && !set.has(write)) {
      set.add(work);
    }
  }
  return [...set];
}

export function workshopTaskAssigneeLabel(
  task: { assigneeId: string | null; assigneeName?: string | null },
  userId: string | undefined,
): string {
  if (!task.assigneeId) return "Unassigned";
  if (userId && task.assigneeId === userId) return "You";
  return task.assigneeName ?? "Assigned";
}
