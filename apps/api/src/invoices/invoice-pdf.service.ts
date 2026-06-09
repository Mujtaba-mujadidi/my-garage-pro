import { invoiceBalanceDue } from "@mygaragepro/shared";
import { Injectable } from "@nestjs/common";
import type {
  Customer,
  GarageAccount,
  Invoice,
  InvoiceLine,
  PaymentAllocation,
} from "@prisma/client";
import PDFDocument from "pdfkit";
import { allocatedTotal } from "./invoice-calculations";
import { customerDisplayName } from "./invoices.mapper";

type InvoicePdfData = Invoice & {
  customer: Customer;
  lines: InvoiceLine[];
  garageAccount: GarageAccount;
  allocations?: PaymentAllocation[];
};

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  SENT: "Sent",
  PART_PAID: "Part paid",
  PAID: "Paid",
  CANCELLED: "Cancelled",
};

const COLORS = {
  text: "#111827",
  muted: "#6b7280",
  border: "#e5e7eb",
  background: "#f9fafb",
};

const MARGIN = 50;
const PAGE_WIDTH = 595.28;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

const TABLE_COLS = {
  description: { x: MARGIN, width: 210 },
  qty: { x: MARGIN + 210, width: 45 },
  unit: { x: MARGIN + 255, width: 105 },
  total: { x: MARGIN + 360, width: CONTENT_WIDTH - 360 },
};

function formatGbp(value: string | number): string {
  const n = typeof value === "string" ? Number(value) : value;
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(
    Number.isNaN(n) ? 0 : n,
  );
}

function formatIsoDate(date: Date | null): string | null {
  return date ? date.toISOString().slice(0, 10) : null;
}

function lineTypeLabel(lineType: string): string {
  return lineType === "LABOUR" ? "Labour" : "Parts";
}

@Injectable()
export class InvoicePdfService {
  async build(invoice: InvoicePdfData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: MARGIN, size: "A4" });
      const chunks: Buffer[] = [];
      doc.on("data", (c: Buffer) => chunks.push(c));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      const garage = invoice.garageAccount;
      const customerName = customerDisplayName(invoice.customer);
      const paid = invoice.allocations ? allocatedTotal(invoice.allocations) : 0;
      const deposit = Number(invoice.depositAmount);
      const balance = invoiceBalanceDue(Number(invoice.amountGross), deposit, paid);
      const sortedLines = [...invoice.lines].sort((a, b) => a.sortOrder - b.sortOrder);

      this.drawGarageLetterhead(doc, garage);
      this.drawTitle(doc, invoice.invoiceNumber);
      this.drawMetadata(doc, invoice, customerName);
      if (invoice.notes?.trim()) {
        this.drawNotes(doc, invoice.notes.trim());
      }
      this.drawLinesTable(doc, sortedLines);
      this.drawTotals(doc, invoice, deposit, paid, balance);

      doc.end();
    });
  }

  private drawGarageLetterhead(doc: PDFKit.PDFDocument, garage: GarageAccount) {
    doc.fillColor(COLORS.muted).font("Helvetica").fontSize(9);
    doc.text(garage.name, MARGIN, doc.y, { width: CONTENT_WIDTH });
    if (garage.address?.trim()) {
      doc.text(garage.address.trim(), { width: CONTENT_WIDTH });
    }
    if (garage.vatNumber?.trim()) {
      doc.text(`VAT ${garage.vatNumber.trim()}`, { width: CONTENT_WIDTH });
    }
    doc.moveDown(1.2);
  }

  private drawTitle(doc: PDFKit.PDFDocument, invoiceNumber: string) {
    doc.fillColor(COLORS.text).font("Helvetica-Bold").fontSize(18);
    doc.text(invoiceNumber, MARGIN, doc.y, { width: CONTENT_WIDTH });
    doc.moveDown(0.8);
  }

  private drawMetadata(doc: PDFKit.PDFDocument, invoice: InvoicePdfData, customerName: string) {
    const leftX = MARGIN;
    const rightX = MARGIN + CONTENT_WIDTH / 2 + 8;
    const colWidth = CONTENT_WIDTH / 2 - 8;
    const rowGap = 6;

    const items: { label: string; value: string; mono?: boolean }[] = [
      { label: "Customer", value: customerName },
      { label: "Status", value: STATUS_LABEL[invoice.status] ?? invoice.status },
    ];
    if (invoice.vehicleRegistration) {
      items.push({ label: "Vehicle", value: invoice.vehicleRegistration, mono: true });
    }
    const issueDate = formatIsoDate(invoice.issueDate);
    if (issueDate) items.push({ label: "Issued", value: issueDate });
    const dueDate = formatIsoDate(invoice.dueDate);
    if (dueDate) items.push({ label: "Due", value: dueDate });

    let y = doc.y;
    for (let i = 0; i < items.length; i += 2) {
      const left = items[i];
      const right = items[i + 1];
      const leftHeight = this.metadataCellHeight(doc, left, colWidth);
      const rightHeight = right ? this.metadataCellHeight(doc, right, colWidth) : 0;
      const rowHeight = Math.max(leftHeight, rightHeight, 14);

      this.drawMetadataCell(doc, left, leftX, y, colWidth, rowHeight);
      if (right) {
        this.drawMetadataCell(doc, right, rightX, y, colWidth, rowHeight);
      }

      y += rowHeight + rowGap;
    }

    doc.y = y + 4;
  }

  private metadataCellHeight(
    doc: PDFKit.PDFDocument,
    item: { label: string; value: string; mono?: boolean },
    width: number,
  ) {
    doc.font("Helvetica").fontSize(10);
    return doc.heightOfString(`${item.label} ${item.value}`, { width });
  }

  private drawMetadataCell(
    doc: PDFKit.PDFDocument,
    item: { label: string; value: string; mono?: boolean },
    x: number,
    y: number,
    width: number,
    _height: number,
  ) {
    doc.fillColor(COLORS.muted).font("Helvetica").fontSize(9);
    doc.text(`${item.label} `, x, y, { continued: true, width });
    doc.fillColor(COLORS.text).font(item.mono ? "Courier" : "Helvetica").fontSize(10);
    doc.text(item.value, { width });
  }

  private drawNotes(doc: PDFKit.PDFDocument, notes: string) {
    const padding = 10;
    const boxX = MARGIN;
    const boxWidth = CONTENT_WIDTH;
    const textY = doc.y + padding;
    doc.font("Helvetica").fontSize(9);
    const textHeight = doc.heightOfString(notes, { width: boxWidth - padding * 2 });
    const boxHeight = textHeight + padding * 2;

    doc
      .roundedRect(boxX, doc.y, boxWidth, boxHeight, 6)
      .fillColor(COLORS.background)
      .fill();

    doc.fillColor(COLORS.muted).text(notes, boxX + padding, textY, {
      width: boxWidth - padding * 2,
    });
    doc.y += boxHeight + 12;
  }

  private drawLinesTable(doc: PDFKit.PDFDocument, lines: InvoiceLine[]) {
    const tableX = MARGIN;
    const tableWidth = CONTENT_WIDTH;
    const headerHeight = 22;
    const rowPaddingY = 8;
    let tableTop = doc.y;

    doc.save();
    doc
      .roundedRect(tableX, tableTop, tableWidth, headerHeight, 6)
      .fillColor(COLORS.background)
      .fill();
    doc.restore();

    doc.fillColor(COLORS.muted).font("Helvetica").fontSize(8);
    const headerY = tableTop + 7;
    doc.text("Description", TABLE_COLS.description.x + 10, headerY, {
      width: TABLE_COLS.description.width - 10,
    });
    doc.text("Qty", TABLE_COLS.qty.x, headerY, {
      width: TABLE_COLS.qty.width,
      align: "right",
    });
    doc.text("Unit (ex VAT)", TABLE_COLS.unit.x, headerY, {
      width: TABLE_COLS.unit.width,
      align: "right",
    });
    doc.text("Line total (inc VAT)", TABLE_COLS.total.x, headerY, {
      width: TABLE_COLS.total.width - 10,
      align: "right",
    });

    let y = tableTop + headerHeight;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const typeLabel = lineTypeLabel(line.lineType);
      doc.font("Helvetica").fontSize(7);
      const typeHeight = doc.heightOfString(typeLabel, {
        width: TABLE_COLS.description.width - 20,
      });
      doc.font("Helvetica").fontSize(10);
      const descHeight = doc.heightOfString(line.description, {
        width: TABLE_COLS.description.width - 20,
      });
      const rowHeight = Math.max(36, typeHeight + descHeight + rowPaddingY * 2);

      if (y + rowHeight > doc.page.height - 160) {
        this.strokeTableBody(doc, tableX, tableTop, tableWidth, y - tableTop);
        doc.addPage();
        tableTop = MARGIN;
        y = tableTop + headerHeight;
        doc.save();
        doc
          .roundedRect(tableX, tableTop, tableWidth, headerHeight, 6)
          .fillColor(COLORS.background)
          .fill();
        doc.restore();
        doc.fillColor(COLORS.muted).font("Helvetica").fontSize(8);
        const headerY = tableTop + 7;
        doc.text("Description", TABLE_COLS.description.x + 10, headerY, {
          width: TABLE_COLS.description.width - 10,
        });
        doc.text("Qty", TABLE_COLS.qty.x, headerY, {
          width: TABLE_COLS.qty.width,
          align: "right",
        });
        doc.text("Unit (ex VAT)", TABLE_COLS.unit.x, headerY, {
          width: TABLE_COLS.unit.width,
          align: "right",
        });
        doc.text("Line total (inc VAT)", TABLE_COLS.total.x, headerY, {
          width: TABLE_COLS.total.width - 10,
          align: "right",
        });
      }

      if (i > 0) {
        doc
          .strokeColor(COLORS.border)
          .moveTo(tableX, y)
          .lineTo(tableX + tableWidth, y)
          .stroke();
      }

      const cellY = y + rowPaddingY;
      doc.fillColor(COLORS.muted).font("Helvetica").fontSize(7);
      doc.text(typeLabel.toUpperCase(), TABLE_COLS.description.x + 10, cellY, {
        width: TABLE_COLS.description.width - 20,
      });
      doc.fillColor(COLORS.text).font("Helvetica").fontSize(10);
      doc.text(line.description, TABLE_COLS.description.x + 10, cellY + typeHeight + 2, {
        width: TABLE_COLS.description.width - 20,
      });

      doc.font("Helvetica").fontSize(10);
      doc.text(line.quantity.toString(), TABLE_COLS.qty.x, cellY + 6, {
        width: TABLE_COLS.qty.width,
        align: "right",
      });
      doc.font("Courier").fontSize(10);
      doc.text(formatGbp(line.unitPriceNet.toString()), TABLE_COLS.unit.x, cellY + 6, {
        width: TABLE_COLS.unit.width,
        align: "right",
      });
      doc.text(formatGbp(line.amountGross.toString()), TABLE_COLS.total.x, cellY + 6, {
        width: TABLE_COLS.total.width - 10,
        align: "right",
      });

      y += rowHeight;
    }

    this.strokeTableBody(doc, tableX, tableTop, tableWidth, y - tableTop);
    doc.y = y + 16;
  }

  private strokeTableBody(
    doc: PDFKit.PDFDocument,
    x: number,
    y: number,
    width: number,
    height: number,
  ) {
    doc.strokeColor(COLORS.border).lineWidth(1);
    doc.roundedRect(x, y, width, height, 6).stroke();
  }

  private drawTotals(
    doc: PDFKit.PDFDocument,
    invoice: InvoicePdfData,
    deposit: number,
    paid: number,
    balance: number,
  ) {
    const boxWidth = 200;
    const boxX = MARGIN + CONTENT_WIDTH - boxWidth;
    const labelWidth = 90;
    const valueWidth = boxWidth - labelWidth;
    const rowHeight = 16;
    let y = doc.y;

    const rows: { label: string; value: string; bold?: boolean; borderTop?: boolean }[] = [
      { label: "Net", value: formatGbp(invoice.amountNet.toString()) },
      { label: "VAT", value: formatGbp(invoice.vatAmount.toString()) },
      { label: "Total (inc VAT)", value: formatGbp(invoice.amountGross.toString()), bold: true },
    ];
    if (deposit > 0.009) {
      rows.push({ label: "Deposit", value: formatGbp(deposit) });
    }
    if (paid > 0.009) {
      rows.push({ label: "Paid", value: formatGbp(paid) });
    }
    rows.push({ label: "Balance due", value: formatGbp(balance), borderTop: true });

    for (const row of rows) {
      if (row.borderTop) {
        doc
          .strokeColor(COLORS.border)
          .moveTo(boxX, y - 4)
          .lineTo(boxX + boxWidth, y - 4)
          .stroke();
        y += 4;
      }

      doc.fillColor(COLORS.muted).font("Helvetica").fontSize(10);
      if (row.bold) {
        doc.fillColor(COLORS.text).font("Helvetica-Bold");
      }
      doc.text(row.label, boxX, y, { width: labelWidth, align: "left" });

      doc
        .fillColor(COLORS.text)
        .font(row.bold ? "Helvetica-Bold" : "Courier")
        .fontSize(10);
      doc.text(row.value, boxX + labelWidth, y, { width: valueWidth, align: "right" });

      y += rowHeight;
    }

    doc.y = y;
  }
}
