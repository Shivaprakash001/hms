import puppeteer from "puppeteer";
import ejs from "ejs";
import path from "path";
import fs from "fs/promises";
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

    // Fetch the specific RentObligations related to this payment
    // Assuming payment covers the obligations exactly. 
    // If not, we can genericize it to just show the receipt amount.
    // For now we'll mock generic rent if explicit ledger items aren't mapped.
    const rentItems = [
      {
        description: "Rent / Dues",
        month: receipt.rent_month ? new Date(receipt.rent_month).toLocaleString('default', { month: 'short', year: 'numeric' }) : "N/A",
        amount: Number(receipt.amount)
      }
    ];

    // 2. Build invoice data object
    const data = {
      invoiceNo: receipt.receipt_number,
      date: new Date(receipt.issued_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      hostel: {
        name: hostel.name,
        address: hostel.address,
        city: hostel.city,
        state: hostel.state,
        pincode: hostel.pincode,
        phone: hostel.phone,
        upi_id: hostel.upi_id,
        gst_number: hostel.gst_number,
        logo_url: (hostel as any).logo_url || "",
        currency: hostel.currency === 'INR' ? '₹' : hostel.currency
      },
      tenant: {
        name: receipt.student.profile?.name || receipt.tenant_name || "Unknown Tenant",
        student_id: receipt.student.id.split('-')[0].toUpperCase(),
        phone: receipt.student.profile?.phone || "N/A"
      },
      room: allocation?.room?.room_no || "N/A",
      rentItems: rentItems,
      total: Number(receipt.amount),
      payment: {
        method: receipt.payment_method,
        transaction_id: receipt.transaction_id || "N/A",
        date: new Date(receipt.payment.payment_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
        status: "PAID"
      }
    };

    // 3. Render HTML
    const templatePath = path.join(process.cwd(), "templates", "invoice-template.ejs");
    const templateStr = await fs.readFile(templatePath, "utf-8");
    const html = ejs.render(templateStr, data);

    // 4. Convert HTML -> PDF
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdfBuffer = await page.pdf({ 
      format: "A4",
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' }
    });
    await browser.close();

    // 5. Save PDF to ImageKit
    const base64Pdf = Buffer.from(pdfBuffer).toString("base64");
    const uploadRes = await imagekit.files.upload({
      file: base64Pdf,
      fileName: `invoice_${receipt.receipt_number}.pdf`,
      folder: "/invoices",
      tags: ["invoice", receipt.id]
    });

    if (!uploadRes.url) throw new Error("Failed to upload PDF");

    // 6. Update Receipt
    await prisma.receipt.update({
      where: { id: receipt.id },
      data: { invoice_pdf_url: uploadRes.url } as any
    });

    return { 
      url: uploadRes.url, 
      cached: false,
      buffer: pdfBuffer
    };
  }
}

export const invoiceService = new InvoiceService();
