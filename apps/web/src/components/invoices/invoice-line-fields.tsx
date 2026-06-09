"use client";

import { Select } from "@/components/ui/select";
import { previewInvoiceLine } from "@mygaragepro/shared";

export type InvoiceLineDraft = {
  description: string;
  quantity: string;
  unitPriceNet: string;
  includeVat: boolean;
  vatRatePercent: string;
};

const inputClass =
  "w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm";

const labelClass = "mb-1 block text-xs font-medium text-[var(--muted)]";

export function emptyInvoiceLine(): InvoiceLineDraft {
  return {
    description: "",
    quantity: "1",
    unitPriceNet: "",
    includeVat: false,
    vatRatePercent: "20",
  };
}

function formatLineMoney(value: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(value);
}

function linePreview(line: InvoiceLineDraft) {
  const unit = Number(line.unitPriceNet);
  if (!line.description.trim() || !(unit > 0)) return null;
  return previewInvoiceLine({
    quantity: Number(line.quantity) || 1,
    unitPriceNet: unit,
    vatRatePercent: line.includeVat ? Number(line.vatRatePercent) || 20 : 0,
  });
}

type Props = {
  kind: "labour" | "part";
  line: InvoiceLineDraft;
  disabled?: boolean;
  onChange: (patch: Partial<InvoiceLineDraft>) => void;
};

export function InvoiceLineFields({ kind, line, disabled, onChange }: Props) {
  const preview = linePreview(line);
  const title = kind === "labour" ? "Labour" : "Part";

  return (
    <div className="space-y-3 rounded-lg border border-[var(--border)] bg-[var(--background)] p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">{title}</p>
      <div>
        <label className={labelClass}>Description</label>
        <input
          placeholder={
            kind === "part" ? "e.g. Brake pads (front)" : "e.g. Diagnostic & repair"
          }
          value={line.description}
          onChange={(e) => onChange({ description: e.target.value })}
          className={inputClass}
          disabled={disabled}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Quantity</label>
          <input
            type="number"
            step="0.001"
            min="0.001"
            value={line.quantity}
            onChange={(e) => onChange({ quantity: e.target.value })}
            className={inputClass}
            disabled={disabled}
          />
        </div>
        <div>
          <label className={labelClass}>Unit price (ex VAT, £)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00"
            value={line.unitPriceNet}
            onChange={(e) => onChange({ unitPriceNet: e.target.value })}
            className={inputClass}
            disabled={disabled}
          />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={line.includeVat}
            onChange={(e) => onChange({ includeVat: e.target.checked })}
            disabled={disabled}
            className="h-4 w-4 rounded border border-[var(--border)]"
          />
          <span>VAT at</span>
        </label>
        <Select
          value={line.vatRatePercent}
          onChange={(v) => onChange({ vatRatePercent: v })}
          options={[
            { value: "20", label: "20%" },
            { value: "5", label: "5%" },
            { value: "0", label: "0%" },
          ]}
          className="max-w-[100px]"
          disabled={disabled || !line.includeVat}
        />
      </div>
      {preview && (
        <p className="text-right text-xs text-[var(--muted)]">
          {title} total{" "}
          <span className="font-mono font-medium text-[var(--foreground)]">
            {formatLineMoney(preview.gross)}
          </span>
        </p>
      )}
    </div>
  );
}
