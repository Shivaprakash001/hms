import { prisma } from "../db";
import { jsPDF } from "jspdf";

export class ReceiptService {
  async getReceiptData(paymentId: string) {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        student: {
          include: { profile: true }
        },
        obligation: true
      }
    });

    if (!payment) throw new Error("NOT_FOUND: Payment not found");

    const owner_hostel = await prisma.hostel.findFirst({
      where: { owner_id: payment.student.owner_id as string }
    });

    return {
      receipt_no: payment.id.substring(0, 8).toUpperCase(),
      date: payment.payment_date,
      rent_month: payment.obligation.rent_month,
      hostel_name: owner_hostel?.name || "HMS Hostel",
      student_name: payment.student.profile.name,
      amount: Number(payment.amount_paid),
      method: payment.payment_method,
      reference: payment.reference_number
    };
  }

  async generatePdfBuffer(paymentId: string): Promise<Buffer> {
    const data = await this.getReceiptData(paymentId);

    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    let y = 25;

    // ── Header ──────────────────────────────────────────────
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text(data.hostel_name, pageWidth / 2, y, { align: "center" });
    y += 8;

    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(120, 120, 120);
    doc.text("Payment Receipt", pageWidth / 2, y, { align: "center" });
    doc.setTextColor(0, 0, 0);
    y += 5;

    // Divider line
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.5);
    doc.line(margin, y, pageWidth - margin, y);
    y += 12;

    // ── Receipt Details ─────────────────────────────────────
    const labelX = margin + 5;
    const valueX = margin + 45;
    const rightLabelX = pageWidth / 2 + 10;
    const rightValueX = pageWidth / 2 + 40;
    const rowHeight = 9;

    const drawRow = (label: string, value: string, rowY: number, rightLabel?: string, rightValue?: string) => {
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(100, 100, 100);
      doc.text(label, labelX, rowY);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(30, 30, 30);
      doc.text(value, valueX, rowY);

      if (rightLabel && rightValue) {
        doc.setFont("helvetica", "bold");
        doc.setTextColor(100, 100, 100);
        doc.text(rightLabel, rightLabelX, rowY);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(30, 30, 30);
        doc.text(rightValue, rightValueX, rowY);
      }
    };

    // Rounded-ish box
    doc.setDrawColor(226, 232, 240);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(margin, y - 5, pageWidth - 2 * margin, rowHeight * 5 + 10, 3, 3, "FD");
    y += 4;

    const dateStr = data.date ? new Date(data.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "N/A";
    drawRow("Receipt No:", data.receipt_no, y, "Date:", dateStr);
    y += rowHeight;

    drawRow("Tenant:", data.student_name, y);
    y += rowHeight;

    const cycleDate = new Date(data.rent_month);
    const cycleName = cycleDate.toLocaleString("default", { month: "long", year: "numeric" });
    drawRow("Rent Cycle:", cycleName, y);
    y += rowHeight;

    drawRow("Method:", (data.method || "N/A").toUpperCase(), y);
    y += rowHeight;

    if (data.reference) {
      drawRow("Reference:", data.reference, y);
    }

    y += rowHeight + 10;

    // ── Amount Box ──────────────────────────────────────────
    doc.setDrawColor(99, 102, 241); // indigo border
    doc.setFillColor(238, 242, 255); // light indigo fill
    doc.roundedRect(margin, y, pageWidth - 2 * margin, 22, 3, 3, "FD");

    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 41, 59);
    doc.text("Amount Received", labelX, y + 14);

    doc.setFontSize(16);
    doc.setTextColor(67, 56, 202); // indigo-700
    doc.text(`Rs. ${data.amount.toLocaleString("en-IN")}`, pageWidth - margin - 5, y + 14, { align: "right" });

    y += 38;

    // ── Footer ──────────────────────────────────────────────
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(150, 150, 150);
    doc.text(
      "This is a computer generated receipt and does not require a physical signature.",
      pageWidth / 2, y, { align: "center" }
    );

    // Convert to Node Buffer
    const arrayBuf = doc.output("arraybuffer");
    return Buffer.from(arrayBuf);
  }
}

export const receiptService = new ReceiptService();
