export type InvoiceLinePreviewInput = {
  quantity: number;
  unitPriceNet: number;
  vatRatePercent: number;
};

export function previewInvoiceLine(input: InvoiceLinePreviewInput) {
  const qty = input.quantity > 0 ? input.quantity : 1;
  const unit = input.unitPriceNet > 0 ? input.unitPriceNet : 0;
  const rate = Math.max(0, input.vatRatePercent);
  const net = Math.round(qty * unit * 100) / 100;
  const vat = Math.round(((net * rate) / 100) * 100) / 100;
  const gross = Math.round((net + vat) * 100) / 100;
  return { net, vat, gross };
}

export function previewInvoiceTotals(lines: InvoiceLinePreviewInput[]) {
  let net = 0;
  let vat = 0;
  let gross = 0;
  for (const line of lines) {
    const row = previewInvoiceLine(line);
    net += row.net;
    vat += row.vat;
    gross += row.gross;
  }
  return {
    amountNet: Math.round(net * 100) / 100,
    vatAmount: Math.round(vat * 100) / 100,
    amountGross: Math.round(gross * 100) / 100,
  };
}

export function invoiceBalanceDue(amountGross: number, depositAmount: number, amountPaid = 0) {
  return Math.max(0, Math.round((amountGross - depositAmount - amountPaid) * 100) / 100);
}
