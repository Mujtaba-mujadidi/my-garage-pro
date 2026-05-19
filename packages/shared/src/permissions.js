"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.roleHasPermission = roleHasPermission;
const ROLE_PERMISSIONS = {
    SUPER_ADMIN: ["platform.garage.manage", "platform.audit.read", "settings.read", "settings.write", "users.read", "users.write"],
    OWNER: [
        "settings.read",
        "settings.write",
        "users.read",
        "users.write",
        "ledger.read",
        "ledger.write",
        "partners.read",
        "partners.write",
    ],
    MANAGER: ["settings.read", "settings.write", "users.read", "ledger.read", "partners.read"],
    MECHANIC: ["settings.read"],
    ACCOUNTANT: ["settings.read", "ledger.read"],
    READ_ONLY: ["settings.read", "ledger.read", "partners.read"],
};
function roleHasPermission(role, permission) {
    return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}
//# sourceMappingURL=permissions.js.map