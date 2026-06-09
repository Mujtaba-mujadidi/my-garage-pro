import { ModuleGate } from "@/components/layout/module-gate";
import { PermissionGate } from "@/components/layout/permission-gate";
import { BodyworkJobDetailClient } from "@/components/bodywork/bodywork-job-detail-client";
import { workshopStaffHttpPermissions } from "@mygaragepro/shared";

type Props = { params: Promise<{ id: string }> };

export default async function BodyworkJobPage({ params }: Props) {
  const { id } = await params;
  return (
    <ModuleGate moduleKey="bodywork">
      <PermissionGate permission={workshopStaffHttpPermissions("bodywork")}>
        <BodyworkJobDetailClient jobId={id} />
      </PermissionGate>
    </ModuleGate>
  );
}
