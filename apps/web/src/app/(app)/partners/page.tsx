import { PermissionGate } from "@/components/layout/permission-gate";
import { ModulePlaceholder } from "@/components/layout/module-placeholder";

export default function PartnersPage() {
  return (
    <PermissionGate permission="partners.read">
      <ModulePlaceholder title="Partners" phaseLabel="Phase 11 — Partners" />
    </PermissionGate>
  );
}
