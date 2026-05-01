/**
 * 📄 Receipt HTML Template Renderer
 *
 * Generates a complete HTML document from receipt data using the
 * owner-provided premium receipt design. This HTML is then fed to
 * Puppeteer for pixel-perfect PDF generation.
 *
 * RULES:
 * - DO NOT modify the HTML structure or CSS
 * - Only inject dynamic values into placeholders
 * - All formatting uses the global format engine (lib/format.ts)
 */

import type { HostelPreferences } from "../preferences";
import { formatCurrency, formatShortDate, formatMonthYear, formatDateTime } from "../format";

// ─── Data Contract ────────────────────────────────────────────

export interface ReceiptRenderData {
  // Hostel
  hostel_name: string;
  hostel_address: string;
  hostel_city: string | null;
  hostel_state: string | null;
  hostel_pincode: string | null;
  hostel_phone: string | null;
  hostel_gst: string | null;
  hostel_logo_url: string | null;

  // Receipt
  receipt_number: string;
  issued_at: Date | string;

  // Tenant
  tenant_name: string;
  tenant_phone: string | null;
  tenant_email: string | null;
  room_no: string | null;
  room_floor: string | null;

  // Payment
  amount: number;
  payment_method: string;
  transaction_id: string | null;
  reference_number: string | null;
  payment_date: Date | string;

  // Obligation
  rent_month: Date | string | null;
  due_date: Date | string | null;
  obligation_amount: number | null;
  obligation_status: string | null;

  // Preferences (for formatting)
  prefs: Partial<HostelPreferences>;

  // Optional: custom footer
  footer?: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────

function esc(val: string | null | undefined): string {
  if (!val) return "";
  return val
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatAmount(amount: number, prefs: Partial<HostelPreferences>): string {
  // For display like "₹ 8,500.00"
  const symbol = getCurrencySymbolRaw(prefs.currency);
  const formatted = new Intl.NumberFormat(getLocale(prefs.currency), {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
  return `${symbol} ${formatted}`;
}

function formatAmountShort(amount: number, prefs: Partial<HostelPreferences>): string {
  // For display like "₹ 8,500"
  const symbol = getCurrencySymbolRaw(prefs.currency);
  const formatted = new Intl.NumberFormat(getLocale(prefs.currency), {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
  return `${symbol} ${formatted}`;
}

function getCurrencySymbolRaw(currency?: string): string {
  const map: Record<string, string> = { INR: "₹", USD: "$", EUR: "€", GBP: "£" };
  return map[currency || "INR"] || "₹";
}

function getLocale(currency?: string): string {
  const map: Record<string, string> = { INR: "en-IN", USD: "en-US", EUR: "de-DE", GBP: "en-GB" };
  return map[currency || "INR"] || "en-IN";
}

function buildAddressLine(city?: string | null, state?: string | null, pincode?: string | null): string {
  const parts = [city, state].filter(Boolean).join(", ");
  if (pincode) return parts ? `${parts} — ${pincode}` : pincode;
  return parts;
}

function getLogoBlock(data: ReceiptRenderData): string {
  if (data.hostel_logo_url) {
    return `<img class="logo-img" src="${esc(data.hostel_logo_url)}" alt="${esc(data.hostel_name)}" />`;
  }
  const initial = (data.hostel_name || "H").charAt(0).toUpperCase();
  return `<span class="logo-fallback">${initial}</span>`;
}

// ─── Main Renderer ────────────────────────────────────────────

export function renderReceiptHTML(data: ReceiptRenderData): string {
  const p = data.prefs;
  const issueDate = formatShortDate(data.issued_at, p);
  const rentPeriod = formatMonthYear(data.rent_month, p);
  const dueDate = data.due_date ? formatShortDate(data.due_date, p) : "N/A";
  const paymentDate = formatShortDate(data.payment_date, p);
  const fullAddress = buildAddressLine(data.hostel_city, data.hostel_state, data.hostel_pincode);
  const headerAddress = `${esc(data.hostel_address)}${fullAddress ? `, ${esc(fullAddress)}` : ""}`;
  const shortAddress = buildAddressLine(data.hostel_city, data.hostel_state, data.hostel_pincode);
  const isPaid = data.obligation_status === "PAID";
  const oblAmount = data.obligation_amount || data.amount;

  const roomLine = [
    data.room_no ? `Room ${esc(data.room_no)}` : null,
    data.room_floor ? `Floor ${esc(data.room_floor)}` : null,
  ].filter(Boolean).join(" · ");

  const footerNote = data.footer ||
    "This is a computer-generated receipt and does not require a physical signature. For any payment queries, please contact the hostel management directly.";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Payment Receipt — ${esc(data.receipt_number)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=DM+Mono:wght@400;500&family=Inter:wght@400;500&display=swap" rel="stylesheet" />

  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --gold:         #C9A84C;
      --gold-dim:     rgba(201, 168, 76, 0.55);
      --gold-faint:   rgba(201, 168, 76, 0.40);
      --charcoal:     #1A1918;
      --charcoal-mid: #242220;
      --cream:        #F2EDE4;
      --cream-dim:    rgba(242, 237, 228, 0.48);
      --cream-faint:  rgba(242, 237, 228, 0.35);
      --body-bg:      #F4F1EC;
      --paper:        #FFFFFF;
      --border:       rgba(0, 0, 0, 0.10);
      --muted-strip:  #F8F6F1;
      --text-primary: #1A1918;
      --text-muted:   #6B6560;
      --text-light:   #9C9690;
      --green:        #2E8B57;
      --green-border: #3AAD6A;
      --font-serif:   'Playfair Display', Georgia, serif;
      --font-mono:    'DM Mono', 'Courier New', monospace;
      --font-sans:    'Inter', system-ui, sans-serif;
      --radius-sm:    4px;
      --radius-md:    8px;
      --radius-lg:    12px;
    }
    body {
      font-family: var(--font-sans);
      background: #fff;
      margin: 0;
      padding: 0;
      color: var(--text-primary);
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .paper {
      width: 100%;
      background: var(--paper);
      overflow: hidden;
    }
    .header {
      background: var(--charcoal);
      padding: 28px 36px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .header-left { display: flex; align-items: center; gap: 18px; }
    .logo-box {
      width: 54px; height: 54px;
      border: 1.5px solid var(--gold-dim);
      border-radius: var(--radius-md);
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
    }
    .logo-img { width: 100%; height: 100%; object-fit: contain; border-radius: var(--radius-md); }
    .logo-fallback {
      font-family: var(--font-serif);
      font-size: 22px;
      color: var(--gold);
      font-weight: 700;
      line-height: 1;
    }
    .hostel-name {
      font-family: var(--font-serif);
      font-size: 18px;
      font-weight: 700;
      color: var(--cream);
      letter-spacing: 0.02em;
    }
    .hostel-addr {
      font-size: 11px;
      color: var(--cream-dim);
      margin-top: 3px;
      letter-spacing: 0.04em;
    }
    .header-right { text-align: right; }
    .receipt-title {
      font-family: var(--font-serif);
      font-size: 22px;
      color: var(--gold);
      letter-spacing: 0.1em;
      font-weight: 400;
    }
    .receipt-number {
      font-family: var(--font-mono);
      font-size: 11px;
      color: var(--cream-faint);
      margin-top: 5px;
      letter-spacing: 0.1em;
    }
    .gold-bar { height: 2px; background: var(--gold); opacity: 0.65; }
    .meta-strip {
      background: var(--muted-strip);
      padding: 14px 36px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid var(--border);
    }
    .meta-item { display: flex; flex-direction: column; }
    .meta-item.center { align-items: center; }
    .meta-item.right  { align-items: flex-end; }
    .meta-lbl {
      font-size: 9.5px;
      color: var(--text-light);
      text-transform: uppercase;
      letter-spacing: 0.12em;
      font-weight: 500;
    }
    .meta-val {
      font-family: var(--font-mono);
      font-size: 12px;
      color: var(--text-primary);
      margin-top: 3px;
      font-weight: 500;
    }
    .body { padding: 30px 36px; }
    .parties {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
      margin-bottom: 28px;
    }
    .party-lbl {
      font-size: 9.5px;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: var(--text-light);
      margin-bottom: 8px;
      font-weight: 500;
    }
    .party-name {
      font-size: 14px;
      font-weight: 600;
      color: var(--text-primary);
      margin-bottom: 5px;
    }
    .party-detail {
      font-size: 12px;
      color: var(--text-muted);
      line-height: 1.7;
    }
    .party-to {
      border-left: 2px solid var(--gold);
      padding-left: 20px;
    }
    .divider {
      height: 1px;
      background: var(--border);
      margin-bottom: 22px;
    }
    .items-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
      margin-bottom: 26px;
    }
    .items-table thead tr { background: var(--charcoal); }
    .items-table thead th {
      padding: 10px 14px;
      color: var(--gold);
      font-size: 9.5px;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      font-weight: 500;
    }
    .items-table thead th:first-child { text-align: left; border-radius: var(--radius-sm) 0 0 var(--radius-sm); }
    .items-table thead th:last-child  { text-align: right;  border-radius: 0 var(--radius-sm) var(--radius-sm) 0; }
    .items-table thead th.tc { text-align: center; }
    .items-table tbody td {
      padding: 14px 14px;
      border-bottom: 1px solid var(--border);
    }
    .items-table tbody td.desc  { color: var(--text-primary); font-weight: 500; }
    .items-table tbody td.mono  { font-family: var(--font-mono); font-size: 12px; color: var(--text-muted); text-align: center; }
    .items-table tbody td.amt   { font-family: var(--font-mono); font-weight: 500; color: var(--text-primary); text-align: right; }
    .bottom-row {
      display: flex;
      align-items: stretch;
      justify-content: space-between;
      gap: 24px;
      margin-bottom: 28px;
    }
    .pmt-info { flex: 1; }
    .pmt-lbl {
      font-size: 9.5px;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: var(--text-light);
      margin-bottom: 12px;
      font-weight: 500;
    }
    .pmt-grid {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 8px 20px;
      font-size: 12px;
    }
    .pmt-key { color: var(--text-muted); }
    .pmt-val { color: var(--text-primary); font-weight: 500; }
    .pmt-val.mono { font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.03em; }
    .amount-box {
      background: var(--charcoal);
      border-radius: var(--radius-md);
      padding: 24px 32px;
      text-align: center;
      min-width: 200px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }
    .total-lbl {
      font-size: 9.5px;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: var(--gold-faint);
      margin-bottom: 8px;
    }
    .total-amt {
      font-family: var(--font-serif);
      font-size: 32px;
      color: var(--cream);
      font-weight: 700;
      letter-spacing: -0.01em;
      line-height: 1;
    }
    .paid-stamp {
      margin-top: 14px;
      padding: 5px 20px;
      border: 1.5px solid var(--green-border);
      border-radius: var(--radius-sm);
    }
    .paid-text {
      font-family: var(--font-mono);
      font-size: 11px;
      color: var(--green);
      letter-spacing: 0.2em;
      font-weight: 500;
    }
    .note {
      font-size: 11px;
      color: var(--text-light);
      line-height: 1.8;
      font-style: italic;
    }
    .footer {
      background: var(--charcoal);
      padding: 14px 36px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .footer-left  { font-size: 11px; color: var(--cream-faint); letter-spacing: 0.04em; }
    .footer-right { font-family: var(--font-mono); font-size: 10px; color: var(--gold-faint); letter-spacing: 0.08em; }
    @media print {
      @page { size: A4; margin: 0; }
      body { background: #fff; padding: 0; }
    }
  </style>
</head>
<body>
  <div class="paper">

    <div class="header">
      <div class="header-left">
        <div class="logo-box">
          ${getLogoBlock(data)}
        </div>
        <div>
          <p class="hostel-name">${esc(data.hostel_name)}</p>
          <p class="hostel-addr">${headerAddress}</p>
        </div>
      </div>
      <div class="header-right">
        <p class="receipt-title">RECEIPT</p>
        <p class="receipt-number">${esc(data.receipt_number)}</p>
      </div>
    </div>

    <div class="gold-bar"></div>

    <div class="meta-strip">
      <div class="meta-item">
        <span class="meta-lbl">Issue Date</span>
        <span class="meta-val">${issueDate}</span>
      </div>
      <div class="meta-item center">
        <span class="meta-lbl">Rent Period</span>
        <span class="meta-val">${rentPeriod}</span>
      </div>
      <div class="meta-item right">
        <span class="meta-lbl">${data.hostel_gst ? "GST Number" : "Receipt ID"}</span>
        <span class="meta-val">${data.hostel_gst ? esc(data.hostel_gst) : esc(data.receipt_number)}</span>
      </div>
    </div>

    <div class="body">
      <div class="parties">
        <div>
          <p class="party-lbl">From</p>
          <p class="party-name">${esc(data.hostel_name)}</p>
          <p class="party-detail">
            ${esc(data.hostel_address)}${data.hostel_city ? `<br>${esc(data.hostel_city)}` : ""}${shortAddress && !data.hostel_city ? `<br>${esc(shortAddress)}` : ""}${data.hostel_state ? `, ${esc(data.hostel_state)}` : ""}${data.hostel_pincode ? ` — ${esc(data.hostel_pincode)}` : ""}${data.hostel_phone ? `<br>${esc(data.hostel_phone)}` : ""}
          </p>
        </div>
        <div class="party-to">
          <p class="party-lbl">Bill To</p>
          <p class="party-name">${esc(data.tenant_name)}</p>
          <p class="party-detail">
            ${roomLine ? `${roomLine}<br>` : ""}${data.tenant_phone ? `${esc(data.tenant_phone)}<br>` : ""}${data.tenant_email ? esc(data.tenant_email) : ""}
          </p>
        </div>
      </div>

      <div class="divider"></div>

      <table class="items-table">
        <thead>
          <tr>
            <th>Description</th>
            <th class="tc">Period</th>
            <th class="tc">Due Date</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td class="desc">Monthly Rent${data.room_no ? ` — Room ${esc(data.room_no)}` : ""}</td>
            <td class="mono">${rentPeriod}</td>
            <td class="mono">${dueDate}</td>
            <td class="amt">${formatAmount(oblAmount, p)}</td>
          </tr>
        </tbody>
      </table>

      <div class="bottom-row">
        <div class="pmt-info">
          <p class="pmt-lbl">Payment Details</p>
          <div class="pmt-grid">
            <span class="pmt-key">Method</span>
            <span class="pmt-val">${esc((data.payment_method || "N/A").toUpperCase())}</span>

            ${data.transaction_id ? `
            <span class="pmt-key">Transaction ID</span>
            <span class="pmt-val mono">${esc(data.transaction_id)}</span>
            ` : ""}

            <span class="pmt-key">Payment Date</span>
            <span class="pmt-val">${paymentDate}</span>

            ${data.reference_number ? `
            <span class="pmt-key">Reference No.</span>
            <span class="pmt-val mono">${esc(data.reference_number)}</span>
            ` : ""}
          </div>
        </div>

        <div class="amount-box">
          <p class="total-lbl">Total Paid</p>
          <p class="total-amt">${formatAmountShort(data.amount, p)}</p>
          ${isPaid ? `
          <div class="paid-stamp">
            <span class="paid-text">PAID</span>
          </div>
          ` : ""}
        </div>
      </div>

      <div class="divider"></div>

      <p class="note">${esc(footerNote)}</p>
    </div>

    <div class="footer">
      <p class="footer-left">Thank you for your timely payment.</p>
      <p class="footer-right">HMS · Hostel Management System</p>
    </div>

  </div>
</body>
</html>`;
}
