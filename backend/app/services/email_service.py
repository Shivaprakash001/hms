import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import os
from app.utils.logger import get_logger

logger = get_logger(__name__)

class EmailService:
    @staticmethod
    def send_invitation_email(to_email: str, name: str, activation_link: str):
        """
        Sends an invitation email to a new tenant.
        Falls back to logging if SMTP is not configured.
        """
        subject = "Welcome to HMS - Activate Your Account"
        body = f"""
        Hi {name},

        You have been invited to join the Hostel Management System (HMS).
        Please click the link below to set your password and activate your account:

        {activation_link}

        This link will expire in 24 hours.

        Regards,
        HMS Team
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
            logger.info(f"Body: {body}")
            logger.info(f"------------------------------------")
            return

        try:
            msg = MIMEMultipart()
            msg['From'] = smtp_user
            msg['To'] = to_email
            msg['Subject'] = subject
            msg.attach(MIMEText(body, 'plain'))

            server = smtplib.SMTP(smtp_host, int(smtp_port))
            server.starttls()
            server.login(smtp_user, smtp_pass)
            server.send_message(msg)
            server.quit()
            logger.info(f"Invitation email sent to {to_email}")
        except Exception as e:
            logger.error(f"Failed to send invitation email to {to_email}: {e}")
