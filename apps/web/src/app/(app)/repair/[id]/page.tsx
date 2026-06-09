import { ModuleGate } from "@/components/layout/module-gate";
import { PermissionGate } from "@/components/layout/permission-gate";
import { RepairJobDetailClient } from "@/components/repair/repair-job-detail-client";
import { workshopStaffHttpPermissions } from "@mygaragepro/shared";

type Props = { params: Promise<{ id: string }> };

export default async function RepairJobPage({ params }: Props) {
  const { id } = await params;
  return (
    <ModuleGate moduleKey="repair">
      <PermissionGate permission={workshopStaffHttpPermissions("repair")}>
        <RepairJobDetailClient jobId={id} />
      </PermissionGate>
    </ModuleGate>
  );
}
