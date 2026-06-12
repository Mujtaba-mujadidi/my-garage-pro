"use client";

import { SearchableSelect } from "@/components/ui/searchable-select";
import { Select } from "@/components/ui/select";
import type { PaymentAccountDto, PaymentMethod, SupplierDto } from "@mygaragepro/shared";
import {
  PAYMENT_METHOD_LABELS,
  UK_STANDARD_VAT_PERCENT,
  defaultPaymentMethodForAccount,
  grossFromNet,
  vatFromInclusiveGross,
  vatOnNet,
} from "@mygaragepro/shared";

export type StockPurchaseDraft = {
  purchaseAmountGross: string;
  includeVat: boolean;
  vatRatePercent: string;
  creditAmountApplied: string;
  paymentAccountId: string;
  paymentMethod: PaymentMethod;
  supplierId: string;
  purchaseReference: string;
};

const inputClass =
  "w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm";

const PAYMENT_METHOD_OPTIONS = Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => ({
  value: value as PaymentMethod,
  label,
}));

export function emptyStockPurchaseDraft(accounts: PaymentAccountDto[]): StockPurchaseDraft {
  const firstId = accounts[0]?.id ?? "";
  const account = accounts[0];
  return {
    purchaseAmountGross: "",
    includeVat: false,
    vatRatePercent: String(UK_STANDARD_VAT_PERCENT),
    creditAmountApplied: "",
    paymentAccountId: firstId,
    paymentMethod: account ? defaultPaymentMethodForAccount(account.type) : "BANK_TRANSFER",
    supplierId: "",
    purchaseReference: "",
  };
}

export type StockPaymentDraft = {
  paymentAccountId: string;
  paymentMethod: PaymentMethod;
};

export function emptyStockPaymentDraft(accounts: PaymentAccountDto[]): StockPaymentDraft {
  const account = accounts[0];
  return {
    paymentAccountId: account?.id ?? "",
    paymentMethod: account ? defaultPaymentMethodForAccount(account.type) : "BANK_TRANSFER",
  };
}

/** Buy price is always entered ex VAT; `includeVat` adds VAT on top for the purchase. */
export function unitPriceBreakdown(
  unitBuyPriceExVat: number,
  includeVat: boolean,
): { unitExVat: number; unitVat: number | null; unitIncVat: number | null } {
  if (!(unitBuyPriceExVat > 0)) {
    return { unitExVat: 0, unitVat: null, unitIncVat: null };
  }
  if (!includeVat) {
    return { unitExVat: unitBuyPriceExVat, unitVat: null, unitIncVat: null };
  }
  const unitVat = vatOnNet(unitBuyPriceExVat, UK_STANDARD_VAT_PERCENT);
  const unitIncVat = grossFromNet(unitBuyPriceExVat, UK_STANDARD_VAT_PERCENT);
  return { unitExVat: unitBuyPriceExVat, unitVat, unitIncVat };
}

export function purchaseTotalsFromBuyPrice(
  unitBuyPriceExVat: number,
  includeVat: boolean,
  quantity: number,
): { purchaseAmountGross: number; purchaseVatAmount: number; costPriceNet: number } {
  const qty = quantity > 0 ? quantity : 0;
  const unit = unitBuyPriceExVat > 0 ? unitBuyPriceExVat : 0;
  if (qty <= 0 || unit <= 0) {
    return { purchaseAmountGross: 0, purchaseVatAmount: 0, costPriceNet: 0 };
  }

  const costPriceNet = unit;
  const netTotal = Math.round(unit * qty * 100) / 100;
  if (includeVat) {
    const purchaseVatAmount = vatOnNet(netTotal, UK_STANDARD_VAT_PERCENT);
    const purchaseAmountGross = Math.round((netTotal + purchaseVatAmount) * 100) / 100;
    return { purchaseAmountGross, purchaseVatAmount, costPriceNet };
  }

  return { purchaseAmountGross: netTotal, purchaseVatAmount: 0, costPriceNet };
}

export function stockPurchaseApiPayloadFromBuyPrice(opts: {
  unitBuyPrice: number;
  includesVat: boolean;
  quantity: number;
  supplierId: string;
  payment: StockPaymentDraft;
}) {
  const { purchaseAmountGross, costPriceNet } = purchaseTotalsFromBuyPrice(
    opts.unitBuyPrice,
    opts.includesVat,
    opts.quantity,
  );
  return {
    costPriceNet,
    ...stockPurchaseApiPayload({
      purchaseAmountGross: String(purchaseAmountGross),
      includeVat: opts.includesVat && purchaseAmountGross > 0,
      vatRatePercent: String(UK_STANDARD_VAT_PERCENT),
      creditAmountApplied: "",
      paymentAccountId: opts.payment.paymentAccountId,
      paymentMethod: opts.payment.paymentMethod,
      supplierId: opts.supplierId,
      purchaseReference: "",
    }),
  };
}

export function stockPurchaseApiPayload(draft: StockPurchaseDraft) {
  const gross = Number(draft.purchaseAmountGross) || 0;
  const vatAmount = draft.includeVat
    ? vatFromInclusiveGross(gross, Number(draft.vatRatePercent) || UK_STANDARD_VAT_PERCENT)
    : 0;
  return {
    purchaseAmountGross: gross,
    purchaseVatAmount: vatAmount,
    ...(gross > 0 && draft.paymentAccountId
      ? {
          paymentAccountId: draft.paymentAccountId,
          paymentMethod: draft.paymentMethod,
        }
      : {}),
    ...(draft.supplierId ? { supplierId: draft.supplierId } : {}),
    ...(Number(draft.creditAmountApplied) > 0
      ? { creditAmountApplied: Number(draft.creditAmountApplied) }
      : {}),
    ...(draft.purchaseReference.trim()
      ? { purchaseReference: draft.purchaseReference.trim() }
      : {}),
  };
}

type StockPaymentMethodFieldProps = {
  draft: StockPaymentDraft;
  onChange: (draft: StockPaymentDraft) => void;
  accounts: PaymentAccountDto[];
  title?: string;
};

export function StockPaymentMethodField({
  draft,
  onChange,
  accounts,
  title = "Payment",
}: StockPaymentMethodFieldProps) {
  const accountOptions = accounts.map((a) => ({
    value: a.id,
    label: a.type === "CASH" ? `${a.name} (cash)` : a.name,
  }));

  return (
    <fieldset className="space-y-3 rounded-lg border border-[var(--border)] p-3">
      <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
        {title}
      </legend>
      <p className="text-xs text-[var(--muted)]">
        How you paid the supplier. The total is calculated from buy price and quantity above.
      </p>
      <div>
        <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Payment method</label>
        <Select
          value={draft.paymentMethod}
          onChange={(v) => onChange({ ...draft, paymentMethod: v as PaymentMethod })}
          options={PAYMENT_METHOD_OPTIONS}
        />
      </div>
      {accounts.length > 0 ? (
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Paid from</label>
          <SearchableSelect
            value={draft.paymentAccountId}
            onChange={(paymentAccountId) => {
              const account = accounts.find((a) => a.id === paymentAccountId);
              onChange({
                ...draft,
                paymentAccountId,
                paymentMethod: account
                  ? defaultPaymentMethodForAccount(account.type)
                  : draft.paymentMethod,
              });
            }}
            options={accountOptions}
            searchPlaceholder="Cash or bank account…"
            required
          />
        </div>
      ) : (
        <p className="text-xs text-amber-700 dark:text-amber-300">
          No payment accounts set up. Add accounts in Ledger settings.
        </p>
      )}
    </fieldset>
  );
}

type Props = {
  draft: StockPurchaseDraft;
  onChange: (draft: StockPurchaseDraft) => void;
  accounts: PaymentAccountDto[];
  suppliers?: SupplierDto[];
  title?: string;
};

export function StockPurchaseFields({
  draft,
  onChange,
  accounts,
  suppliers = [],
  title = "Purchase payment",
}: Props) {
  const gross = Number(draft.purchaseAmountGross) || 0;
  const vat =
    draft.includeVat && gross > 0
      ? vatFromInclusiveGross(gross, Number(draft.vatRatePercent) || UK_STANDARD_VAT_PERCENT)
      : 0;
  const net = Math.max(0, gross - vat);
  const creditApplied = Math.min(Number(draft.creditAmountApplied) || 0, gross);
  const cashDue = Math.max(0, gross - creditApplied);
  const selectedSupplier = suppliers.find((s) => s.id === draft.supplierId);
  const supplierCredit = Number(selectedSupplier?.creditBalance ?? 0);

  const supplierOptions = [
    { value: "", label: "No supplier" },
    ...suppliers.map((s) => ({ value: s.id, label: s.name })),
  ];

  const accountOptions = accounts.map((a) => ({ value: a.id, label: a.name }));

  return (
    <fieldset className="space-y-3 rounded-lg border border-[var(--border)] p-3">
      <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
        {title}
      </legend>
      <p className="text-xs text-[var(--muted)]">
        Record what you paid the supplier. Enter 0 if unknown — stock still updates.
      </p>
      <div>
        <label className="mb-1 block text-xs font-medium text-[var(--muted)]">
          Total paid (£)
        </label>
        <input
          type="number"
          min="0"
          step="any"
          value={draft.purchaseAmountGross}
          onChange={(e) => onChange({ ...draft, purchaseAmountGross: e.target.value })}
          className={inputClass}
          placeholder="0.00"
        />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={draft.includeVat}
          onChange={(e) => onChange({ ...draft, includeVat: e.target.checked })}
          className="h-4 w-4 rounded border border-[var(--border)]"
        />
        Supplier invoice includes VAT
      </label>
      {draft.includeVat && gross > 0 && (
        <div className="grid gap-2 text-xs text-[var(--muted)] sm:grid-cols-3">
          <div>
            Net: <span className="font-medium text-[var(--foreground)]">£{net.toFixed(2)}</span>
          </div>
          <div>
            VAT: <span className="font-medium text-[var(--foreground)]">£{vat.toFixed(2)}</span>
          </div>
          <div>
            Gross: <span className="font-medium text-[var(--foreground)]">£{gross.toFixed(2)}</span>
          </div>
        </div>
      )}
      {suppliers.length > 0 && (
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Supplier</label>
          <SearchableSelect
            value={draft.supplierId}
            onChange={(supplierId) =>
              onChange({ ...draft, supplierId, creditAmountApplied: "" })
            }
            options={supplierOptions}
            searchPlaceholder="Search suppliers…"
          />
          {selectedSupplier && supplierCredit > 0 && (
            <p className="mt-1 text-xs text-[var(--muted)]">
              Account credit available:{" "}
              <span className="font-medium text-[var(--foreground)]">
                £{supplierCredit.toFixed(2)}
              </span>
            </p>
          )}
        </div>
      )}
      {draft.supplierId && gross > 0 && supplierCredit > 0 && (
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--muted)]">
            Pay with supplier credit (£)
          </label>
          <input
            type="number"
            min="0"
            max={Math.min(gross, supplierCredit)}
            step="any"
            value={draft.creditAmountApplied}
            onChange={(e) => onChange({ ...draft, creditAmountApplied: e.target.value })}
            className={inputClass}
            placeholder="0.00"
          />
          {creditApplied > 0 && (
            <p className="mt-1 text-xs text-[var(--muted)]">
              Cash due: <span className="font-medium">£{cashDue.toFixed(2)}</span>
            </p>
          )}
        </div>
      )}
      {cashDue > 0 && accounts.length > 0 && (
        <>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Paid from</label>
            <SearchableSelect
              value={draft.paymentAccountId}
              onChange={(paymentAccountId) => {
                const account = accounts.find((a) => a.id === paymentAccountId);
                onChange({
                  ...draft,
                  paymentAccountId,
                  paymentMethod: account
                    ? defaultPaymentMethodForAccount(account.type)
                    : draft.paymentMethod,
                });
              }}
              options={accountOptions}
              searchPlaceholder="Select account…"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--muted)]">
              Payment method
            </label>
            <Select
              value={draft.paymentMethod}
              onChange={(v) => onChange({ ...draft, paymentMethod: v as PaymentMethod })}
              options={PAYMENT_METHOD_OPTIONS}
            />
          </div>
        </>
      )}
      <div>
        <label className="mb-1 block text-xs font-medium text-[var(--muted)]">
          Reference / invoice no.
        </label>
        <input
          value={draft.purchaseReference}
          onChange={(e) => onChange({ ...draft, purchaseReference: e.target.value })}
          className={inputClass}
          placeholder="Optional"
        />
      </div>
    </fieldset>
  );
}
