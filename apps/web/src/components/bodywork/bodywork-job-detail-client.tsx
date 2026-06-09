"use client";

import { GateLoading } from "@/components/layout/gate-loading";
import { BodyworkJobDetail } from "@/components/bodywork/bodywork-job-detail";
import { useMounted } from "@/lib/use-mounted";

type Props = { jobId: string };

export function BodyworkJobDetailClient({ jobId }: Props) {
  const mounted = useMounted();
  if (!mounted) return <GateLoading />;
  return <BodyworkJobDetail jobId={jobId} />;
}
