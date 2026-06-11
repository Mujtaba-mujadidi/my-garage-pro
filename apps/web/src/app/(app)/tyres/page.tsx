import { ModuleGate } from "@/components/layout/module-gate";
import { PermissionGate } from "@/components/layout/permission-gate";
import { TyresPageContent } from "@/components/tyres/tyres-page-content";

export default function TyresPage() {
  return (
    <ModuleGate moduleKey="tyres">
      <PermissionGate permission="tyres.read">
        <TyresPageContent />
      </PermissionGate>
    </ModuleGate>
  );
}
