import { BadRequestException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { roundMoney } from "../invoices/invoice-calculations";
import type { StockPurchaseInput } from "./dto/stock-purchase-fields.dto";

export function unitCostNetFromPurchase(
  purchase: StockPurchaseInput,
  quantity: Prisma.Decimal | number,
): Prisma.Decimal {
  const qty = Number(quantity);
  if (!(qty > 0)) return new Prisma.Decimal(0);
  const net = Math.max(0, purchase.amountGross - purchase.vatAmount);
  if (net <= 0) return new Prisma.Decimal(0);
  return roundMoney(net / qty);
}

export function assertStockPurchaseForLedger(
  purchase: StockPurchaseInput,
  ledgerEnabled: boolean,
) {
  if (!ledgerEnabled || purchase.amountGross <= 0) return;
  const credit = Math.min(purchase.creditAmountApplied ?? 0, purchase.amountGross);
  const cashGross = purchase.amountGross - credit;
  if (cashGross > 0.009 && !purchase.paymentAccountId) {
    throw new BadRequestException("Select a payment account for the cash portion of this purchase");
  }
  if ((purchase.creditAmountApplied ?? 0) > purchase.amountGross + 0.009) {
    throw new BadRequestException("Credit applied cannot exceed the purchase total");
  }
  if (purchase.vatAmount < 0 || purchase.vatAmount > purchase.amountGross) {
    throw new BadRequestException("Invalid purchase VAT amount");
  }
}
