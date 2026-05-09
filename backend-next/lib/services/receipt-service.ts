/**
 * 🧾 Receipt Service — Puppeteer-Based PDF Generation
 *
 * Responsibilities:
 * 1. Create receipt records (idempotent, race-safe sequence)
 * 2. Fetch all data needed for the receipt template
 * 3. Render HTML via receipt-template.ts
 * 4. Convert to PDF via Puppeteer headless browser
 *
 * PDF Cache:
 * Generated PDFs are stored in ImageKit and the URL is persisted on the
 * receipt row. Subsequent requests for the same payment return the cached
 * PDF without running Puppeteer. Template version bumps auto-invalidate.
 */

import { prisma } from "../db";
import crypto from "crypto";
import { resolvePreferences } from "../preferences";
import { getHostelOperationalContext } from "../hostel-context";
import { htmlToPdf } from "../pdf/browser";
import { renderReceiptHTML, type ReceiptRenderData } from "../pdf/receipt-template";
import { timed } from "../perf";
import { imagekit } from "../imagekit";
import { incrementPdfCache } from "../metrics";
import { acquireSystemLock, releaseSystemLock, sleep } from "../lock";

/**
 * Resolve the hostel record for a payment, using the canonical hostel_id
 * chain: payment.hostel_id → hostel (preferred)
 * Fallback: payment → obligation → allocation → room → hostel (for pre-backfill data)
 */
async function resolveHostelForPayment(payment: any): Promise<{ hostel: any; prefs: any }> {
  const ownerId = payment.tenant?.owner_id || payment.owner_id || "";

  // Canonical path: payment already has hostel_id (Phase 2 write-through)
  if (payment.hostel_id) {
    const hostel = await prisma.hostel.findUnique({
      where: { id: payment.hostel_id },
    });
    if (hostel) return { hostel, prefs: resolvePreferences(hostel) };
  }

  // Fallback: derive from obligation → allocation → room → hostel
  if (payment.obligation?.allocation_id) {
    const allocation = await prisma.roomAllocation.findUnique({
      where: { id: payment.obligation.allocation_id },
      include: { room: { include: { hostel: true } } },
    });
    if (allocation?.room?.hostel) {
      return { hostel: allocation.room.hostel, prefs: resolvePreferences(allocation.room.hostel) };
    }
  }

  // Last resort: owner's first hostel (single-hostel owners only)
  const hostel = await prisma.hostel.findFirst({
    where: { owner_id: ownerId, is_active: true },
    orderBy: { created_at: "asc" },
  });
  return { hostel, prefs: resolvePreferences(hostel) };
}

// ── Template version: bump when receipt HTML/CSS layout changes ──
// This triggers a one-time Puppeteer re-render for all existing receipts.
const RECEIPT_TEMPLATE_VERSION = 1;

const RECEIPT_NUMBER_RETRY_LIMIT = 10;
const PLAN_UPGRADE_REQUIRED_ERROR = "PLAN_UPGRADE_REQUIRED";

export class ReceiptService {
  private async canOwnerGenerateReceipts(ownerId: string): Promise<boolean> {
    if (!ownerId) return false;
    const subscription = await prisma.ownerSubscription.findUnique({
      where: { owner_id: ownerId },
      include: { plan: true },
    });
    return Boolean(subscription?.plan?.can_generate_receipts);
  }

  /**
   * Generate a sequential, race-safe receipt number scoped per hostel + year.
   * Format: PREFIX-YEAR-SEQUENCE (e.g., HMS-2026-00001)
   *
   * Avoids direct sequence SQL so environments without receipt_seq don't crash.
   */
  async generateReceiptNumber(ownerId: string, offset = 0, prefs?: any): Promise<string> {
    const resolvedPrefs = prefs || resolvePreferences(null);
    const year = new Date().getFullYear();
    const prefix = `${resolvedPrefs.receipt_prefix}-${year}-`;
    const yearStart = new Date(`${year}-01-01T00:00:00.000Z`);
    const yearEnd = new Date(`${year + 1}-01-01T00:00:00.000Z`);
    const existingCount = await prisma.receipt.count({
      where: {
        owner_id: ownerId,
        issued_at: { gte: yearStart, lt: yearEnd },
      },
    });
    const seq = existingCount + offset + 1;

    return `${prefix}${seq.toString().padStart(5, "0")}`;
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
    const canGenerateReceipts = await this.canOwnerGenerateReceipts(ownerId);
    if (!canGenerateReceipts) {
      throw new Error(`${PLAN_UPGRADE_REQUIRED_ERROR}: Upgrade to Growth plan to generate receipts`);
    }
    // Phase 2: resolve hostel from payment chain, not findFirst(owner_id)
    const { hostel, prefs } = await resolveHostelForPayment(payment);
    let receipt = null;

    for (let attempt = 0; attempt < RECEIPT_NUMBER_RETRY_LIMIT; attempt += 1) {
      const receiptNumber = await this.generateReceiptNumber(ownerId, attempt, prefs);
      try {
        receipt = await prisma.receipt.create({
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
            hostel_id: payment.hostel_id || hostel?.id || null, // Phase 2: immutable hostel context
          },
        });
        break;
      } catch (error: any) {
        if (error?.code === "P2002") {
          const target = Array.isArray(error?.meta?.target) ? error.meta.target.join(",") : String(error?.meta?.target || "");
          if (target.includes("payment_id")) {
            const duplicate = await prisma.receipt.findFirst({ where: { payment_id: paymentId } });
            if (duplicate) {
              receipt = duplicate;
              break;
            }
          }
          if (target.includes("receipt_number")) {
            continue;
          }
        }
        throw error;
      }
    }

    if (!receipt) {
      throw new Error("RECEIPT_CREATE_FAILED: Unable to generate unique receipt number");
    }

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
  async generatePdfBuffer(paymentId: string, options?: { autoCreate?: boolean }): Promise<Buffer> {
    const autoCreate = options?.autoCreate ?? true;

    // ── Single fetch path (was: findFirst → createReceipt() → findFirst again) ──
    // Attempt to load existing receipt with all needed relations in one query.
    let receipt = await prisma.receipt.findFirst({
      where: { payment_id: paymentId },
      include: {
        payment: { include: { obligation: true } },
        tenant: { include: { profile: true } },
      },
    });

    if (!receipt && autoCreate) {
      // Create record, then load with relations in a single subsequent fetch.
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
      throw new Error("NOT_FOUND: Receipt not found");
    }

    // ── PDF Cache check: reuse stored PDF if template version matches ─────────
    const cachedPdfUrl    = receipt.receipt_pdf_url;
    const cachedVersion   = receipt.receipt_template_version;

    if (cachedPdfUrl && cachedVersion === RECEIPT_TEMPLATE_VERSION) {
      incrementPdfCache("receipt_hit");
      // Fetch from CDN — avoids Puppeteer entirely
      const res = await fetch(cachedPdfUrl);
      if (res.ok) {
        const arrayBuf = await res.arrayBuffer();
        return Buffer.from(arrayBuf);
      }
      // CDN miss (deleted externally) — fall through to re-render
    }
    incrementPdfCache("receipt_miss");

    // 1.5 Concurrency Protection
    const lockKey = `pdf_receipt_${receipt.id}`;
    const acquired = await acquireSystemLock(lockKey, 30);
    
    if (!acquired) {
      incrementPdfCache("contention");
      // Another request is currently rendering this receipt.
      // Wait up to 3 seconds to see if they finish and cache it.
      for (let i = 0; i < 6; i++) {
        await sleep(500);
        const fresh = await prisma.receipt.findUnique({
          where: { id: receipt.id },
          select: { receipt_pdf_url: true, receipt_template_version: true },
        });
        if (fresh?.receipt_pdf_url && fresh.receipt_template_version === RECEIPT_TEMPLATE_VERSION) {
          incrementPdfCache("receipt_hit"); // Delayed hit
          const res = await fetch(fresh.receipt_pdf_url);
          if (res.ok) return Buffer.from(await res.arrayBuffer());
        }
      }
      // If we exit the loop, the other request timed out or failed upload.
      // Proceed to render it ourselves.
    }

    try {
      // 2. Fetch hostel + preferences + room allocation
      // Phase 2: resolve hostel from receipt's payment chain, not findFirst(owner_id)
      const ownerId = receipt.owner_id || receipt.tenant?.owner_id || "";
    let hostel: any = null;
    let prefs: any;

    // Canonical: receipt has hostel_id (Phase 2 write-through)
    if (receipt.hostel_id) {
      hostel = await prisma.hostel.findUnique({ where: { id: receipt.hostel_id } });
      prefs = resolvePreferences(hostel);
    }
    // Fallback: derive from payment chain
    if (!hostel && receipt.payment) {
      const resolved = await resolveHostelForPayment(receipt.payment);
      hostel = resolved.hostel;
      prefs = resolved.prefs;
    }
    if (!prefs) {
      prefs = resolvePreferences(hostel);
    }

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

    // 4. Render HTML → PDF via Puppeteer
    const html = renderReceiptHTML(renderData);
    const pdfBuffer = await timed(
      "pdf.render.puppeteer",
      () => htmlToPdf(html),
      { payment_id: paymentId, slow_ms: 3_000 }
    );

    // 5. Upload & cache the rendered PDF ──────────────────────────────────────
    // Best-effort: failure here does not break the response.
    try {
      const base64Pdf = pdfBuffer.toString("base64");
      const uploadRes = await timed(
        "pdf.receipt.upload",
        () => imagekit.files.upload({
          file: base64Pdf,
          fileName: `receipt_${receipt.receipt_number}.pdf`,
          folder: "/receipts",
          tags: ["receipt", receipt.id],
        }),
        { payment_id: paymentId, slow_ms: 5_000 }
      );
      if (uploadRes.url) {
        await prisma.receipt.update({
          where: { id: receipt.id },
          data: {
            receipt_pdf_url:          uploadRes.url,
            receipt_template_version: RECEIPT_TEMPLATE_VERSION,
          },
        });
      }
    } catch (uploadErr: any) {
      // Non-fatal: log and continue — client still receives the buffer
      console.warn("[ReceiptService] PDF upload failed (non-fatal):", uploadErr?.message);
    }
    
    return pdfBuffer;
  } finally {
    if (acquired) {
      await releaseSystemLock(lockKey);
    }
  }
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
