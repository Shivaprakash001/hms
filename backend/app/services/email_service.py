import os
import resend
from app.utils.logger import get_logger

logger = get_logger(__name__)

DEFAULT_FROM = os.getenv("EMAIL_FROM", "noreply@trishul.solutions")


class EmailService:
    @staticmethod
    def _send_email(to_email: str, subject: str, html_body: str):
        """
        Send an email via the Resend SDK.
        Falls back to logging if RESEND_API_KEY is not configured.
        """
        api_key = os.getenv("RESEND_API_KEY")

        if not api_key:
            logger.warning("RESEND_API_KEY not configured. Email NOT sent.")
            logger.info(f"--- EMAIL SIMULATION ---")
            logger.info(f"To: {to_email}")
            logger.info(f"Subject: {subject}")
            logger.info(f"------------------------")
            return {"sent": False, "error": "RESEND_API_KEY not configured"}

        resend.api_key = api_key

        params: resend.Emails.SendParams = {
            "from": DEFAULT_FROM,
            "to": [to_email],
            "subject": subject,
            "html": html_body,
        }

        try:
            response = resend.Emails.send(params)
            
            logger.info(f"Email sent to {to_email} | Resend ID: {response.get('id')}")
            return {"sent": True, "error": None, "provider_id": response.get("id")}
        except Exception as e:
            logger.error(f"Failed to send email to {to_email}: {e}")
            return {"sent": False, "error": str(e)}

    @staticmethod
    def send_invitation_email(to_email: str, name: str, activation_link: str):
        """
        Sends an invitation email to a new tenant via Resend SDK.
        """
        subject = "You're invited to join the hostel"

        html_body = f"""
        <p>Hello {name},</p>
        <p>You have been invited to join the hostel management system.</p>
        <p>Click the link below to activate your account:</p>
        <p><a href="{activation_link}">{activation_link}</a></p>
        <p>This activation link expires in 48 hours.</p>
        """

        return EmailService._send_email(to_email, subject, html_body)

    @staticmethod
    def send_payment_receipt_email(
        to_email: str,
        name: str,
        amount: float,
        rent_month: str,
        payment_reference: str,
        room_no: str = "N/A",
    ):
        """
        Send a payment receipt email to the student via Resend.
        """
        subject = f"HMS - Rent Payment Receipt for {rent_month}"

        html_body = f"""
        <html>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                <h2>Rent Payment Receipt</h2>
                <p>Hi <strong>{name}</strong>,</p>
                <p>Your rent payment has been successfully received.</p>
                <div style="background-color: #f4f4f4; padding: 15px; border-radius: 5px; margin: 20px 0;">
                    <p style="margin: 5px 0;"><strong>Room:</strong> {room_no}</p>
                    <p style="margin: 5px 0;"><strong>Month:</strong> {rent_month}</p>
                    <p style="margin: 5px 0;"><strong>Amount Paid:</strong> ₹{amount}</p>
                    <p style="margin: 5px 0;"><strong>Reference:</strong> {payment_reference}</p>
                </div>
                <p>Please retain this email as your payment confirmation.</p>
                <p>Regards,<br>HMS Team</p>
            </body>
        </html>
        """

        return EmailService._send_email(to_email, subject, html_body)
