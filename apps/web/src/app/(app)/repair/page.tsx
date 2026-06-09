import { ModuleGate } from "@/components/layout/module-gate";
import { PermissionGate } from "@/components/layout/permission-gate";
import { RepairPageContent } from "@/components/repair/repair-page-content";
import { workshopStaffHttpPermissions } from "@mygaragepro/shared";

export default function RepairPage() {
  return (
    <ModuleGate moduleKey="repair">
      <PermissionGate permission={workshopStaffHttpPermissions("repair")}>
        <RepairPageContent />
      </PermissionGate>
    </ModuleGate>
  );
}
