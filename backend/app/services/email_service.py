import httpx
import os
from pathlib import Path
from jinja2 import Template
from app.utils.logger import get_logger

logger = get_logger(__name__)

RESEND_API_URL = "https://api.resend.com/emails"
DEFAULT_FROM = os.getenv("EMAIL_FROM", "Trishul Solutions <noreply@trishul.solutions>")


class EmailService:
    @staticmethod
    def _send_email(to_email: str, subject: str, html_body: str):
        """
        Send an email via the Resend REST API.
        Falls back to logging if RESEND_API_KEY is not configured.
        """
        api_key = os.getenv("RESEND_API_KEY")

        if not api_key:
            logger.warning("RESEND_API_KEY not configured. Email NOT sent.")
            logger.info(f"--- EMAIL SIMULATION ---")
            logger.info(f"To: {to_email}")
            logger.info(f"Subject: {subject}")
            logger.info(f"------------------------")
            return

        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }

        payload = {
            "from": DEFAULT_FROM,
            "to": [to_email],
            "subject": subject,
            "html": html_body,
        }

        try:
            response = httpx.post(RESEND_API_URL, json=payload, headers=headers, timeout=10.0)

            if response.status_code == 200:
                data = response.json()
                logger.info(f"Email sent to {to_email} | Resend ID: {data.get('id')}")
            else:
                logger.error(f"Resend API error ({response.status_code}): {response.text}")
        except Exception as e:
            logger.error(f"Failed to send email to {to_email}: {e}")

    @staticmethod
    def send_invitation_email(to_email: str, name: str, activation_link: str, room_no: str = "N/A", rent: float = 0.0):
        """
        Sends an invitation email to a new tenant via Resend.
        """
        subject = "You're invited to Trishul Solutions Hostel Portal"

        template_path = Path(__file__).resolve().parent.parent / "templates" / "email" / "invite.html"
        template = Template(template_path.read_text(encoding="utf-8"))
        html_body = template.render(
            name=name,
            activation_link=activation_link,
            room_no=room_no,
            rent=f"{rent:,.0f}" if rent else "0",
            hostel_name=os.getenv("HOSTEL_BRAND_NAME", "Trishul Solutions"),
            sender_name=os.getenv("EMAIL_SENDER_NAME", "Trishul Solutions")
        )

        EmailService._send_email(to_email, subject, html_body)

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

        EmailService._send_email(to_email, subject, html_body)
