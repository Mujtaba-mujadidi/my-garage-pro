import { PermissionGate } from "@/components/layout/permission-gate";
import { ModulePlaceholder } from "@/components/layout/module-placeholder";

export default function LedgerPage() {
  return (
    <PermissionGate permission="ledger.read">
      <ModulePlaceholder title="Ledger" phaseLabel="Phase 4 — Ledger + banks/cash" />
    </PermissionGate>
  );
}
