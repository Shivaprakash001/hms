import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { prisma } from "../../../lib/db";
import { imagekit } from "../../../lib/imagekit";
import axios from "axios";

function formatAgreementDate(dateInput: Date | string | null | undefined): string {
  if (!dateInput) return "N/A";
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return "N/A";
  
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const day = String(date.getDate()).padStart(2, "0");
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  return `${day} ${month} ${year}`;
}

function formatAgreementDateTime(dateInput: Date | string | null | undefined): string {
  if (!dateInput) return "N/A";
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return "N/A";
  
  const dateStr = formatAgreementDate(date);
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${dateStr} ${hours}:${minutes}`;
}


export interface AgreementData {
  hostelName: string;
  hostelAddress: string;
  ownerName: string;
  ownerSignatureUrl?: string | null;
  tenantName: string;
  tenantEmail: string;
  tenantPhone: string;
  permanentAddress?: string | null;
  roomNo?: string | null;
  monthlyRent: number;
  advanceDeposit: number;
  maintenanceCharge: number;
  maintenanceType: string;
  joiningDate: Date | string;
  paymentFrequency: string;
  customRules?: string | null;
  
  tenantSignatureUrl?: string | null;
  tenantSignatureName?: string | null;
  tenantSignedAt?: Date | string | null;
  tenantIp?: string | null;
  tenantUserAgent?: string | null;

  guardianSignatureUrl?: string | null;
  guardianSignatureName?: string | null;
  guardianRelation?: string | null;
  guardianSignedAt?: Date | string | null;
  guardianIp?: string | null;
  guardianUserAgent?: string | null;

  ownerSignedAt?: Date | string | null;
}

// WinAnsi character encoding helper
function sanitizeText(str: string | null | undefined): string {
  if (!str) return "";
  let s = str.replace(/₹/g, "Rs. ");
  s = s.replace(/[^\x00-\xFF]/g, ""); 
  return s.trim();
}

function wrapText(text: string, width: number, font: any, fontSize: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const testWidth = font.widthOfTextAtSize(testLine, fontSize);
    if (testWidth > width) {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

function wrapTextWithNewlines(text: string, width: number, font: any, fontSize: number): string[] {
  const paragraphs = text.split("\n");
  const lines: string[] = [];
  for (const para of paragraphs) {
    const wrapped = wrapText(para, width, font, fontSize);
    if (wrapped.length === 0) {
      lines.push("");
    } else {
      lines.push(...wrapped);
    }
  }
  return lines;
}

async function fetchImageBuffer(url: string): Promise<Buffer | null> {
  try {
    const res = await axios.get(url, { responseType: "arraybuffer" });
    return Buffer.from(res.data);
  } catch (error) {
    console.error("Failed to fetch image for agreement PDF:", url, error);
    return null;
  }
}

export class AgreementGenerationService {
  /**
   * Helper to fetch tenant, hostel, room details and format for PDF generation.
   */
  static async getAgreementRenderData(agreementId: string): Promise<AgreementData> {
    const agreement = await prisma.agreement.findUnique({
      where: { id: agreementId },
      include: {
        tenant: {
          include: {
            room_allocations: {
              where: { is_active: true },
              include: { room: true },
            },
          },
        },
        hostel: true,
        template: true,
      },
    });

    if (!agreement) {
      throw new Error(`Agreement not found: ${agreementId}`);
    }

    const snapshot = agreement.content_snapshot as any;
    const tenant = agreement.tenant;
    const hostel = agreement.hostel;
    const template = agreement.template;

    const joiningDate = snapshot.joining_date || tenant.joined_on || new Date();
    const formattedJoiningDate = formatAgreementDate(joiningDate);

    return {
      hostelName: snapshot.hostel_name || hostel.name,
      hostelAddress: [hostel.address, hostel.city, hostel.state, hostel.pincode].filter(Boolean).join(", "),
      ownerName: snapshot.owner_name || template.owner_name || "Hostel Owner",
      ownerSignatureUrl: template.owner_signature_url,
      tenantName: snapshot.tenant_name || tenant.personal_email || "N/A",
      tenantEmail: tenant.personal_email || "",
      tenantPhone: tenant.phone_1 || "",
      permanentAddress: tenant.permanent_address || "N/A",
      roomNo: snapshot.room_number || "N/A",
      monthlyRent: Number(snapshot.monthly_rent || tenant.monthly_rent || 0),
      advanceDeposit: Number(snapshot.advance_deposit || tenant.advance_deposit || 0),
      maintenanceCharge: Number(snapshot.maintenance_charge || tenant.maintenance_charge || 0),
      maintenanceType: snapshot.maintenance_type || tenant.maintenance_type || "MONTHLY",
      joiningDate: formattedJoiningDate,
      paymentFrequency: snapshot.payment_frequency || tenant.payment_frequency || "MONTHLY",
      customRules: snapshot.custom_rules || template.custom_rules,
      
      tenantSignatureUrl: agreement.tenant_signature_url,
      tenantSignatureName: agreement.tenant_signature_name,
      tenantSignedAt: agreement.tenant_signed_at,
      tenantIp: agreement.tenant_ip,
      tenantUserAgent: agreement.tenant_user_agent,

      guardianSignatureUrl: agreement.guardian_signature_url,
      guardianSignatureName: agreement.guardian_signature_name,
      guardianRelation: agreement.guardian_relation,
      guardianSignedAt: agreement.guardian_signed_at,
      guardianIp: agreement.guardian_ip,
      guardianUserAgent: agreement.guardian_user_agent,

      ownerSignedAt: agreement.owner_signed_at,
    };
  }

  /**
   * Generates the A4 Agreement PDF and uploads it to ImageKit, returning the URL.
   */
  static async generateAndUploadPdf(agreementId: string): Promise<string> {
    const data = await this.getAgreementRenderData(agreementId);
    
    const pdfDoc = await PDFDocument.create();
    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fontItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

    let page = pdfDoc.addPage([595.28, 841.89]); // A4
    const { width, height } = page.getSize();
    const margin = 50;
    const contentWidth = width - margin * 2; // 495.28

    let currentY = height - margin;

    const COLORS = {
      textPrimary: rgb(26 / 255, 25 / 255, 24 / 255),
      textMuted: rgb(107 / 255, 101 / 255, 96 / 255),
      border: rgb(220 / 255, 220 / 255, 220 / 255),
      lineColor: rgb(240 / 255, 240 / 255, 240 / 255),
    };

    const drawHeader = () => {
      page.drawText(sanitizeText("HOSTEL ACCOMMODATION AGREEMENT"), {
        x: margin,
        y: currentY,
        size: 16,
        font: fontBold,
        color: COLORS.textPrimary,
      });
      currentY -= 8;
      page.drawLine({
        start: { x: margin, y: currentY },
        end: { x: width - margin, y: currentY },
        thickness: 1,
        color: COLORS.border,
      });
      currentY -= 20;
    };

    const checkPageBreak = (neededHeight: number) => {
      if (currentY - neededHeight < margin + 40) {
        page = pdfDoc.addPage([595.28, 841.89]);
        currentY = height - margin;
        drawHeader();
      }
    };

    // Initialize first page header
    drawHeader();

    // 1. Parties Info Box
    checkPageBreak(120);
    // Draw Lessor Box (Left side)
    const boxWidth = contentWidth / 2 - 10;
    page.drawText(sanitizeText("LESSOR (Hostel Owner)"), {
      x: margin,
      y: currentY,
      size: 10,
      font: fontBold,
      color: COLORS.textPrimary,
    });
    page.drawText(sanitizeText(`Name: ${data.ownerName}`), {
      x: margin,
      y: currentY - 16,
      size: 9,
      font: fontRegular,
      color: COLORS.textMuted,
    });
    page.drawText(sanitizeText(`Hostel: ${data.hostelName}`), {
      x: margin,
      y: currentY - 28,
      size: 9,
      font: fontRegular,
      color: COLORS.textMuted,
    });
    const wrappedAddr = wrapText(data.hostelAddress, boxWidth, fontRegular, 9);
    let addrY = currentY - 40;
    wrappedAddr.slice(0, 3).forEach((line) => {
      page.drawText(sanitizeText(line), {
        x: margin,
        y: addrY,
        size: 9,
        font: fontRegular,
        color: COLORS.textMuted,
      });
      addrY -= 12;
    });

    // Draw Lessee Box (Right side)
    const rightColX = margin + boxWidth + 20;
    page.drawText(sanitizeText("LESSEE (Tenant)"), {
      x: rightColX,
      y: currentY,
      size: 10,
      font: fontBold,
      color: COLORS.textPrimary,
    });
    page.drawText(sanitizeText(`Name: ${data.tenantName}`), {
      x: rightColX,
      y: currentY - 16,
      size: 9,
      font: fontRegular,
      color: COLORS.textMuted,
    });
    page.drawText(sanitizeText(`Phone: ${data.tenantPhone}`), {
      x: rightColX,
      y: currentY - 28,
      size: 9,
      font: fontRegular,
      color: COLORS.textMuted,
    });
    page.drawText(sanitizeText(`Email: ${data.tenantEmail}`), {
      x: rightColX,
      y: currentY - 40,
      size: 9,
      font: fontRegular,
      color: COLORS.textMuted,
    });
    const wrappedPerm = wrapText(data.permanentAddress || "N/A", boxWidth, fontRegular, 9);
    let permY = currentY - 52;
    wrappedPerm.slice(0, 3).forEach((line) => {
      page.drawText(sanitizeText(line), {
        x: rightColX,
        y: permY,
        size: 9,
        font: fontRegular,
        color: COLORS.textMuted,
      });
      permY -= 12;
    });

    currentY -= 90;

    // 2. Room & Financial Terms Grid
    checkPageBreak(120);
    page.drawLine({
      start: { x: margin, y: currentY },
      end: { x: width - margin, y: currentY },
      thickness: 1,
      color: COLORS.border,
    });
    currentY -= 15;

    page.drawText(sanitizeText("ACCOMMODATION & FINANCIAL TERMS"), {
      x: margin,
      y: currentY,
      size: 11,
      font: fontBold,
      color: COLORS.textPrimary,
    });
    currentY -= 20;

    const gridItems = [
      { label: "Room Allocated", value: data.roomNo || "N/A" },
      { label: "Joining Date", value: String(data.joiningDate) },
      { label: "Monthly Rent", value: `Rs. ${data.monthlyRent.toLocaleString("en-IN")}` },
      { label: "Payment Frequency", value: data.paymentFrequency },
      { label: "Security Deposit", value: `Rs. ${data.advanceDeposit.toLocaleString("en-IN")}` },
      { label: "Maintenance Fee", value: data.maintenanceCharge > 0 ? `Rs. ${data.maintenanceCharge.toLocaleString("en-IN")} (${data.maintenanceType})` : "N/A" },
    ];

    let gridY = currentY;
    gridItems.forEach((item, index) => {
      const isEven = index % 2 === 0;
      const xPos = isEven ? margin : rightColX;
      if (!isEven && index > 0) {
        gridY -= 20;
      }
      page.drawText(sanitizeText(item.label), {
        x: xPos,
        y: isEven ? gridY : gridY + 20,
        size: 9,
        font: fontBold,
        color: COLORS.textMuted,
      });
      page.drawText(sanitizeText(item.value), {
        x: xPos + 120,
        y: isEven ? gridY : gridY + 20,
        size: 9,
        font: fontRegular,
        color: COLORS.textPrimary,
      });
    });
    currentY = gridY - 15;

    // 3. Terms & Conditions Section
    checkPageBreak(150);
    page.drawLine({
      start: { x: margin, y: currentY },
      end: { x: width - margin, y: currentY },
      thickness: 1,
      color: COLORS.border,
    });
    currentY -= 15;

    page.drawText(sanitizeText("STANDARD TERMS & CONDITIONS"), {
      x: margin,
      y: currentY,
      size: 11,
      font: fontBold,
      color: COLORS.textPrimary,
    });
    currentY -= 20;

    const standardRules = [
      "The Lessee shall use the allocated room solely for residential purposes. Sub-letting or transferring the room to any other person is strictly prohibited.",
      "Monthly rent is payable in advance as per the agreed rent cycle. Late payments may attract fees or lead to suspension of access.",
      "The security deposit is refundable upon vacating the premises, subject to clearance of all pending dues and room inspection for damages.",
      "Notice Period: Either party must provide at least 30 days written notice prior to terminating this agreement.",
      "Hostel Rules Compliance: The Lessee explicitly agrees to comply fully with, follow, and be bound by each and every rule, policy, and regulation of the hostel (including fee refund rules, discipline policies, late fee obligations, and property damage liabilities). Any breach of these rules constitutes a violation of this residency agreement and may result in immediate termination of stay.",
    ];

    standardRules.forEach((rule, idx) => {
      const ruleWrapped = wrapText(`${idx + 1}. ${rule}`, contentWidth, fontRegular, 9);
      checkPageBreak(ruleWrapped.length * 12 + 10);
      ruleWrapped.forEach((line) => {
        page.drawText(sanitizeText(line), {
          x: margin,
          y: currentY,
          size: 9,
          font: fontRegular,
          color: COLORS.textPrimary,
        });
        currentY -= 12;
      });
      currentY -= 4;
    });

    // 4. Custom Hostel Rules Section
    if (data.customRules && data.customRules.trim()) {
      checkPageBreak(60);
      currentY -= 10;
      page.drawText(sanitizeText("ADDITIONAL / CUSTOM HOSTEL RULES"), {
        x: margin,
        y: currentY,
        size: 11,
        font: fontBold,
        color: COLORS.textPrimary,
      });
      currentY -= 20;

      const customWrapped = wrapTextWithNewlines(data.customRules, contentWidth, fontRegular, 9);
      customWrapped.forEach((line) => {
        if (line === "") {
          currentY -= 8;
        } else {
          checkPageBreak(12);
          page.drawText(sanitizeText(line), {
            x: margin,
            y: currentY,
            size: 9,
            font: fontRegular,
            color: COLORS.textPrimary,
          });
          currentY -= 12;
        }
      });
    }

    // 5. Signatures and Audit Logs (Force to the bottom or next page)
    const isStudent = Boolean(data.guardianSignatureName || data.guardianSignatureUrl);
    const colCount = isStudent ? 3 : 2;
    const colWidth = contentWidth / colCount;

    // Check if we need a new page for signatures
    checkPageBreak(180);
    currentY -= 15;
    page.drawLine({
      start: { x: margin, y: currentY },
      end: { x: width - margin, y: currentY },
      thickness: 1,
      color: COLORS.border,
    });
    currentY -= 20;

    page.drawText(sanitizeText("DIGITAL SIGNATURES & AUDIT LOGS"), {
      x: margin,
      y: currentY,
      size: 11,
      font: fontBold,
      color: COLORS.textPrimary,
    });
    currentY -= 15;

    // Draw Column Headers
    const sigYStart = currentY;

    // Draw Tenant Col (Left)
    page.drawText(sanitizeText("Lessee (Tenant)"), {
      x: margin,
      y: sigYStart,
      size: 9,
      font: fontBold,
      color: COLORS.textPrimary,
    });

    // Draw Guardian Col (Center, if student)
    if (isStudent) {
      page.drawText(sanitizeText(`Parent/Guardian (${data.guardianRelation || "Parent"})`), {
        x: margin + colWidth,
        y: sigYStart,
        size: 9,
        font: fontBold,
        color: COLORS.textPrimary,
      });
    }

    // Draw Owner Col (Right)
    const ownerColX = margin + colWidth * (colCount - 1);
    page.drawText(sanitizeText("Lessor (Owner)"), {
      x: ownerColX,
      y: sigYStart,
      size: 9,
      font: fontBold,
      color: COLORS.textPrimary,
    });

    const drawSignatureImage = async (url: string, xPos: number, yPos: number) => {
      const buf = await fetchImageBuffer(url);
      if (buf) {
        try {
          const img = await pdfDoc.embedPng(buf);
          page.drawImage(img, {
            x: xPos,
            y: yPos,
            width: 80,
            height: 35,
          });
        } catch (e) {
          // If it fails to embed as PNG, try JPEG
          try {
            const img = await pdfDoc.embedJpg(buf);
            page.drawImage(img, {
              x: xPos,
              y: yPos,
              width: 80,
              height: 35,
            });
          } catch (err) {
            console.error("Failed to embed image as PNG/JPEG:", err);
            page.drawText(sanitizeText("[Signature Image]"), {
              x: xPos,
              y: yPos + 10,
              size: 8,
              font: fontItalic,
              color: COLORS.textMuted,
            });
          }
        }
      } else {
        page.drawText(sanitizeText("[Signature Image]"), {
          x: xPos,
          y: yPos + 10,
          size: 8,
          font: fontItalic,
          color: COLORS.textMuted,
        });
      }
    };

    // Embed Tenant Signature
    if (data.tenantSignatureUrl) {
      await drawSignatureImage(data.tenantSignatureUrl, margin, sigYStart - 42);
    } else {
      page.drawText(sanitizeText("Signed Digitally"), {
        x: margin,
        y: sigYStart - 25,
        size: 9,
        font: fontItalic,
        color: COLORS.textMuted,
      });
    }

    // Embed Guardian Signature
    if (isStudent && data.guardianSignatureUrl) {
      await drawSignatureImage(data.guardianSignatureUrl, margin + colWidth, sigYStart - 42);
    } else if (isStudent) {
      page.drawText(sanitizeText("Signed Digitally"), {
        x: margin + colWidth,
        y: sigYStart - 25,
        size: 9,
        font: fontItalic,
        color: COLORS.textMuted,
      });
    }

    // Embed Owner Signature
    if (data.ownerSignatureUrl) {
      await drawSignatureImage(data.ownerSignatureUrl, ownerColX, sigYStart - 42);
    } else {
      page.drawText(sanitizeText("Authorized Signatory"), {
        x: ownerColX,
        y: sigYStart - 25,
        size: 9,
        font: fontItalic,
        color: COLORS.textMuted,
      });
    }

    // Draw Names & Metadata
    const metaY = sigYStart - 55;
    
    // Tenant details
    page.drawText(sanitizeText(`Name: ${data.tenantSignatureName || data.tenantName}`), {
      x: margin,
      y: metaY,
      size: 8,
      font: fontRegular,
      color: COLORS.textPrimary,
    });
    page.drawText(sanitizeText(`Date: ${formatAgreementDateTime(data.tenantSignedAt)}`), {
      x: margin,
      y: metaY - 10,
      size: 7,
      font: fontRegular,
      color: COLORS.textMuted,
    });
    page.drawText(sanitizeText(`IP: ${data.tenantIp || "N/A"}`), {
      x: margin,
      y: metaY - 18,
      size: 7,
      font: fontRegular,
      color: COLORS.textMuted,
    });
    const wrappedUA = wrapText(data.tenantUserAgent || "N/A", colWidth - 10, fontRegular, 6);
    page.drawText(sanitizeText(`UA: ${wrappedUA[0] || "N/A"}`), {
      x: margin,
      y: metaY - 26,
      size: 6,
      font: fontRegular,
      color: COLORS.textMuted,
    });

    // Guardian details
    if (isStudent) {
      const gX = margin + colWidth;
      page.drawText(sanitizeText(`Name: ${data.guardianSignatureName || "N/A"}`), {
        x: gX,
        y: metaY,
        size: 8,
        font: fontRegular,
        color: COLORS.textPrimary,
      });
      page.drawText(sanitizeText(`Date: ${formatAgreementDateTime(data.guardianSignedAt)}`), {
        x: gX,
        y: metaY - 10,
        size: 7,
        font: fontRegular,
        color: COLORS.textMuted,
      });
      page.drawText(sanitizeText(`IP: ${data.guardianIp || "N/A"}`), {
        x: gX,
        y: metaY - 18,
        size: 7,
        font: fontRegular,
        color: COLORS.textMuted,
      });
      const wrappedGUA = wrapText(data.guardianUserAgent || "N/A", colWidth - 10, fontRegular, 6);
      page.drawText(sanitizeText(`UA: ${wrappedGUA[0] || "N/A"}`), {
        x: gX,
        y: metaY - 26,
        size: 6,
        font: fontRegular,
        color: COLORS.textMuted,
      });
    }

    // Owner details
    page.drawText(sanitizeText(`Name: ${data.ownerName}`), {
      x: ownerColX,
      y: metaY,
      size: 8,
      font: fontRegular,
      color: COLORS.textPrimary,
    });
    page.drawText(sanitizeText(`Date: ${formatAgreementDateTime(data.ownerSignedAt)}`), {
      x: ownerColX,
      y: metaY - 10,
      size: 7,
      font: fontRegular,
      color: COLORS.textMuted,
    });

    const pdfBytes = await pdfDoc.save();
    
    // Upload PDF to ImageKit
    const uploadRes = await imagekit.files.upload({
      file: Buffer.from(pdfBytes).toString("base64"),
      fileName: `agreement_${agreementId}.pdf`,
      folder: `/agreements`,
      useUniqueFileName: true,
      tags: ["AGREEMENT", agreementId],
    });

    if (!uploadRes?.url) {
      throw new Error("Failed to upload agreement PDF to storage provider");
    }

    // Update agreement with PDF URL
    await prisma.agreement.update({
      where: { id: agreementId },
      data: { pdf_url: uploadRes.url },
    });

    return uploadRes.url;
  }
}
