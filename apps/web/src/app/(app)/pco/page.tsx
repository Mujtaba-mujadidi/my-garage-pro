"use client";

import { ModuleGate } from "@/components/layout/module-gate";
import { PcoPageContent } from "@/components/pco/pco-page-content";

export default function PcoPage() {
  return (
    <ModuleGate moduleKey="pco">
      <PcoPageContent />
    </ModuleGate>
  );
}
