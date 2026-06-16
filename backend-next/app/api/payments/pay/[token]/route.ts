export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { paymentService } from "@/src/services/payments/payment-service";
import { getLogger } from "@/lib/logger";

const logger = getLogger("api.payments.pay");

/**
 * Format a date as "June 2026" style
 */
function formatMonth(date: Date | string | null): string {
  if (!date) return "N/A";
  const d = new Date(date);
  return d.toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "Asia/Kolkata" });
}

/**
 * Format currency as ₹X,XXX
 */
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount);
}

/**
 * Render a self-contained HTML payment summary page.
 * Mobile-optimized, no JS framework needed.
 */
function renderPage(content: {
  title: string;
  hostelName: string;
  tenantName: string;
  status: "DUE" | "PAID" | "EXPIRED" | "ERROR";
  dueMonth?: string;
  amount?: number;
  supportPhone?: string;
  token?: string;
  errorMessage?: string;
}): string {
  const { title, hostelName, tenantName, status, dueMonth, amount, supportPhone, token, errorMessage } = content;

  const statusBlock = (() => {
    switch (status) {
      case "DUE":
        return `
          <div class="amount-card">
            <p class="label">Amount Due</p>
            <p class="amount">${formatCurrency(amount || 0)}</p>
            <p class="due-month">${dueMonth || ""}</p>
          </div>
          <form method="POST" action="/api/payments/pay/${token}">
            <button type="submit" class="pay-btn">Pay Now</button>
          </form>
        `;
      case "PAID":
        return `
          <div class="status-card paid">
            <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="#16a34a" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M8 12l2.5 2.5L16 9"/></svg>
            <p class="status-text">Payment already completed</p>
            <p class="status-sub">This obligation has been settled. No action needed.</p>
          </div>
        `;
      case "EXPIRED":
        return `
          <div class="status-card expired">
            <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="#dc2626" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 7v5l3 3"/></svg>
            <p class="status-text">Payment link expired</p>
            <p class="status-sub">Please contact your hostel for a new payment link.</p>
          </div>
        `;
      case "ERROR":
        return `
          <div class="status-card error">
            <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="#dc2626" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/></svg>
            <p class="status-text">${errorMessage || "Something went wrong"}</p>
            <p class="status-sub">Please contact your hostel for assistance.</p>
          </div>
        `;
    }
  })();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <meta name="description" content="Payment for ${hostelName}">
  <meta name="robots" content="noindex, nofollow">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
      color: #e2e8f0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
    }
    .container {
      max-width: 420px;
      width: 100%;
      background: rgba(30, 41, 59, 0.8);
      backdrop-filter: blur(12px);
      border: 1px solid rgba(148, 163, 184, 0.15);
      border-radius: 20px;
      padding: 32px 24px;
      text-align: center;
    }
    .hostel-name {
      font-size: 13px;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      color: #94a3b8;
      margin-bottom: 4px;
    }
    .tenant-name {
      font-size: 22px;
      font-weight: 700;
      color: #f1f5f9;
      margin-bottom: 24px;
    }
    .amount-card {
      background: rgba(59, 130, 246, 0.1);
      border: 1px solid rgba(59, 130, 246, 0.25);
      border-radius: 14px;
      padding: 24px 16px;
      margin-bottom: 24px;
    }
    .amount-card .label {
      font-size: 13px;
      color: #94a3b8;
      margin-bottom: 8px;
    }
    .amount-card .amount {
      font-size: 36px;
      font-weight: 800;
      color: #f1f5f9;
      letter-spacing: -1px;
    }
    .amount-card .due-month {
      font-size: 14px;
      color: #64748b;
      margin-top: 6px;
    }
    .pay-btn {
      display: block;
      width: 100%;
      padding: 16px;
      font-size: 17px;
      font-weight: 700;
      color: #fff;
      background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
      border: none;
      border-radius: 12px;
      cursor: pointer;
      transition: transform 0.1s, box-shadow 0.2s;
      box-shadow: 0 4px 14px rgba(37, 99, 235, 0.4);
    }
    .pay-btn:hover { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(37, 99, 235, 0.5); }
    .pay-btn:active { transform: translateY(0); }
    .status-card {
      padding: 32px 16px;
      border-radius: 14px;
      margin-bottom: 8px;
    }
    .status-card.paid { background: rgba(22, 163, 106, 0.1); border: 1px solid rgba(22, 163, 106, 0.25); }
    .status-card.expired { background: rgba(220, 38, 38, 0.1); border: 1px solid rgba(220, 38, 38, 0.25); }
    .status-card.error { background: rgba(220, 38, 38, 0.1); border: 1px solid rgba(220, 38, 38, 0.25); }
    .status-card svg { margin-bottom: 16px; }
    .status-text { font-size: 18px; font-weight: 600; color: #f1f5f9; margin-bottom: 8px; }
    .status-sub { font-size: 14px; color: #94a3b8; }
    .support {
      margin-top: 24px;
      font-size: 12px;
      color: #64748b;
    }
    .support a { color: #3b82f6; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <p class="hostel-name">${hostelName}</p>
    <p class="tenant-name">${tenantName}</p>
    ${statusBlock}
    ${supportPhone ? `<p class="support">Need help? Call <a href="tel:${supportPhone}">${supportPhone}</a></p>` : ""}
  </div>
</body>
</html>`;
}

/**
 * GET /api/payments/pay/[token]
 *
 * Public endpoint. Renders a payment summary page.
 * No authentication required — access is gated by the cryptographic token.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  try {
    // 1. Token lookup
    const linkToken = await prisma.payment_link_tokens.findUnique({
      where: { token },
      include: {
        rent_obligations: {
          include: {
            payments: { select: { amount_paid: true } },
          },
        },
        tenants: {
          include: { profiles: { select: { name: true } } },
        },
        hostels: {
          select: { name: true, phone: true },
        },
      },
    });

    if (!linkToken) {
      return new NextResponse(
        renderPage({
          title: "Payment Not Found",
          hostelName: "Sri Adithya Boys Hostel",
          tenantName: "",
          status: "ERROR",
          errorMessage: "This payment link is not valid.",
        }),
        { status: 404, headers: { "Content-Type": "text/html; charset=utf-8" } }
      );
    }

    const hostelName = linkToken.hostels.name || "Sri Adithya Boys Hostel";
    const tenantName = linkToken.tenants.profiles?.name || "Tenant";
    const supportPhone = linkToken.hostels.phone || "";

    // 2. Expiry check
    if (linkToken.expires_at < new Date()) {
      return new NextResponse(
        renderPage({
          title: "Link Expired",
          hostelName,
          tenantName,
          status: "EXPIRED",
          supportPhone,
        }),
        { status: 410, headers: { "Content-Type": "text/html; charset=utf-8" } }
      );
    }

    // 3. Obligation status check
    const obligation = linkToken.rent_obligations;
    if (obligation.status === "PAID") {
      return new NextResponse(
        renderPage({
          title: "Payment Complete",
          hostelName,
          tenantName,
          status: "PAID",
          supportPhone,
        }),
        { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }
      );
    }

    // 4. Calculate outstanding amount
    const paidAmount = obligation.payments.reduce(
      (sum: number, p: any) => sum + Number(p.amount_paid),
      0
    );
    const totalDue = Number(obligation.amount);
    const outstanding = Math.max(0, totalDue - paidAmount);

    if (outstanding <= 0) {
      return new NextResponse(
        renderPage({
          title: "Payment Complete",
          hostelName,
          tenantName,
          status: "PAID",
          supportPhone,
        }),
        { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }
      );
    }

    // 5. Render summary page with Pay Now button
    return new NextResponse(
      renderPage({
        title: `Pay ${formatCurrency(outstanding)} — ${hostelName}`,
        hostelName,
        tenantName,
        status: "DUE",
        dueMonth: formatMonth(obligation.rent_month),
        amount: outstanding,
        supportPhone,
        token,
      }),
      { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  } catch (error: any) {
    logger.error("payment_link.get.failed", { token, error: String(error?.message || error) });
    return new NextResponse(
      renderPage({
        title: "Error",
        hostelName: "Sri Adithya Boys Hostel",
        tenantName: "",
        status: "ERROR",
        errorMessage: "Something went wrong. Please try again.",
      }),
      { status: 500, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }
}

/**
 * POST /api/payments/pay/[token]
 *
 * Creates or reuses a payment attempt, then redirects to Razorpay checkout.
 * No authentication required — access is gated by the cryptographic token.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  try {
    // 1. Re-validate token
    const linkToken = await prisma.payment_link_tokens.findUnique({
      where: { token },
      include: {
        rent_obligations: true,
        hostels: { select: { name: true, phone: true } },
        tenants: { include: { profiles: { select: { name: true } } } },
      },
    });

    if (!linkToken) {
      return new NextResponse(
        renderPage({
          title: "Payment Not Found",
          hostelName: "Sri Adithya Boys Hostel",
          tenantName: "",
          status: "ERROR",
          errorMessage: "This payment link is not valid.",
        }),
        { status: 404, headers: { "Content-Type": "text/html; charset=utf-8" } }
      );
    }

    const hostelName = linkToken.hostels.name || "Sri Adithya Boys Hostel";
    const tenantName = linkToken.tenants.profiles?.name || "Tenant";
    const supportPhone = linkToken.hostels.phone || "";

    // 2. Expiry check
    if (linkToken.expires_at < new Date()) {
      return new NextResponse(
        renderPage({
          title: "Link Expired",
          hostelName,
          tenantName,
          status: "EXPIRED",
          supportPhone,
        }),
        { status: 410, headers: { "Content-Type": "text/html; charset=utf-8" } }
      );
    }

    // 3. Obligation status check
    if (linkToken.rent_obligations.status === "PAID") {
      return new NextResponse(
        renderPage({
          title: "Payment Complete",
          hostelName,
          tenantName,
          status: "PAID",
          supportPhone,
        }),
        { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }
      );
    }

    // 4. Create or reuse payment attempt (built-in dedup)
    logger.info("payment_link.checkout.initiate", {
      token,
      obligation_id: linkToken.obligation_id,
      tenant_id: linkToken.tenant_id,
      hostel_id: linkToken.hostel_id,
    });

    const rawAttempt = await paymentService.createMultiObligationPaymentIntent(
      [linkToken.obligation_id],
      linkToken.owner_id,
      linkToken.tenant_id,
      { bypassCollectionPolicy: true, source: "PAYMENT_LINK" }
    );

    const attempt = (rawAttempt as any).isReused === true
      ? (rawAttempt as any).attempt
      : rawAttempt;

    const checkoutUrl = attempt.checkout_url;

    if (!checkoutUrl) {
      logger.error("payment_link.checkout.no_url", {
        token,
        attempt_id: attempt.id,
        status: attempt.status,
      });
      return new NextResponse(
        renderPage({
          title: "Checkout Unavailable",
          hostelName,
          tenantName,
          status: "ERROR",
          errorMessage: "Payment checkout is temporarily unavailable. Please try again.",
          supportPhone,
        }),
        { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } }
      );
    }

    // 5. Redirect to Razorpay checkout
    logger.info("payment_link.checkout.redirect", {
      token,
      attempt_id: attempt.id,
      checkout_url: checkoutUrl,
    });

    return NextResponse.redirect(checkoutUrl, 302);
  } catch (error: any) {
    logger.error("payment_link.post.failed", { token, error: String(error?.message || error) });

    return new NextResponse(
      renderPage({
        title: "Payment Error",
        hostelName: "Sri Adithya Boys Hostel",
        tenantName: "",
        status: "ERROR",
        errorMessage: "Could not initiate payment. Please try again later.",
      }),
      { status: 500, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }
}
