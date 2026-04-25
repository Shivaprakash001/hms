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

  static async sendEmail(to: string, subject: string, html: string) {
    if (!process.env.RESEND_API_KEY) {
      console.warn("RESEND_API_KEY not configured. Email simulation mode.");
      console.log(`--- EMAIL SIMULATION ---\nTo: ${to}\nSubject: ${subject}\n------------------------`);
      return { sent: false, error: "RESEND_API_KEY missing" };
    }

    try {
      const { data, error } = await resend.emails.send({
        from: DEFAULT_FROM,
        to: [to],
        subject,
        html,
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
  }) {
    const subject = `Payment Receipt - ${data.rentMonth}`;
    const html = `
      <div style="font-family: sans-serif;">
        <h3>Rent Payment Received</h3>
        <p>Hi ${data.name},</p>
        <p>We've received your payment of ₹${data.amount} for the month of ${data.rentMonth}.</p>
        <p><strong>Reference:</strong> ${data.reference}</p>
      </div>
    `;
    return this.sendEmail(data.toEmail, subject, html);
  }
}
