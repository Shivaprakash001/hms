import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const DEFAULT_FROM = process.env.EMAIL_FROM || "noreply@mail.trishul.solutions";

export class EmailService {
  private static normalizeProviderError(error: unknown): string {
    if (!error) return "Unknown email provider error";
    if (typeof error === "string") return error;
    if (error instanceof Error) return error.message;

    if (typeof error === "object") {
      const err = error as Record<string, unknown>;
      const message = typeof err.message === "string" ? err.message : undefined;
      const name = typeof err.name === "string" ? err.name : undefined;
      const statusCode = typeof err.statusCode === "number" ? String(err.statusCode) : undefined;
      const joined = [statusCode, name, message].filter(Boolean).join(" ");
      if (joined) return joined.trim();
      try {
        return JSON.stringify(err);
      } catch {
        return String(err);
      }
    }

    return String(error);
  }

  static async sendEmail(to: string, subject: string, html: string, attachments?: any[]) {
    if (!process.env.RESEND_API_KEY) {
      console.warn("RESEND_API_KEY not configured. Email simulation mode.");
      console.log(`--- EMAIL SIMULATION ---\nTo: ${to}\nSubject: ${subject}\nAttachments: ${attachments?.length || 0}\n------------------------`);
      return { sent: false, error: "RESEND_API_KEY missing" };
    }

    try {
      const { data, error } = await resend.emails.send({
        from: DEFAULT_FROM,
        to: [to],
        subject,
        html,
        attachments,
      });

      if (error) {
        console.error(`Resend error sending to ${to}:`, error);
        return { sent: false, error: this.normalizeProviderError(error) };
      }

      return { sent: true, provider_id: data?.id };
    } catch (e: any) {
      console.error(`Email delivery error for ${to}:`, e);
      return { sent: false, error: this.normalizeProviderError(e) };
    }
  }

  static async sendInvitation(data: {
    toEmail: string;
    tenantName: string;
    ownerName: string;
    hostelName: string;
    roomNumber: string;
    roomRent: number;
    activationLink: string;
  }) {
    const subject = `You're invited to join ${data.hostelName}`;
    const html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2>Welcome to ${data.hostelName}</h2>
        <p>Hello <strong>${data.tenantName}</strong>,</p>
        <p>${data.ownerName} has invited you to join the hostel management system.</p>
        <div style="background: #f4f4f4; padding: 15px; border-radius: 8px;">
          <p><strong>Room:</strong> ${data.roomNumber}</p>
          <p><strong>Rent:</strong> ₹${data.roomRent}</p>
        </div>
        <p style="text-align: center; margin: 30px 0;">
          <a href="${data.activationLink}" style="background: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Activate Account</a>
        </p>
        <p style="font-size: 12px; color: #666;">This link expires in 48 hours.</p>
      </div>
    `;
    return this.sendEmail(data.toEmail, subject, html);
  }

  static async sendReceipt(data: {
    toEmail: string;
    name: string;
    amount: number;
    rentMonth: string;
    reference: string;
    pdfBuffer?: Buffer;
  }) {
    const subject = `Payment Receipt - ${data.rentMonth}`;
    const html = `
      <div style="font-family: sans-serif;">
        <h3>Rent Payment Received</h3>
        <p>Hi ${data.name},</p>
        <p>We've received your payment of ₹${data.amount} for the month of ${data.rentMonth}.</p>
        <p><strong>Reference:</strong> ${data.reference}</p>
        ${data.pdfBuffer ? '<p>Please find your payment receipt attached to this email.</p>' : ''}
      </div>
    `;
    
    const attachments = data.pdfBuffer ? [{
      filename: `Receipt_${data.rentMonth.replace(/ /g, '_')}.pdf`,
      content: data.pdfBuffer
    }] : undefined;
    
    return this.sendEmail(data.toEmail, subject, html, attachments);
  }
  static async sendReminderBatch(data: {
    toEmail: string;
    name: string;
    amount: number;
    rentMonth: string;
    dueDate: string;
    type: "DUE_SOON" | "WARNING" | "FINAL_NOTICE" | "LATE_FEE_ADDED";
  }) {
    let subject = "";
    let title = "";
    let message = "";
    let color = "#6366f1"; // Indigo default

    switch (data.type) {
      case "DUE_SOON":
        subject = `Rent Payment Reminder - ${data.rentMonth}`;
        title = "Gentle Rent Reminder";
        message = `This is a friendly reminder that your rent of <strong>₹${data.amount}</strong> for ${data.rentMonth} is due soon. kindly ignore if already paid.`;
        break;
      case "WARNING":
        subject = `Overdue Payment Notice - ${data.rentMonth}`;
        title = "Payment Overdue";
        message = `Your rent payment of <strong>₹${data.amount}</strong> for ${data.rentMonth} is now past its due date (${data.dueDate}). Please settle this to avoid late fees.`;
        color = "#f59e0b"; // Amber
        break;
      case "FINAL_NOTICE":
        subject = `URGENT: Final Rent Notice - ${data.rentMonth}`;
        title = "Final Payment Notice";
        message = `URGENT: Your rent of <strong>₹${data.amount}</strong> for ${data.rentMonth} is significantly overdue. Please pay immediately to avoid service deactivation or additional penalties.`;
        color = "#ef4444"; // Red
        break;
      case "LATE_FEE_ADDED":
        subject = `Late Fee Applied - ${data.rentMonth}`;
        title = "Late Fee Added";
        message = `A late fee has been applied to your account for the month of ${data.rentMonth} as the payment is past the grace period.`;
        color = "#7c3aed"; // Violet
        break;
    }

    const html = `
      <div style="font-family: sans-serif; max-width: 500px; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
        <div style="background: ${color}; color: white; padding: 20px; text-align: center;">
          <h2 style="margin: 0; font-size: 20px;">${title}</h2>
        </div>
        <div style="padding: 24px; color: #1e293b; line-height: 1.5;">
          <p>Hi <strong>${data.name}</strong>,</p>
          <p>${message}</p>
          <div style="margin: 20px 0; padding: 16px; background: #f8fafc; border-radius: 8px; border-left: 4px solid ${color};">
            <p style="margin: 0; font-size: 14px; color: #64748b;">Amount Due</p>
            <p style="margin: 4px 0 0; font-size: 24px; font-weight: bold; color: #0f172a;">₹${data.amount}</p>
            <p style="margin: 12px 0 0; font-size: 14px; color: #64748b;">Due Date: ${data.dueDate}</p>
          </div>
          <p style="font-size: 14px; color: #64748b; margin-top: 24px;">
            You can pay directly via the student dashboard or using the hostel UPI ID.
          </p>
        </div>
        <div style="background: #f1f5f9; padding: 12px; text-align: center; font-size: 12px; color: #94a3b8;">
          This is an automated notification from your Hostel Management System.
        </div>
      </div>
    `;

    return this.sendEmail(data.toEmail, subject, html);
  }
}
