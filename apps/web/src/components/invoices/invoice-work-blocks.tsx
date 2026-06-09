"use client";

import {
  emptyInvoiceLine,
  InvoiceLineFields,
  type InvoiceLineDraft,
} from "@/components/invoices/invoice-line-fields";
import { previewInvoiceLine } from "@mygaragepro/shared";

export type InvoiceWorkBlock = {
  labour: InvoiceLineDraft;
  part: InvoiceLineDraft;
};

export function emptyInvoiceWorkBlock(): InvoiceWorkBlock {
  return {
    labour: emptyInvoiceLine(),
    part: emptyInvoiceLine(),
  };
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(value);
}

function blockLineGross(line: InvoiceLineDraft) {
  const unit = Number(line.unitPriceNet);
  if (!line.description.trim() || !(unit > 0)) return 0;
  return previewInvoiceLine({
    quantity: Number(line.quantity) || 1,
    unitPriceNet: unit,
    vatRatePercent: line.includeVat ? Number(line.vatRatePercent) || 20 : 0,
  }).gross;
}

type Props = {
  blocks: InvoiceWorkBlock[];
  onChange: (blocks: InvoiceWorkBlock[]) => void;
  disabled?: boolean;
};

export function InvoiceWorkBlocks({ blocks, onChange, disabled }: Props) {
  function updateBlock(index: number, patch: Partial<InvoiceWorkBlock>) {
    const next = [...blocks];
    next[index] = { ...next[index], ...patch };
    onChange(next);
  }

  return (
    <section className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
        Work items
      </p>
      {blocks.map((block, idx) => {
        const blockTotal = blockLineGross(block.labour) + blockLineGross(block.part);
        return (
          <article
            key={idx}
            className="rounded-xl border-2 border-[var(--border)] bg-[var(--surface)] shadow-sm"
          >
            <div className="flex items-center justify-between gap-2 border-b border-[var(--border)] bg-[var(--background)] px-3 py-2.5">
              <h4 className="text-sm font-semibold text-[var(--foreground)]">
                Work item {idx + 1}
                <span className="ml-2 font-normal text-[var(--muted)]">· labour &amp; part</span>
              </h4>
              {blocks.length > 1 && (
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onChange(blocks.filter((_, i) => i !== idx))}
                  className="text-xs font-medium text-red-600 hover:underline disabled:opacity-50"
                >
                  Remove block
                </button>
              )}
            </div>
            <div className="grid gap-3 p-3 lg:grid-cols-2">
              <InvoiceLineFields
                kind="labour"
                line={block.labour}
                disabled={disabled}
                onChange={(patch) =>
                  updateBlock(idx, { labour: { ...block.labour, ...patch } })
                }
              />
              <InvoiceLineFields
                kind="part"
                line={block.part}
                disabled={disabled}
                onChange={(patch) => updateBlock(idx, { part: { ...block.part, ...patch } })}
              />
            </div>
            {blockTotal > 0 && (
              <p className="border-t border-[var(--border)] px-3 py-2 text-right text-xs text-[var(--muted)]">
                Block subtotal{" "}
                <span className="font-mono font-semibold text-[var(--foreground)]">
                  {formatMoney(blockTotal)}
                </span>
              </p>
            )}
          </article>
        );
      })}
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange([...blocks, emptyInvoiceWorkBlock()])}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm font-medium text-accent transition-colors hover:border-accent hover:bg-[var(--surface)] disabled:opacity-50"
      >
        <span aria-hidden className="text-lg leading-none">
          +
        </span>
        Add work item (labour &amp; part)
      </button>
    </section>
  );
}
