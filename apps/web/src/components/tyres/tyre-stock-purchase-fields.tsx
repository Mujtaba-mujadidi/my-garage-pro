"use client";

import {
  StockPaymentMethodField,
  purchaseTotalsFromBuyPrice,
  unitPriceBreakdown,
  type StockPaymentDraft,
} from "@/components/finance/stock-purchase-fields";
import type { PaymentAccountDto } from "@mygaragepro/shared";
import { useMemo, type ReactNode } from "react";

const inputClass =
  "w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm";

function formatGbp(amount: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(amount);
}

function FormSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3 border-t border-[var(--border)] pt-4 first:border-t-0 first:pt-0">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--foreground)]">
        {title}
      </h3>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </section>
  );
}

type Props = {
  unitBuyPrice: string;
  onUnitBuyPriceChange: (value: string) => void;
  includeVat: boolean;
  onIncludeVatChange: (value: boolean) => void;
  quantity: number;
  payment: StockPaymentDraft;
  onPaymentChange: (draft: StockPaymentDraft) => void;
  accounts: PaymentAccountDto[];
};

export function TyreStockPurchaseFields({
  unitBuyPrice,
  onUnitBuyPriceChange,
  includeVat,
  onIncludeVatChange,
  quantity,
  payment,
  onPaymentChange,
  accounts,
}: Props) {
  const unitPrice = Number(unitBuyPrice) || 0;
  const qty = quantity > 0 ? quantity : 0;

  const breakdown = useMemo(
    () => unitPriceBreakdown(unitPrice, includeVat),
    [unitPrice, includeVat],
  );

  const purchaseTotals = useMemo(
    () => purchaseTotalsFromBuyPrice(unitPrice, includeVat, qty),
    [unitPrice, includeVat, qty],
  );

  return (
    <>
      <FormSection title="Cost">
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-medium text-[var(--muted)]">
            Unit buy price (ex VAT)
          </label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={unitBuyPrice}
            onChange={(e) => onUnitBuyPriceChange(e.target.value)}
            className={inputClass}
            placeholder="0.00"
          />
        </div>
        <div className="flex items-end sm:col-span-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={includeVat}
              onChange={(e) => onIncludeVatChange(e.target.checked)}
              className="h-4 w-4 rounded border border-[var(--border)]"
            />
            Include VAT
          </label>
        </div>
        <div className="sm:col-span-2 grid gap-3 rounded-lg bg-[var(--background)] p-3 sm:grid-cols-3">
          <div>
            <p className="text-xs text-[var(--muted)]">Unit price (ex VAT)</p>
            <p className="mt-0.5 font-medium tabular-nums">
              {unitPrice > 0 ? formatGbp(breakdown.unitExVat) : "—"}
            </p>
          </div>
          <div>
            <p className="text-xs text-[var(--muted)]">VAT amount</p>
            <p className="mt-0.5 font-medium tabular-nums">
              {breakdown.unitVat != null ? formatGbp(breakdown.unitVat) : "N/A"}
            </p>
          </div>
          <div>
            <p className="text-xs text-[var(--muted)]">Price (inc VAT)</p>
            <p className="mt-0.5 font-medium tabular-nums">
              {breakdown.unitIncVat != null ? formatGbp(breakdown.unitIncVat) : "N/A"}
            </p>
          </div>
        </div>
        {qty > 0 && unitPrice > 0 && (
          <div className="sm:col-span-2 rounded-lg border border-[var(--border)] px-3 py-2 text-sm">
            <span className="text-[var(--muted)]">Total purchase: </span>
            <span className="font-semibold tabular-nums">
              {formatGbp(purchaseTotals.purchaseAmountGross)}
            </span>
            {includeVat && purchaseTotals.purchaseVatAmount > 0 && (
              <span className="ml-2 text-xs text-[var(--muted)]">
                (VAT {formatGbp(purchaseTotals.purchaseVatAmount)})
              </span>
            )}
            <span className="mt-1 block text-xs text-[var(--muted)]">
              {qty} × {formatGbp(unitPrice)} ex VAT
              {includeVat ? " + VAT" : ""}
            </span>
          </div>
        )}
      </FormSection>

      {qty > 0 && purchaseTotals.purchaseAmountGross > 0 && (
        <StockPaymentMethodField
          draft={payment}
          onChange={onPaymentChange}
          accounts={accounts}
        />
      )}
    </>
  );
}
