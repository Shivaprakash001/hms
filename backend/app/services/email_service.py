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
    def send_invitation_email(
        to_email: str, 
        tenant_name: str, 
        owner_name: str, 
        hostel_name: str, 
        hostel_logo_url: str | None,
        room_number: str, 
        room_rent: float, 
        roommates_list: str, 
        activation_link: str
    ):
        """
        Sends a professional SaaS-style invitation email to a new tenant via Resend SDK.
        """
        subject = f"You're invited to join {hostel_name}"
        company_logo_url = hostel_logo_url or "https://trishul.solutions/logo.png"

        # Roommates edge case handling
        roommates_info = roommates_list if roommates_list.strip() else "You will be the first tenant assigned to this room."

        html_body = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1a1a1a; margin: 0; padding: 0; background-color: #f9fafb; }}
                .container {{ max-width: 600px; margin: 40px auto; padding: 20px; }}
                .card {{ background: #ffffff; border-radius: 16px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); padding: 40px; border: 1px border-slate-100; }}
                .logo {{ display: block; margin: 0 auto 32px; width: 48px; border-radius: 12px; }}
                .title {{ font-size: 24px; font-weight: 800; text-align: center; margin-bottom: 24px; color: #111827; tracking: -0.025em; }}
                .greeting {{ font-size: 16px; margin-bottom: 24px; }}
                .room-card {{ background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; margin-bottom: 24px; }}
                .room-label {{ font-size: 12px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; }}
                .room-value {{ font-size: 18px; font-weight: 700; color: #1e293b; margin-bottom: 16px; }}
                .room-value:last-child {{ margin-bottom: 0; }}
                .roommates-section {{ margin-bottom: 32px; }}
                .roommates-title {{ font-size: 14px; font-weight: 700; color: #475569; margin-bottom: 12px; }}
                .roommates-list {{ padding-left: 20px; margin: 0; color: #475569; }}
                .roommates-empty {{ font-style: italic; color: #94a3b8; font-size: 14px; }}
                .btn-container {{ text-align: center; margin: 32px 0; }}
                .btn {{ background-color: #6366f1; color: #ffffff !important; padding: 14px 32px; border-radius: 12px; text-decoration: none; font-weight: 700; font-size: 16px; display: inline-block; transition: background-color 0.2s; }}
                .footer {{ text-align: center; font-size: 14px; color: #64748b; margin-top: 32px; }}
                .notice {{ font-size: 12px; color: #94a3b8; margin-top: 16px; font-style: italic; }}
                .raw-link {{ font-size: 12px; color: #94a3b8; word-break: break-all; margin-top: 24px; border-top: 1px solid #f1f5f9; pt: 16px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <img src="{company_logo_url}" alt="{hostel_name}" class="logo">
                <div class="card">
                    <h1 class="title">You're invited to join {hostel_name}</h1>
                    
                    <p class="greeting">Hello <strong>{tenant_name}</strong>,</p>
                    <p class="greeting">{owner_name} has invited you to join the <strong>{hostel_name} hostel management system</strong>.</p>

                    <div class="room-card">
                        <div class="room-label">Room Number</div>
                        <div class="room-value">{room_number}</div>
                        <div class="room-label">Monthly Rent</div>
                        <div class="room-value">₹{room_rent:,.2f}</div>
                    </div>

                    <div class="roommates-section">
                        <div class="roommates-title">Your Roommates:</div>
                        {f'<ul class="roommates-list">{roommates_info}</ul>' if roommates_list.strip() else f'<p class="roommates-empty">{roommates_info}</p>'}
                    </div>

                    <div class="btn-container">
                        <a href="{activation_link}" class="btn">Activate Account</a>
                        <p class="notice">This activation link will expire in 48 hours.</p>
                    </div>

                    <div class="raw-link">
                        If the button doesn't work, copy and paste this link into your browser:<br>
                        <a href="{activation_link}" style="color: #6366f1;">{activation_link}</a>
                    </div>
                </div>

                <div class="footer">
                    <p>Welcome to <strong>{hostel_name}</strong>. We hope you have a comfortable stay.</p>
                    <p style="margin-top: 24px; font-weight: 600; color: #475569;">Trishul Solutions</p>
                    <p style="font-size: 12px;">Smart Hostel Management Platform</p>
                    <p style="font-size: 12px;"><a href="https://trishul.solutions" style="color: #64748b;">trishul.solutions</a></p>
                </div>
            </div>
        </body>
        </html>
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
