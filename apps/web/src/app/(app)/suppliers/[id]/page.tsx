"use client";

import { ModuleGate } from "@/components/layout/module-gate";
import { PermissionGate } from "@/components/layout/permission-gate";
import { SupplierDetailContent } from "@/components/suppliers/supplier-detail-content";
import { useParams } from "next/navigation";

export default function SupplierDetailPage() {
  const { id } = useParams<{ id: string }>();

  return (
    <ModuleGate moduleKey="suppliers">
      <PermissionGate permission="suppliers.read">
        <SupplierDetailContent supplierId={id} />
      </PermissionGate>
    </ModuleGate>
  );
}
