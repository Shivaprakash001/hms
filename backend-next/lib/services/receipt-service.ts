/**
 * 🧾 Receipt Service — Puppeteer-Based PDF Generation
 *
 * Responsibilities:
 * 1. Create receipt records (idempotent, race-safe sequence)
 * 2. Fetch all data needed for the receipt template
 * 3. Render HTML via receipt-template.ts
 * 4. Convert to PDF via Puppeteer headless browser
 *
 * The old jsPDF-based rendering has been replaced with a headless
 * browser approach for pixel-perfect CSS fidelity.
 */

import { prisma } from "../db";
import crypto from "crypto";
import { getHostelWithPreferences } from "../preferences";
import { htmlToPdf } from "../pdf/browser";
import { renderReceiptHTML, RECEIPT_TEMPLATE_VERSION, type ReceiptRenderData } from "../pdf/receipt-template";

export class ReceiptService {

  /**
   * Generate a sequential, race-safe receipt number scoped per hostel + year.
   * Format: PREFIX-YEAR-SEQUENCE (e.g., HMS-2026-00001)
   * Uses retry loop to handle concurrent receipt creation.
   */
  async generateReceiptNumber(ownerId: string): Promise<string> {
    const { prefs } = await getHostelWithPreferences(ownerId);
    const year = new Date().getFullYear();
    const prefix = `${prefs.receipt_prefix}-${year}-`;

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

      const exists = await prisma.receipt.findUnique({
        where: { receipt_number: candidate },
      });

      if (!exists) return candidate;

      console.warn(`[ReceiptService] Sequence collision on ${candidate}, retrying (attempt ${attempt + 1})`);
    }

    const { prefs: p } = await getHostelWithPreferences(ownerId);
    const fallback = `${p.receipt_prefix}-${new Date().getFullYear()}-${crypto.randomUUID().substring(0, 8).toUpperCase()}`;
    console.warn(`[ReceiptService] Exhausted retries, using fallback: ${fallback}`);
    return fallback;
  }

  /**
   * Create a receipt record in the database after a payment is confirmed.
   * IDEMPOTENT: will not duplicate if called multiple times for the same payment.
   */
  async createReceipt(paymentId: string): Promise<any> {
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

    const ownerId = payment.tenant.owner_id || payment.owner_id || "";
    const { hostel, prefs } = await getHostelWithPreferences(ownerId);

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
        invoice_template_version: RECEIPT_TEMPLATE_VERSION,
      },
    });

    return {
      ...receipt,
      _renderContext: {
        footer: prefs.receipt_footer || null,
        currency: prefs.currency,
        timezone: prefs.timezone,
      },
    };
  }

  /**
   * Generate a PDF buffer for a payment's receipt.
   *
   * Flow:
   * 1. Fetch/create receipt record
   * 2. Fetch all related data (hostel, tenant, room, obligation)
   * 3. Render HTML from template
   * 4. Convert HTML → PDF via headless Chromium
   */
  async generatePdfBuffer(paymentId: string): Promise<Buffer> {
    // 1. Get or create receipt
    let receipt = await prisma.receipt.findFirst({
      where: { payment_id: paymentId },
      include: {
        payment: { include: { obligation: true } },
        tenant: { include: { profile: true } },
      },
    });

    if (!receipt) {
      await this.createReceipt(paymentId);
      receipt = await prisma.receipt.findFirst({
        where: { payment_id: paymentId },
        include: {
          payment: { include: { obligation: true } },
          tenant: { include: { profile: true } },
        },
      });
    }

    if (!receipt) {
      throw new Error("NOT_FOUND: Failed to create or retrieve receipt");
    }

    // 2. Fetch hostel + preferences + room allocation
    const ownerId = receipt.owner_id || receipt.tenant?.owner_id || "";
    const { hostel, prefs } = await getHostelWithPreferences(ownerId);

    const allocation = await prisma.roomAllocation.findFirst({
      where: { tenant_id: receipt.tenant_id, is_active: true },
      include: { room: true },
      orderBy: { start_date: "desc" },
    });

    // If no active allocation, try the most recent one
    const fallbackAllocation = allocation || await prisma.roomAllocation.findFirst({
      where: { tenant_id: receipt.tenant_id },
      include: { room: true },
      orderBy: { start_date: "desc" },
    });

    // 3. Build render data
    const renderData: ReceiptRenderData = {
      // Hostel
      hostel_name: hostel?.name || receipt.hostel_name || "HMS Hostel",
      hostel_address: hostel?.address || "",
      hostel_city: hostel?.city || null,
      hostel_state: hostel?.state || null,
      hostel_pincode: hostel?.pincode || null,
      hostel_phone: hostel?.phone || null,
      hostel_gst: hostel?.gst_number || null,
      hostel_logo_url: hostel?.logo_url || null,

      // Receipt
      receipt_number: receipt.receipt_number,
      issued_at: receipt.issued_at,

      // Tenant
      tenant_name: receipt.tenant?.profile?.name || receipt.tenant_name || "Tenant",
      tenant_phone: receipt.tenant?.profile?.phone || null,
      tenant_email: receipt.tenant?.profile?.email || null,
      room_no: fallbackAllocation?.room?.room_no || null,
      room_floor: fallbackAllocation?.room?.floor != null
        ? String(fallbackAllocation.room.floor)
        : null,

      // Payment
      amount: Number(receipt.amount),
      payment_method: receipt.payment_method,
      transaction_id: receipt.transaction_id || null,
      reference_number: receipt.payment?.reference_number || null,
      payment_date: receipt.payment?.payment_date || receipt.issued_at,

      // Obligation
      rent_month: receipt.rent_month || receipt.payment?.obligation?.rent_month || null,
      due_date: receipt.payment?.obligation?.due_date || null,
      obligation_amount: receipt.payment?.obligation
        ? Number(receipt.payment.obligation.amount)
        : null,
      obligation_status: receipt.payment?.obligation?.status || null,

      // Preferences
      prefs,
      footer: prefs.receipt_footer || null,
    };

    // 4. Render HTML → PDF
    const html = renderReceiptHTML(renderData);
    const pdfBuffer = await htmlToPdf(html);

    return pdfBuffer;
  }

  /**
   * Render receipt PDF directly from a receipt record with context.
   * Used by the payment-service email flow for backward compatibility.
   */
  async renderReceiptPdf(
    receipt: {
      receipt_number: string;
      hostel_name: string | null;
      tenant_name: string | null;
      rent_month: Date | null;
      amount: any;
      payment_method: string;
      transaction_id: string | null;
      issued_at: Date;
      owner_id?: string | null;
      payment_id?: string;
    },
    context?: {
      footer?: string | null;
      currency?: string;
      timezone?: string;
    }
  ): Promise<Buffer> {
    // If we have a payment_id, use the full pipeline for richest data
    if (receipt.payment_id) {
      try {
        return await this.generatePdfBuffer(receipt.payment_id);
      } catch (e) {
        console.warn("[ReceiptService] Full pipeline failed, falling back to minimal render:", e);
      }
    }

    // Minimal fallback with limited data
    const renderData: ReceiptRenderData = {
      hostel_name: receipt.hostel_name || "HMS Hostel",
      hostel_address: "",
      hostel_city: null,
      hostel_state: null,
      hostel_pincode: null,
      hostel_phone: null,
      hostel_gst: null,
      hostel_logo_url: null,

      receipt_number: receipt.receipt_number,
      issued_at: receipt.issued_at,

      tenant_name: receipt.tenant_name || "Tenant",
      tenant_phone: null,
      tenant_email: null,
      room_no: null,
      room_floor: null,

      amount: Number(receipt.amount),
      payment_method: receipt.payment_method,
      transaction_id: receipt.transaction_id,
      reference_number: null,
      payment_date: receipt.issued_at,

      rent_month: receipt.rent_month,
      due_date: null,
      obligation_amount: null,
      obligation_status: "PAID",

      prefs: {
        currency: context?.currency || "INR",
        timezone: context?.timezone || "Asia/Kolkata",
      },
      footer: context?.footer,
    };

    const html = renderReceiptHTML(renderData);
    return htmlToPdf(html);
  }
}

export const receiptService = new ReceiptService();
