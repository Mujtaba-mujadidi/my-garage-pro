import { ModuleGate } from "@/components/layout/module-gate";
import { PermissionGate } from "@/components/layout/permission-gate";
import { LedgerPageContent } from "@/components/ledger/ledger-page-content";

export default function LedgerPage() {
  return (
    <ModuleGate moduleKey="ledger">
      <PermissionGate permission="ledger.read">
        <LedgerPageContent />
      </PermissionGate>
    </ModuleGate>
  );
}
