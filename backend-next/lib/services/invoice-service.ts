import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { prisma } from "../db";
import { imagekit } from "../imagekit";

export class InvoiceService {
  async generateInvoicePDF(paymentId: string) {
    // 1. Fetch data
    let receipt = await prisma.receipt.findFirst({
      where: { payment_id: paymentId },
      include: {
        payment: true,
        student: {
          include: { profile: true }
        }
      }
    });

    if (!receipt) {
       // Auto-generate missing receipt seamlessly
       const payment = await prisma.payment.findUnique({
         where: { id: paymentId },
         include: { obligation: true, student: { include: { profile: true } } }
       });

       if (!payment) throw new Error("Valid transaction payment not found");

       receipt = await prisma.receipt.create({
         data: {
           payment_id: payment.id,
           student_id: payment.student_id,
           amount: payment.amount_paid,
           payment_method: payment.payment_method,
           transaction_id: payment.reference_number || undefined,
           receipt_number: `RCP-${new Date().getTime().toString().slice(-6)}`,
           rent_month: payment.obligation?.rent_month || undefined,
           tenant_name: payment.student?.profile?.name || '-',
           owner_id: payment.owner_id
         },
         include: {
           payment: true,
           student: { include: { profile: true } }
         }
       });
    }

    // Avoid regenerating if we already have it
    if ((receipt as any).invoice_pdf_url) {
      return { url: (receipt as any).invoice_pdf_url, cached: true };
    }

    const hostel = await prisma.hostel.findFirst({
      where: { owner_id: receipt.student.owner_id as string }
    });

    if (!hostel) throw new Error("Hostel details not found");

    // Fetch allocations for room info
    const allocation = await prisma.roomAllocation.findFirst({
      where: { student_id: receipt.student_id },
      include: { room: true },
      orderBy: { start_date: 'desc' }
    });

    // 2. Generate PDF via pdf-lib (0 ms cold start architecture)
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595, 842]); // Standard A4 Resolution
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    
    // Header
    page.drawText("TAX INVOICE", { x: 50, y: 760, size: 28, font: fontBold, color: rgb(0.1, 0.1, 0.3) });
    
    page.drawText(`Invoice No: ${receipt.receipt_number}`, { x: 50, y: 725, size: 10, font });
    page.drawText(`Issue Date: ${new Date(receipt.issued_at).toLocaleDateString('en-GB')}`, { x: 50, y: 710, size: 10, font });

    // Host / Origin Block
    page.drawText("FROM:", { x: 50, y: 670, size: 10, font: fontBold, color: rgb(0.5, 0.5, 0.5) });
    page.drawText(hostel.name, { x: 50, y: 655, size: 12, font: fontBold });
    page.drawText(hostel.address || "Hostel Address", { x: 50, y: 640, size: 10, font });
    if (hostel.phone) page.drawText(`Phone: ${hostel.phone}`, { x: 50, y: 625, size: 10, font });

    // Tenant / Target Block
    page.drawText("BILLED TO:", { x: 350, y: 670, size: 10, font: fontBold, color: rgb(0.5, 0.5, 0.5) });
    const tenantName = receipt.student.profile?.name || receipt.tenant_name || "Unknown Tenant";
    page.drawText(tenantName, { x: 350, y: 655, size: 12, font: fontBold });
    page.drawText(`Tenant ID: ${receipt.student.id.split('-')[0].toUpperCase()}`, { x: 350, y: 640, size: 10, font });
    page.drawText(`Room No: ${allocation?.room?.room_no || "N/A"}`, { x: 350, y: 625, size: 10, font });

    // Ledger Header Table
    page.drawLine({ start: { x: 50, y: 580 }, end: { x: 545, y: 580 }, thickness: 1, color: rgb(0.9, 0.9, 0.9) });
    page.drawText("Description", { x: 50, y: 565, size: 11, font: fontBold });
    page.drawText("Month", { x: 300, y: 565, size: 11, font: fontBold });
    page.drawText("Amount", { x: 480, y: 565, size: 11, font: fontBold });
    page.drawLine({ start: { x: 50, y: 550 }, end: { x: 545, y: 550 }, thickness: 1, color: rgb(0.9, 0.9, 0.9) });

    // Ledger Content Row
    const monthLabel = receipt.rent_month ? new Date(receipt.rent_month).toLocaleString('default', { month: 'short', year: 'numeric' }) : "N/A";
    const amountVal = Number(receipt.amount).toFixed(2);
    const curr = hostel.currency === "INR" ? "Rs." : hostel.currency || "$";
    
    page.drawText("Rent & Accommodation Dues", { x: 50, y: 525, size: 11, font });
    page.drawText(monthLabel, { x: 300, y: 525, size: 11, font });
    page.drawText(`${curr} ${amountVal}`, { x: 480, y: 525, size: 11, font });
    
    // Totals Grid
    page.drawLine({ start: { x: 350, y: 490 }, end: { x: 545, y: 490 }, thickness: 1.5 });
    page.drawText("Total Received", { x: 350, y: 470, size: 12, font: fontBold });
    page.drawText(`${curr} ${amountVal}`, { x: 480, y: 470, size: 12, font: fontBold, color: rgb(0.1, 0.6, 0.3) });

    // Transaction Log
    page.drawText("PAYMENT DETAILS", { x: 50, y: 410, size: 10, font: fontBold, color: rgb(0.5, 0.5, 0.5) });
    page.drawText(`Payment Method: ${receipt.payment_method}`, { x: 50, y: 390, size: 11, font });
    if (receipt.transaction_id) {
        page.drawText(`Transaction ID: ${receipt.transaction_id}`, { x: 50, y: 375, size: 11, font });
    }
    page.drawText(`Date Finalized: ${new Date(receipt.payment.payment_date).toLocaleDateString('en-GB')}`, { x: 50, y: 360, size: 11, font });

    // Final Generation Save & Sync
    const pdfBytes = await pdfDoc.save();
    const base64Pdf = Buffer.from(pdfBytes).toString("base64");

    const uploadRes = await imagekit.files.upload({
      file: base64Pdf,
      fileName: `invoice_${receipt.receipt_number}.pdf`,
      folder: "/invoices",
      tags: ["invoice", receipt.id]
    });

    if (!uploadRes.url) throw new Error("Failed to upload PDF");

    // Persist Cache
    await prisma.receipt.update({
      where: { id: receipt.id },
      data: { invoice_pdf_url: uploadRes.url } as any
    });

    return { 
      url: uploadRes.url, 
      cached: false
    };
  }
}

export const invoiceService = new InvoiceService();
