import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import os
from app.utils.logger import get_logger

logger = get_logger(__name__)

class EmailService:
    @staticmethod
    def send_invitation_email(to_email: str, name: str, activation_link: str, room_no: str = "N/A", rent: float = 0.0):
        """
        Sends an invitation email to a new tenant.
        Falls back to logging if SMTP is not configured.
        """
        subject = "Welcome to HMS - Activate Your Account"
        
        body_text = f"Hi {name},\n\nYou have been invited to join HMS.\nRoom: {room_no}\nMonthly Rent: ₹{rent}\n\nActivate here: {activation_link}\n\nValid for 24 hours."
        
        body_html = f"""
        <html>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                <h2>Welcome to HMS!</h2>
                <p>Hi <strong>{name}</strong>,</p>
                <p>You have been invited to join the Hostel Management System.</p>
                <div style="background-color: #f4f4f4; padding: 15px; border-radius: 5px; margin: 20px 0;">
                    <p style="margin: 5px 0;"><strong>Room:</strong> {room_no}</p>
                    <p style="margin: 5px 0;"><strong>Monthly Rent:</strong> ₹{rent}</p>
                </div>
                <p>Please click the button below to set your password and activate your account:</p>
                <a href="{activation_link}" style="display: inline-block; background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; margin: 10px 0;">ACTIVATE ACCOUNT</a>
                <p style="font-size: 0.8em; color: #666;">This link will expire in 24 hours.</p>
                <p>Regards,<br>HMS Team</p>
            </body>
        </html>
        """

        smtp_host = os.getenv("SMTP_HOST")
        smtp_port = os.getenv("SMTP_PORT")
        smtp_user = os.getenv("SMTP_USER")
        smtp_pass = os.getenv("SMTP_PASS")

        if not all([smtp_host, smtp_port, smtp_user, smtp_pass]):
            logger.warning("SMTP not fully configured. Invitation NOT SENT via email.")
            logger.info(f"--- INVITATION EMAIL SIMULATION ---")
            logger.info(f"To: {to_email}")
            logger.info(f"Subject: {subject}")
            logger.info(f"Body: {body_text}")
            logger.info(f"------------------------------------")
            return

        try:
            msg = MIMEMultipart()
            msg['From'] = smtp_user
            msg['To'] = to_email
            msg['Subject'] = subject
            msg.attach(MIMEText(body_text, 'plain'))
            msg.attach(MIMEText(body_html, 'html'))

            server = smtplib.SMTP(smtp_host, int(smtp_port))
            server.starttls()
            server.login(smtp_user, smtp_pass)
            server.send_message(msg)
            server.quit()
            logger.info(f"Invitation email sent to {to_email}")
        except Exception as e:
            logger.error(f"Failed to send invitation email to {to_email}: {e}")

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
        Send a payment receipt email to the student.
        Falls back to logging when SMTP is not configured.
        """
        subject = f"HMS - Rent Payment Receipt for {rent_month}"

        body_text = (
            f"Hi {name},\n\n"
            f"Your rent payment has been received.\n\n"
            f"  Room       : {room_no}\n"
            f"  Month      : {rent_month}\n"
            f"  Amount     : ₹{amount}\n"
            f"  Reference  : {payment_reference}\n\n"
            f"Please keep this confirmation for your records.\n\n"
            f"Regards,\nHMS Team"
        )

        body_html = f"""
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

        smtp_host = os.getenv("SMTP_HOST")
        smtp_port = os.getenv("SMTP_PORT")
        smtp_user = os.getenv("SMTP_USER")
        smtp_pass = os.getenv("SMTP_PASS")

        if not all([smtp_host, smtp_port, smtp_user, smtp_pass]):
            logger.warning("SMTP not configured – payment receipt NOT sent via email.")
            logger.info(f"--- PAYMENT RECEIPT SIMULATION ---")
            logger.info(f"To: {to_email} | Month: {rent_month} | Amount: ₹{amount} | Ref: {payment_reference}")
            logger.info(f"----------------------------------")
            return

        try:
            msg = MIMEMultipart()
            msg["From"] = smtp_user
            msg["To"] = to_email
            msg["Subject"] = subject
            msg.attach(MIMEText(body_text, "plain"))
            msg.attach(MIMEText(body_html, "html"))

            server = smtplib.SMTP(smtp_host, int(smtp_port))
            server.starttls()
            server.login(smtp_user, smtp_pass)
            server.send_message(msg)
            server.quit()
            logger.info(f"Payment receipt email sent to {to_email}")
        except Exception as e:
            logger.error(f"Failed to send payment receipt to {to_email}: {e}")
