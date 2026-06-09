"use client";

import { GateLoading } from "@/components/layout/gate-loading";
import { RepairJobDetail } from "@/components/repair/repair-job-detail";
import { useMounted } from "@/lib/use-mounted";

type Props = { jobId: string };

export function RepairJobDetailClient({ jobId }: Props) {
  const mounted = useMounted();
  if (!mounted) return <GateLoading />;
  return <RepairJobDetail jobId={jobId} />;
}
