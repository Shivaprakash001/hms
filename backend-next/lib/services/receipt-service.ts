import { prisma } from "../db";
import PDFDocument from "pdfkit";

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
    
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 50, size: "A4" });
        const buffers: Buffer[] = [];
        
        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => {
          resolve(Buffer.concat(buffers));
        });

        // Header
        doc.fontSize(24).font('Helvetica-Bold').text(data.hostel_name, { align: 'center' });
        doc.moveDown(0.5);
        doc.fontSize(12).font('Helvetica').fillColor('gray').text('Payment Receipt', { align: 'center' });
        doc.fillColor('black');
        doc.moveDown(2);

        // Receipt Details Box
        doc.rect(50, doc.y, 495, 120).stroke('#e2e8f0');
        const startY = doc.y + 15;
        
        doc.fontSize(10).font('Helvetica-Bold').text('Receipt No:', 65, startY);
        doc.font('Helvetica').text(data.receipt_no, 150, startY);

        doc.font('Helvetica-Bold').text('Date:', 320, startY);
        doc.font('Helvetica').text(new Date(data.date).toLocaleDateString(), 380, startY);

        doc.font('Helvetica-Bold').text('Tenant Name:', 65, startY + 25);
        doc.font('Helvetica').text(data.student_name, 150, startY + 25);

        doc.font('Helvetica-Bold').text('Rent Cycle:', 65, startY + 50);
        const cycleDate = new Date(data.rent_month);
        doc.font('Helvetica').text(cycleDate.toLocaleString('default', { month: 'long', year: 'numeric' }), 150, startY + 50);

        doc.font('Helvetica-Bold').text('Payment Mode:', 65, startY + 75);
        doc.font('Helvetica').text(data.method.toUpperCase(), 150, startY + 75);

        if (data.reference) {
          doc.font('Helvetica-Bold').text('Reference:', 320, startY + 75);
          doc.font('Helvetica').text(data.reference, 380, startY + 75);
        }

        doc.y = startY + 120;
        doc.moveDown(2);

        // Amount Box
        doc.rect(50, doc.y, 495, 60).fillAndStroke('#f8fafc', '#e2e8f0');
        doc.fillColor('#0f172a').fontSize(14).font('Helvetica-Bold').text('Amount Received', 65, doc.y + 22);
        doc.fontSize(18).text(`Rs. ${data.amount.toLocaleString('en-IN')}`, 0, doc.y - 18, { align: 'right', width: 525 });

        doc.moveDown(4);
        
        // Footer
        doc.fontSize(10).font('Helvetica').fillColor('gray').text('This is a computer generated receipt and does not require a physical signature.', 50, doc.y, { align: 'center' });

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }
}

export const receiptService = new ReceiptService();
