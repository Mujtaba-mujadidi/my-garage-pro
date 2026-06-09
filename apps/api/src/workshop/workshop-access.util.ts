import {
  isWorkshopStaffView as isWorkshopStaffViewPerm,
  workshopMapOptions as workshopMapOptionsPerm,
  type WorkshopModuleKey,
} from "@mygaragepro/shared";
import { ForbiddenException } from "@nestjs/common";
import type { RequestUser } from "../auth/auth.types";

export type { WorkshopModuleKey };

export function isWorkshopStaffView(
  user: RequestUser,
  moduleKey: WorkshopModuleKey,
): boolean {
  return isWorkshopStaffViewPerm(user.permissions, moduleKey);
}

export function workshopMapOptions(user: RequestUser, moduleKey: WorkshopModuleKey) {
  return workshopMapOptionsPerm(user.permissions, moduleKey, user.id);
}

export function assertWorkshopStaffActor(
  user: RequestUser,
  moduleKey: WorkshopModuleKey,
): void {
  if (!isWorkshopStaffView(user, moduleKey)) {
    throw new ForbiddenException("Insufficient permissions");
  }
}
