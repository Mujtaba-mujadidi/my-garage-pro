"use client";

import { CustomerDetailContent } from "@/components/customers/customer-detail-content";
import { ModuleGate } from "@/components/layout/module-gate";
import { PermissionGate } from "@/components/layout/permission-gate";
import { useParams } from "next/navigation";

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();

  return (
    <ModuleGate moduleKey="customers">
      <PermissionGate permission="customers.read">
        <CustomerDetailContent customerId={id} />
      </PermissionGate>
    </ModuleGate>
  );
}
