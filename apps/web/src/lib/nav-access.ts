import { canAccessWorkshopModule, MODULE_NAV_READ_PERMISSION } from "@mygaragepro/shared";
import type { NavItem } from "@/lib/nav-items";

export function canAccessNavItem(
  item: NavItem,
  role: string,
  permissions: string[],
  enabledModules: string[],
): boolean {
  if (item.superAdminOnly) return role === "SUPER_ADMIN";
  if (role === "SUPER_ADMIN") return item.href === "/dashboard";

  if (item.href === "/dashboard") return true;
  if (item.href === "/admin") return permissions.includes("platform.garage.manage");

  if (item.moduleKey) {
    if (!enabledModules.includes(item.moduleKey)) {
      return false;
    }
    const readPerm =
      item.permission ?? MODULE_NAV_READ_PERMISSION[item.moduleKey];
    if (readPerm) {
      const canRead =
        item.moduleKey === "repair" || item.moduleKey === "bodywork"
          ? canAccessWorkshopModule(permissions, item.moduleKey)
          : permissions.includes(readPerm);
      if (!canRead) return false;
    }
    return true;
  }

  if (item.permission && !permissions.includes(item.permission)) {
    return false;
  }

  return true;
}
