import { ModuleGate } from "@/components/layout/module-gate";
import { ModulePlaceholder } from "@/components/layout/module-placeholder";
import { PLACEHOLDER_MODULE_KEYS } from "@/lib/nav-items";
import { MODULE_LABELS, moduleKeyFromSlug, moduleSlug, type ModuleKey } from "@mygaragepro/shared";
import { notFound } from "next/navigation";

const PHASE_BY_MODULE: Partial<Record<ModuleKey, string>> = {
  repair: "Phase 6 — Repair jobs",
  bodywork: "Phase 6 — Bodywork",
  suppliers: "Phase 7 — Suppliers",
  tyres: "Phase 8 — Tyres",
  parts: "Phase 7 — Parts",
  invoices: "Phase 5 — Invoicing",
  used_cars: "Phase 10 — Used cars",
  rental: "Phase 12 — Rental",
  pco: "Post-MVP — PCO",
  reports: "Phase 13 — Reports",
};

type Props = { params: Promise<{ module: string }> };

export function generateStaticParams() {
  return PLACEHOLDER_MODULE_KEYS.map((key) => ({
    module: moduleSlug(key),
  }));
}

export default async function ModulePlaceholderPage({ params }: Props) {
  const { module: slug } = await params;
  const moduleKey = moduleKeyFromSlug(slug);

  if (!moduleKey || !PLACEHOLDER_MODULE_KEYS.includes(moduleKey)) {
    notFound();
  }

  const title = MODULE_LABELS[moduleKey];
  const phaseLabel = PHASE_BY_MODULE[moduleKey] ?? "Coming soon";

  return (
    <ModuleGate moduleKey={moduleKey}>
      <ModulePlaceholder title={title} phaseLabel={phaseLabel} />
    </ModuleGate>
  );
}
