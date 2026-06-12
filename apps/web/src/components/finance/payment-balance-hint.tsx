"use client";

const TOLERANCE = 0.01;

export type PaymentBalanceStatus =
  | { kind: "no_balance"; balanceDue: number }
  | { kind: "remaining"; balanceDue: number; received: number; remaining: number }
  | { kind: "cleared"; balanceDue: number; received: number }
  | { kind: "overpaid"; balanceDue: number; received: number; overpaid: number };

export function paymentBalanceStatus(
  received: number,
  balanceDue: number,
): PaymentBalanceStatus {
  if (balanceDue <= TOLERANCE) {
    return { kind: "no_balance", balanceDue };
  }
  const remaining = balanceDue - received;
  if (remaining > TOLERANCE) {
    return { kind: "remaining", balanceDue, received, remaining };
  }
  if (received > balanceDue + TOLERANCE) {
    return { kind: "overpaid", balanceDue, received, overpaid: received - balanceDue };
  }
  return { kind: "cleared", balanceDue, received };
}

function formatGbp(amount: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(amount);
}

type Props = {
  status: PaymentBalanceStatus | null;
  /** Shown when the user clicks "+ Add method / account" */
  addSplitNotice?: boolean;
};

export function PaymentBalanceHint({ status, addSplitNotice = false }: Props) {
  if (!status || status.kind === "no_balance") return null;

  if (status.kind === "remaining") {
    return (
      <p
        className={`rounded-lg px-3 py-2 text-xs ${
          addSplitNotice
            ? "border border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-100"
            : "bg-[var(--background)] text-[var(--muted)]"
        }`}
      >
        Balance remaining:{" "}
        <strong className="text-[var(--foreground)]">{formatGbp(status.remaining)}</strong>
        {addSplitNotice
          ? " — enter this on the new payment line, or split across methods."
          : " — add another payment method if the customer paid in more than one way."}
      </p>
    );
  }

  if (status.kind === "cleared") {
    return (
      <p
        className={`rounded-lg px-3 py-2 text-xs ${
          addSplitNotice
            ? "border border-green-300 bg-green-50 text-green-900 dark:border-green-800 dark:bg-green-950/50 dark:text-green-100"
            : "bg-[var(--background)] text-[var(--muted)]"
        }`}
      >
        Balance cleared
        {addSplitNotice
          ? " — payment received matches the balance due. You can still add another method if needed."
          : " — payment received matches the balance due."}
      </p>
    );
  }

  return (
    <p
      className={`rounded-lg px-3 py-2 text-xs ${
        addSplitNotice
          ? "border border-blue-300 bg-blue-50 text-blue-900 dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-100"
          : "bg-[var(--background)] text-[var(--muted)]"
      }`}
    >
      Overpaid by{" "}
      <strong className="text-[var(--foreground)]">{formatGbp(status.overpaid)}</strong>
      {addSplitNotice
        ? " — excess will remain as unallocated credit on the customer account."
        : " — excess will be unallocated credit."}
    </p>
  );
}
