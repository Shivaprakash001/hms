import { PDFDocument, rgb, StandardFonts, PDFPage } from "pdf-lib";
import type { HostelPreferences } from "../preferences";
import { formatCurrency, formatShortDate, formatMonthYear } from "../format";

export interface ReceiptRenderData {
  hostel_name: string;
  hostel_address: string;
  hostel_city: string | null;
  hostel_state: string | null;
  hostel_pincode: string | null;
  hostel_phone: string | null;
  hostel_gst: string | null;
  hostel_logo_url: string | null;

  receipt_number: string;
  issued_at: Date | string;

  tenant_name: string;
  tenant_phone: string | null;
  tenant_email: string | null;
  room_no: string | null;
  room_floor: string | null;

  amount: number;
  payment_method: string;
  transaction_id: string | null;
  reference_number: string | null;
  payment_date: Date | string;

  rent_month: Date | string | null;
  due_date: Date | string | null;
  obligation_amount: number | null;
  obligation_status: string | null;

  prefs: Partial<HostelPreferences>;
  footer?: string | null;
}

const COLORS = {
  charcoal: rgb(26 / 255, 25 / 255, 24 / 255),
  gold: rgb(201 / 255, 168 / 255, 76 / 255),
  cream: rgb(242 / 255, 237 / 255, 228 / 255),
  creamDim: rgb(242 / 255, 237 / 255, 228 / 255), // simplified opacity
  mutedStrip: rgb(248 / 255, 246 / 255, 241 / 255),
  textPrimary: rgb(26 / 255, 25 / 255, 24 / 255),
  textMuted: rgb(107 / 255, 101 / 255, 96 / 255),
  textLight: rgb(156 / 255, 150 / 255, 144 / 255),
  border: rgb(230 / 255, 230 / 255, 230 / 255),
  green: rgb(46 / 255, 139 / 255, 87 / 255),
  white: rgb(1, 1, 1),
};

// pdf-lib StandardFonts use WinAnsi encoding. We must strip/replace unmappable characters.
function sanitizeText(str: string | null | undefined): string {
  if (!str) return "";
  let s = str.replace(/₹/g, "Rs. ");
  // Strip characters outside WinAnsi (roughly ASCII + some Latin1)
  // WinAnsi supports 0-255 but some characters like smart quotes or emojis are outside.
  s = s.replace(/[^\x00-\xFF]/g, ""); 
  return s;
}

function buildAddressLine(city?: string | null, state?: string | null, pincode?: string | null): string {
  const parts = [city, state].filter(Boolean).join(", ");
  if (pincode) return parts ? `${parts} — ${pincode}` : pincode;
  return parts;
}

export async function generateReceiptPdf(data: ReceiptRenderData): Promise<Uint8Array> {
  const p = data.prefs;
  const issueDate = formatShortDate(data.issued_at, p);
  const rentPeriod = formatMonthYear(data.rent_month, p);
  const dueDate = data.due_date ? formatShortDate(data.due_date, p) : "N/A";
  const paymentDate = formatShortDate(data.payment_date, p);
  const fullAddress = buildAddressLine(data.hostel_city, data.hostel_state, data.hostel_pincode);
  const headerAddress = `${data.hostel_address}${fullAddress ? `, ${fullAddress}` : ""}`;
  const shortAddress = buildAddressLine(data.hostel_city, data.hostel_state, data.hostel_pincode);
  const isPaid = data.obligation_status === "PAID";
  const oblAmount = data.obligation_amount || data.amount;

  const roomLine = [
    data.room_no ? `Room ${data.room_no}` : null,
    data.room_floor ? `Floor ${data.room_floor}` : null,
  ].filter(Boolean).join(" · ");

  const footerNote = data.footer || "This is a computer-generated receipt and does not require a physical signature. For any payment queries, please contact the hostel management directly.";

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]); // A4
  const { width, height } = page.getSize();

  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  let currentY = height;

  // --- HEADER ---
  const headerHeight = 110;
  currentY -= headerHeight;
  page.drawRectangle({
    x: 0,
    y: currentY,
    width: width,
    height: headerHeight,
    color: COLORS.charcoal,
  });

  // Logo (Placeholder if no url handling yet, we just draw initials)
  page.drawRectangle({
    x: 36,
    y: currentY + 28,
    width: 54,
    height: 54,
    borderColor: COLORS.gold,
    borderWidth: 1.5,
    color: COLORS.charcoal,
  });
  const hostelNameObj = sanitizeText(data.hostel_name || "HMS Hostel");
  page.drawText(hostelNameObj.charAt(0).toUpperCase() || "H", {
    x: 36 + 18,
    y: currentY + 44,
    size: 24,
    font: fontBold,
    color: COLORS.gold,
  });

  page.drawText(hostelNameObj, {
    x: 110,
    y: currentY + 65,
    size: 18,
    font: fontBold,
    color: COLORS.cream,
  });
  
  // limit header address length to avoid overflow
  const safeHeaderAddress = sanitizeText(headerAddress);
  page.drawText(safeHeaderAddress.slice(0, 60), {
    x: 110,
    y: currentY + 45,
    size: 10,
    font: fontRegular,
    color: COLORS.creamDim,
  });

  page.drawText("RECEIPT", {
    x: width - 36 - 90,
    y: currentY + 65,
    size: 20,
    font: fontRegular,
    color: COLORS.gold,
  });
  const safeReceiptNum = sanitizeText(data.receipt_number);
  page.drawText(safeReceiptNum, {
    x: width - 36 - fontRegular.widthOfTextAtSize(safeReceiptNum, 10),
    y: currentY + 45,
    size: 10,
    font: fontRegular,
    color: COLORS.creamDim,
  });

  // --- GOLD BAR ---
  currentY -= 2;
  page.drawRectangle({
    x: 0,
    y: currentY,
    width: width,
    height: 2,
    color: COLORS.gold,
  });

  // --- META STRIP ---
  const metaHeight = 50;
  currentY -= metaHeight;
  page.drawRectangle({
    x: 0,
    y: currentY,
    width: width,
    height: metaHeight,
    color: COLORS.mutedStrip,
  });
  
  // Meta Items
  const metaY = currentY + 25;
  const valY = currentY + 10;
  
  const safeIssueDate = sanitizeText(issueDate);
  page.drawText("ISSUE DATE", { x: 36, y: metaY, size: 9, font: fontBold, color: COLORS.textLight });
  page.drawText(safeIssueDate, { x: 36, y: valY, size: 11, font: fontRegular, color: COLORS.textPrimary });

  const safeRentPeriod = sanitizeText(rentPeriod);
  page.drawText("RENT PERIOD", { x: width / 2 - 30, y: metaY, size: 9, font: fontBold, color: COLORS.textLight });
  page.drawText(safeRentPeriod, { x: width / 2 - 30, y: valY, size: 11, font: fontRegular, color: COLORS.textPrimary });

  const rightLabel = data.hostel_gst ? "GST NUMBER" : "RECEIPT ID";
  const rightVal = sanitizeText(data.hostel_gst ? data.hostel_gst : data.receipt_number);
  page.drawText(rightLabel, { x: width - 36 - fontBold.widthOfTextAtSize(rightLabel, 9), y: metaY, size: 9, font: fontBold, color: COLORS.textLight });
  page.drawText(rightVal, { x: width - 36 - fontRegular.widthOfTextAtSize(rightVal, 11), y: valY, size: 11, font: fontRegular, color: COLORS.textPrimary });

  page.drawLine({
    start: { x: 0, y: currentY },
    end: { x: width, y: currentY },
    thickness: 1,
    color: COLORS.border,
  });

  // --- BODY ---
  currentY -= 40;
  const partyY = currentY;

  // From
  page.drawText("FROM", { x: 36, y: partyY, size: 9, font: fontBold, color: COLORS.textLight });
  page.drawText(hostelNameObj, { x: 36, y: partyY - 18, size: 12, font: fontBold, color: COLORS.textPrimary });
  
  let addrY = partyY - 35;
  page.drawText(sanitizeText(data.hostel_address).slice(0, 40), { x: 36, y: addrY, size: 10, font: fontRegular, color: COLORS.textMuted }); addrY -= 14;
  if (data.hostel_city) { page.drawText(sanitizeText(data.hostel_city), { x: 36, y: addrY, size: 10, font: fontRegular, color: COLORS.textMuted }); addrY -= 14; }
  else if (shortAddress) { page.drawText(sanitizeText(shortAddress), { x: 36, y: addrY, size: 10, font: fontRegular, color: COLORS.textMuted }); addrY -= 14; }
  if (data.hostel_state) { page.drawText(sanitizeText(`${data.hostel_state}${data.hostel_pincode ? ` - ${data.hostel_pincode}` : ''}`), { x: 36, y: addrY, size: 10, font: fontRegular, color: COLORS.textMuted }); addrY -= 14; }
  if (data.hostel_phone) { page.drawText(sanitizeText(data.hostel_phone), { x: 36, y: addrY, size: 10, font: fontRegular, color: COLORS.textMuted }); }

  // Bill To
  const toX = width / 2 + 20;
  page.drawLine({ start: { x: toX - 15, y: partyY + 5 }, end: { x: toX - 15, y: partyY - 80 }, thickness: 2, color: COLORS.gold });
  
  const tenantNameObj = sanitizeText(data.tenant_name);
  page.drawText("BILL TO", { x: toX, y: partyY, size: 9, font: fontBold, color: COLORS.textLight });
  page.drawText(tenantNameObj, { x: toX, y: partyY - 18, size: 12, font: fontBold, color: COLORS.textPrimary });
  
  let tenantY = partyY - 35;
  if (roomLine) { page.drawText(sanitizeText(roomLine), { x: toX, y: tenantY, size: 10, font: fontRegular, color: COLORS.textMuted }); tenantY -= 14; }
  if (data.tenant_phone) { page.drawText(sanitizeText(data.tenant_phone), { x: toX, y: tenantY, size: 10, font: fontRegular, color: COLORS.textMuted }); tenantY -= 14; }
  if (data.tenant_email) { page.drawText(sanitizeText(data.tenant_email), { x: toX, y: tenantY, size: 10, font: fontRegular, color: COLORS.textMuted }); }

  currentY -= 120;
  page.drawLine({ start: { x: 36, y: currentY }, end: { x: width - 36, y: currentY }, thickness: 1, color: COLORS.border });

  // --- ITEMS TABLE ---
  currentY -= 40;
  page.drawRectangle({
    x: 36, y: currentY, width: width - 72, height: 30, color: COLORS.charcoal
  });
  
  page.drawText("DESCRIPTION", { x: 50, y: currentY + 10, size: 9, font: fontBold, color: COLORS.gold });
  page.drawText("PERIOD", { x: width / 2 - 20, y: currentY + 10, size: 9, font: fontBold, color: COLORS.gold });
  page.drawText("DUE DATE", { x: width / 2 + 80, y: currentY + 10, size: 9, font: fontBold, color: COLORS.gold });
  page.drawText("AMOUNT", { x: width - 50 - fontBold.widthOfTextAtSize("AMOUNT", 9), y: currentY + 10, size: 9, font: fontBold, color: COLORS.gold });

  currentY -= 30;
  const desc = sanitizeText(`Monthly Rent${data.room_no ? ` - Room ${data.room_no}` : ""}`);
  page.drawText(desc, { x: 50, y: currentY + 10, size: 11, font: fontBold, color: COLORS.textPrimary });
  page.drawText(safeRentPeriod, { x: width / 2 - 20, y: currentY + 10, size: 10, font: fontRegular, color: COLORS.textMuted });
  const safeDueDate = sanitizeText(dueDate);
  page.drawText(safeDueDate, { x: width / 2 + 80, y: currentY + 10, size: 10, font: fontRegular, color: COLORS.textMuted });
  
  const formattedAmt = sanitizeText(formatCurrency(oblAmount, p));
  page.drawText(formattedAmt, { x: width - 50 - fontBold.widthOfTextAtSize(formattedAmt, 11), y: currentY + 10, size: 11, font: fontBold, color: COLORS.textPrimary });

  currentY -= 10;
  page.drawLine({ start: { x: 36, y: currentY }, end: { x: width - 36, y: currentY }, thickness: 1, color: COLORS.border });

  // --- BOTTOM ROW ---
  currentY -= 130;
  const bottomY = currentY;

  // Payment Details
  page.drawText("PAYMENT DETAILS", { x: 36, y: bottomY + 100, size: 9, font: fontBold, color: COLORS.textLight });
  
  let pmtY = bottomY + 80;
  page.drawText("Method", { x: 36, y: pmtY, size: 10, font: fontRegular, color: COLORS.textMuted });
  page.drawText(sanitizeText((data.payment_method || "N/A").toUpperCase()), { x: 120, y: pmtY, size: 10, font: fontBold, color: COLORS.textPrimary });
  pmtY -= 16;

  if (data.transaction_id) {
    page.drawText("Transaction ID", { x: 36, y: pmtY, size: 10, font: fontRegular, color: COLORS.textMuted });
    page.drawText(sanitizeText(data.transaction_id), { x: 120, y: pmtY, size: 10, font: fontRegular, color: COLORS.textPrimary });
    pmtY -= 16;
  }

  page.drawText("Payment Date", { x: 36, y: pmtY, size: 10, font: fontRegular, color: COLORS.textMuted });
  const safePaymentDate = sanitizeText(paymentDate);
  page.drawText(safePaymentDate, { x: 120, y: pmtY, size: 10, font: fontBold, color: COLORS.textPrimary });
  pmtY -= 16;

  if (data.reference_number) {
    page.drawText("Reference No.", { x: 36, y: pmtY, size: 10, font: fontRegular, color: COLORS.textMuted });
    page.drawText(sanitizeText(data.reference_number), { x: 120, y: pmtY, size: 10, font: fontRegular, color: COLORS.textPrimary });
  }

  // Amount Box
  const boxWidth = 200;
  const boxHeight = 110;
  const boxX = width - 36 - boxWidth;
  
  page.drawRectangle({
    x: boxX, y: bottomY, width: boxWidth, height: boxHeight, color: COLORS.charcoal,
  });

  page.drawText("TOTAL PAID", { x: boxX + boxWidth / 2 - fontBold.widthOfTextAtSize("TOTAL PAID", 9) / 2, y: bottomY + 80, size: 9, font: fontBold, color: COLORS.gold });
  
  const totalStr = sanitizeText(formatCurrency(data.amount, { ...p, currency: p.currency || 'INR' }).replace('.00', '')); // simple shorten
  page.drawText(totalStr, { x: boxX + boxWidth / 2 - fontBold.widthOfTextAtSize(totalStr, 28) / 2, y: bottomY + 45, size: 28, font: fontBold, color: COLORS.cream });

  if (isPaid) {
    page.drawRectangle({
      x: boxX + boxWidth / 2 - 30, y: bottomY + 15, width: 60, height: 20, borderColor: COLORS.green, borderWidth: 1.5,
    });
    page.drawText("PAID", { x: boxX + boxWidth / 2 - fontBold.widthOfTextAtSize("PAID", 10) / 2, y: bottomY + 21, size: 10, font: fontBold, color: COLORS.green });
  }

  // --- FOOTER NOTE ---
  currentY -= 20;
  page.drawLine({ start: { x: 36, y: currentY }, end: { x: width - 36, y: currentY }, thickness: 1, color: COLORS.border });
  currentY -= 30;
  
  // Basic text wrapping for note
  const safeFooterNote = sanitizeText(footerNote);
  const words = safeFooterNote.split(' ');
  let line = '';
  let noteY = currentY;
  for (let i = 0; i < words.length; i++) {
    const testLine = line + words[i] + ' ';
    const testWidth = fontItalic.widthOfTextAtSize(testLine, 10);
    if (testWidth > width - 72 && i > 0) {
      page.drawText(line, { x: 36, y: noteY, size: 10, font: fontItalic, color: COLORS.textLight });
      line = words[i] + ' ';
      noteY -= 14;
    } else {
      line = testLine;
    }
  }
  page.drawText(line, { x: 36, y: noteY, size: 10, font: fontItalic, color: COLORS.textLight });

  // --- BOTTOM BAR ---
  const footerHeight = 40;
  page.drawRectangle({
    x: 0, y: 0, width: width, height: footerHeight, color: COLORS.charcoal
  });
  
  page.drawText("Thank you for your timely payment.", { x: 36, y: 15, size: 10, font: fontRegular, color: COLORS.creamDim });
  const rightFooter = "Sri Adithya Hostels";
  page.drawText(rightFooter, { x: width - 36 - fontRegular.widthOfTextAtSize(rightFooter, 9), y: 15, size: 9, font: fontRegular, color: COLORS.gold });

  return await pdfDoc.save();
}
