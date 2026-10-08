import { jsPDF } from "jspdf";

export interface ReceiptPdfData {
  receiptNumber: string;
  paymentDate: string;
  memberName: string;
  memberId: string;
  memberPhone?: string;
  amount: number;
  method: string;
  referenceNumber?: string;
  recordedBy: string;
  invoiceBalance?: number;
  memberRemainingDues?: number;
  gymName?: string;
  gymPhone?: string;
  gymAddress?: string;
  receiptFooter?: string;
}

/**
 * Generate binary PDF buffer for payment receipt (A4 or Thermal 80mm format)
 */
export function generateReceiptPdf(
  data: ReceiptPdfData,
  format: "A4" | "THERMAL_80MM" = "A4"
): Buffer {
  const isThermal = format === "THERMAL_80MM";

  // Thermal: 80mm width (~226pt), variable height
  // A4: 210mm x 297mm (595pt x 842pt)
  const doc = isThermal
    ? new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: [80, 160],
      })
    : new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

  const pageWidth = doc.internal.pageSize.getWidth();

  if (isThermal) {
    // ---------------- THERMAL 80MM LAYOUT ----------------
    let y = 10;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text(data.gymName || "OXGEN FITNESS CLUB", pageWidth / 2, y, { align: "center" });

    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    if (data.gymAddress) {
      doc.text(data.gymAddress, pageWidth / 2, y, { align: "center" });
      y += 4;
    }
    if (data.gymPhone) {
      doc.text(`Phone: ${data.gymPhone}`, pageWidth / 2, y, { align: "center" });
      y += 4;
    }

    doc.line(5, y, pageWidth - 5, y);
    y += 5;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("PAYMENT RECEIPT", pageWidth / 2, y, { align: "center" });
    y += 5;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(`Receipt #: ${data.receiptNumber}`, 5, y);
    y += 4;
    doc.text(`Date: ${data.paymentDate}`, 5, y);
    y += 4;
    doc.text(`Member: ${data.memberName} (${data.memberId})`, 5, y);
    y += 4;
    doc.text(`Payment Method: ${data.method}`, 5, y);
    if (data.referenceNumber) {
      y += 4;
      doc.text(`Ref / TRX ID: ${data.referenceNumber}`, 5, y);
    }
    y += 5;

    doc.line(5, y, pageWidth - 5, y);
    y += 6;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(`AMOUNT PAID: Rs. ${data.amount.toLocaleString()}`, pageWidth / 2, y, { align: "center" });
    y += 6;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    if (data.memberRemainingDues !== undefined) {
      doc.text(`Remaining Balance: Rs. ${data.memberRemainingDues.toLocaleString()}`, 5, y);
      y += 4;
    }
    doc.text(`Cashier / Operator: ${data.recordedBy}`, 5, y);
    y += 6;

    doc.line(5, y, pageWidth - 5, y);
    y += 5;

    doc.setFontSize(7);
    doc.text(data.receiptFooter || "Thank you for choosing OXGEN GYM", pageWidth / 2, y, { align: "center" });
  } else {
    // ---------------- A4 STANDARD LAYOUT ----------------
    let y = 20;

    // Header Branding Bar
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(14, y, pageWidth - 28, 24, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(249, 115, 22); // orange-500
    doc.text(data.gymName || "OXGEN FITNESS CLUB", 20, y + 15);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    doc.text("OFFICIAL PAYMENT RECEIPT", pageWidth - 22, y + 15, { align: "right" });

    y += 32;
    doc.setTextColor(30, 41, 59);

    // Meta details boxes
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("RECEIPT DETAILS", 16, y);
    doc.text("MEMBER INFORMATION", pageWidth / 2 + 5, y);

    y += 2;
    doc.setDrawColor(226, 232, 240);
    doc.line(16, y, pageWidth / 2 - 10, y);
    doc.line(pageWidth / 2 + 5, y, pageWidth - 16, y);

    y += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`Receipt Number: ${data.receiptNumber}`, 16, y);
    doc.text(`Member Name: ${data.memberName}`, pageWidth / 2 + 5, y);

    y += 6;
    doc.text(`Payment Date: ${data.paymentDate}`, 16, y);
    doc.text(`Member ID: ${data.memberId}`, pageWidth / 2 + 5, y);

    y += 6;
    doc.text(`Payment Mode: ${data.method}`, 16, y);
    if (data.memberPhone) {
      doc.text(`Contact: ${data.memberPhone}`, pageWidth / 2 + 5, y);
    }

    if (data.referenceNumber) {
      y += 6;
      doc.text(`Reference / TRX: ${data.referenceNumber}`, 16, y);
    }

    y += 14;

    // Payment Box
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(16, y, pageWidth - 32, 28, 2, 2, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("TOTAL AMOUNT RECEIVED", 22, y + 12);

    doc.setFontSize(16);
    doc.setTextColor(249, 115, 22);
    doc.text(`PKR ${data.amount.toLocaleString()}`, pageWidth - 22, y + 14, { align: "right" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    if (data.memberRemainingDues !== undefined) {
      doc.text(`Remaining Dues After Payment: PKR ${data.memberRemainingDues.toLocaleString()}`, 22, y + 22);
    }

    y += 40;
    doc.setTextColor(30, 41, 59);

    // Operator and Signature Area
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`Received By: ${data.recordedBy}`, 16, y);
    doc.text("Authorized Signature: ______________________", pageWidth - 16, y, { align: "right" });

    y += 18;
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(
      data.receiptFooter || "Computer generated receipt. For queries, contact OXGEN GYM front desk.",
      pageWidth / 2,
      y,
      { align: "center" }
    );
  }

  const arrayBuffer = doc.output("arraybuffer");
  return Buffer.from(arrayBuffer);
}
