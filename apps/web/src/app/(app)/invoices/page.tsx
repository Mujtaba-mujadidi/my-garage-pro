import { ModuleGate } from "@/components/layout/module-gate";
import { PermissionGate } from "@/components/layout/permission-gate";
import { InvoicesPageContent } from "@/components/invoices/invoices-page-content";

export default function InvoicesPage() {
  return (
    <ModuleGate moduleKey="invoices">
      <PermissionGate permission="invoices.read">
        <InvoicesPageContent />
      </PermissionGate>
    </ModuleGate>
  );
}
