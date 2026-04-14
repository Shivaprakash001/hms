import { prisma } from "../db";

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
}

export const receiptService = new ReceiptService();
