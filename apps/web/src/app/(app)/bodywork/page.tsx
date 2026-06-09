import { ModuleGate } from "@/components/layout/module-gate";
import { PermissionGate } from "@/components/layout/permission-gate";
import { BodyworkPageContent } from "@/components/bodywork/bodywork-page-content";
import { workshopStaffHttpPermissions } from "@mygaragepro/shared";

export default function BodyworkPage() {
  return (
    <ModuleGate moduleKey="bodywork">
      <PermissionGate permission={workshopStaffHttpPermissions("bodywork")}>
        <BodyworkPageContent />
      </PermissionGate>
    </ModuleGate>
  );
}
