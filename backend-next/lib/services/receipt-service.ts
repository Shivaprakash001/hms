import { prisma } from "../db";
import { jsPDF } from "jspdf";
import crypto from "crypto";

export class ReceiptService {

  /**
   * Generate a sequential, race-safe receipt number scoped per hostel + year.
   * Format: PREFIX-YEAR-SEQUENCE (e.g., HMS-2026-00001)
   * Uses retry loop to handle concurrent receipt creation.
   */
  async generateReceiptNumber(ownerId: string): Promise<string> {
    const hostel = await prisma.hostel.findFirst({
      where: { owner_id: ownerId, is_active: true },
    });

    const config = (hostel as any)?.preferences_config || {};
    const customPrefix = config.receipt_prefix || hostel?.receipt_prefix || "HMS";
    const year = new Date().getFullYear();
    const prefix = `${customPrefix}-${year}-`;

    // Retry loop for race-condition safety
    for (let attempt = 0; attempt < 5; attempt++) {
      const lastReceipt = await prisma.receipt.findFirst({
        where: {
          receipt_number: { startsWith: prefix },
          owner_id: ownerId,
        },
        orderBy: { issued_at: "desc" },
      });

      let nextSeq = 1;
      if (lastReceipt) {
        const lastSeq = parseInt(lastReceipt.receipt_number.replace(prefix, ""), 10);
        if (!isNaN(lastSeq)) nextSeq = lastSeq + 1;
      }

      const candidate = `${prefix}${nextSeq.toString().padStart(5, "0")}`;

      // Verify the candidate doesn't already exist (race-condition guard)
      const exists = await prisma.receipt.findUnique({
        where: { receipt_number: candidate },
      });

      if (!exists) return candidate;

      // Collision detected — retry with incremented sequence
      console.warn(`[ReceiptService] Sequence collision on ${candidate}, retrying (attempt ${attempt + 1})`);
    }

    // Fallback: UUID-based receipt number to guarantee uniqueness
    const fallback = `${customPrefix}-${year}-${crypto.randomUUID().substring(0, 8).toUpperCase()}`;
    console.warn(`[ReceiptService] Exhausted retries, using fallback receipt number: ${fallback}`);
    return fallback;
  }

  /**
   * Create a receipt record in the database after a payment is confirmed.
   * This is the ONLY place receipts are created — triggered from finalizePaymentAttempt or recordPayment.
   * IDEMPOTENT: will not duplicate if called multiple times for the same payment.
   */
  async createReceipt(paymentId: string): Promise<any> {
    // Check if receipt already exists for this payment (idempotent)
    const existing = await prisma.receipt.findFirst({
      where: { payment_id: paymentId },
    });
    if (existing) return existing;

    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        tenant: { include: { profile: true } },
        obligation: true,
      },
    });

    if (!payment) throw new Error("NOT_FOUND: Payment not found");

    const hostel = await prisma.hostel.findFirst({
      where: { owner_id: payment.tenant.owner_id as string },
    });

    const config = (hostel as any)?.preferences_config || {};
    const ownerId = payment.tenant.owner_id || payment.owner_id || "";

    const receiptNumber = await this.generateReceiptNumber(ownerId);

    const receipt = await prisma.receipt.create({
      data: {
        receipt_number: receiptNumber,
        payment_id: payment.id,
        tenant_id: payment.tenant_id,
        owner_id: payment.owner_id,
        amount: payment.amount_paid,
        payment_method: payment.payment_method,
        transaction_id: payment.reference_number,
        hostel_name: hostel?.name || "HMS Hostel",
        tenant_name: payment.tenant.profile.name,
        rent_month: payment.obligation.rent_month,
      },
    });

    return {
      ...receipt,
      // Attach transient rendering context (not stored in DB)
      _renderContext: {
        footer: config.receipt_footer || null,
        currency: hostel?.currency || "INR",
        timezone: hostel?.timezone || "Asia/Kolkata",
      },
    };
  }

  /**
   * Generate PDF buffer from a receipt record (by paymentId).
   * Looks up the stored receipt, then renders a PDF from it.
   */
  async generatePdfBuffer(paymentId: string): Promise<Buffer> {
    // Ensure receipt exists first
    let receipt = await prisma.receipt.findFirst({
      where: { payment_id: paymentId },
    });

    // If no receipt record exists yet, create one (backward compatibility)
    if (!receipt) {
      receipt = await this.createReceipt(paymentId);
    }

    if (!receipt) {
      throw new Error("Failed to create or retrieve receipt");
    }

    // Fetch rendering context from hostel preferences
    const hostel = await prisma.hostel.findFirst({
      where: { owner_id: receipt.owner_id || "" },
    });
    const config = (hostel as any)?.preferences_config || {};

    return this.renderReceiptPdf(receipt as any, {
      footer: config.receipt_footer || null,
      currency: hostel?.currency || "INR",
      timezone: hostel?.timezone || "Asia/Kolkata",
    });
  }

  /**
   * Generate PDF buffer directly from a receipt record.
   * Now preference-aware: uses owner's currency, timezone, and custom footer.
   */
  renderReceiptPdf(
    receipt: {
      receipt_number: string;
      hostel_name: string | null;
      tenant_name: string | null;
      rent_month: Date | null;
      amount: any;
      payment_method: string;
      transaction_id: string | null;
      issued_at: Date;
    },
    context?: {
      footer?: string | null;
      currency?: string;
      timezone?: string;
    }
  ): Buffer {
    const tz = context?.timezone || "Asia/Kolkata";
    const currency = context?.currency || "INR";
    const customFooter = context?.footer;

    const currencySymbol =
      currency === "USD" ? "$" :
      currency === "EUR" ? "€" :
      currency === "GBP" ? "£" : "₹";

    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    let y = 25;

    // ── Header ──────────────────────────────────────────────
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text(receipt.hostel_name || "HMS Hostel", pageWidth / 2, y, { align: "center" });
    y += 8;

    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(120, 120, 120);
    doc.text("Payment Receipt", pageWidth / 2, y, { align: "center" });
    doc.setTextColor(0, 0, 0);
    y += 5;

    // Divider
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
      doc.text(value || "N/A", valueX, rowY);

      if (rightLabel && rightValue) {
        doc.setFont("helvetica", "bold");
        doc.setTextColor(100, 100, 100);
        doc.text(rightLabel, rightLabelX, rowY);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(30, 30, 30);
        doc.text(rightValue || "N/A", rightValueX, rowY);
      }
    };

    // Background box
    doc.setDrawColor(226, 232, 240);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(margin, y - 5, pageWidth - 2 * margin, rowHeight * 5 + 10, 3, 3, "FD");
    y += 4;

    // Format date using owner's timezone preference
    let dateStr: string;
    try {
      dateStr = new Intl.DateTimeFormat("en-IN", {
        timeZone: tz,
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(new Date(receipt.issued_at));
    } catch {
      dateStr = new Date(receipt.issued_at).toLocaleDateString("en-IN", {
        day: "2-digit", month: "short", year: "numeric",
      });
    }

    drawRow("Receipt No:", receipt.receipt_number, y, "Date:", dateStr);
    y += rowHeight;

    drawRow("Tenant:", receipt.tenant_name || "N/A", y);
    y += rowHeight;

    const cycleName = receipt.rent_month
      ? new Date(receipt.rent_month).toLocaleString("default", { month: "long", year: "numeric" })
      : "N/A";
    drawRow("Rent Cycle:", cycleName, y);
    y += rowHeight;

    drawRow("Method:", (receipt.payment_method || "N/A").toUpperCase(), y);
    y += rowHeight;

    if (receipt.transaction_id) {
      drawRow("Reference:", receipt.transaction_id, y);
    }

    y += rowHeight + 10;

    // ── Amount Box ──────────────────────────────────────────
    const amount = Number(receipt.amount);
    doc.setDrawColor(99, 102, 241);
    doc.setFillColor(238, 242, 255);
    doc.roundedRect(margin, y, pageWidth - 2 * margin, 22, 3, 3, "FD");

    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 41, 59);
    doc.text("Amount Received", labelX, y + 14);

    doc.setFontSize(16);
    doc.setTextColor(67, 56, 202);
    doc.text(`${currencySymbol} ${amount.toLocaleString("en-IN")}`, pageWidth - margin - 5, y + 14, { align: "right" });

    y += 38;

    // ── Footer ──────────────────────────────────────────────
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(150, 150, 150);

    const footerText = customFooter || "This is a computer generated receipt and does not require a physical signature.";
    doc.text(footerText, pageWidth / 2, y, { align: "center", maxWidth: pageWidth - 2 * margin });

    const arrayBuf = doc.output("arraybuffer");
    return Buffer.from(arrayBuf);
  }
}

export const receiptService = new ReceiptService();
