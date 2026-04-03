import os
from io import BytesIO
from datetime import datetime
from pathlib import Path
from decimal import Decimal
from jinja2 import Template
from weasyprint import HTML
from app.db import supabase
from app.utils.logger import get_logger

logger = get_logger(__name__)

class ReceiptService:
    @staticmethod
    def _format_currency(value) -> str:
        try:
            amount = Decimal(str(value or 0)).quantize(Decimal("0.01"))
            return f"{amount:,.2f}"
        except Exception:
            return "0.00"

    @staticmethod
    def _resolve_template_path() -> Path:
        return Path(__file__).resolve().parent.parent / "templates" / "receipt_template.html"

    @staticmethod
    def _normalize_payment_method(method: str) -> str:
        if not method:
            return "N/A"
        return str(method).replace("_", " ").title()

    @staticmethod
    def _build_description(obligation: dict) -> str:
        if not obligation:
            return "Hostel Rent"

        rent_month = obligation.get("rent_month")
        if not rent_month:
            return "Hostel Rent"

        try:
            if isinstance(rent_month, str):
                parsed = datetime.fromisoformat(rent_month.replace("Z", "+00:00"))
            else:
                parsed = rent_month
            return f"Hostel Rent - {parsed.strftime('%B %Y')}"
        except Exception:
            return f"Hostel Rent - {rent_month}"

    @staticmethod
    async def generate_receipt_pdf(payment_id: str) -> BytesIO:
        """
        Generates a PDF receipt for a payment.
        Returns a BytesIO object for the PDF.
        """
        # Fetch payment + student + obligation info
        res = supabase.table("payments").select(
            "id, created_at, amount_paid, payment_method, reference_number, "
            "rent_obligations(id, rent_month, status), "
            "students(id, profiles(name, email, phone, permanent_address, temporary_address))"
        ).eq("id", payment_id).execute()
        
        if not res.data:
            raise ValueError(f"Payment not found for format {payment_id}")
            
        payment = res.data[0]
        student = payment.get("students") or {}
        profile = student.get("profiles") or {}
        obligation = payment.get("rent_obligations", {})

        created_at = payment.get("created_at")
        try:
            if created_at:
                created_dt = datetime.fromisoformat(str(created_at).replace("Z", "+00:00"))
                formatted_date = created_dt.strftime("%d %b %Y, %I:%M %p")
            else:
                formatted_date = datetime.now().strftime("%d %b %Y, %I:%M %p")
        except Exception:
            formatted_date = str(created_at or datetime.now().date())

        student_address = (
            profile.get("temporary_address")
            or profile.get("permanent_address")
            or "N/A"
        )

        transaction_id = payment.get("reference_number") or "N/A"
        amount_formatted = ReceiptService._format_currency(payment.get("amount_paid"))

        company_name = os.getenv("RECEIPT_COMPANY_NAME", "Trishul Hostel Management")
        company_address = os.getenv("RECEIPT_COMPANY_ADDRESS", "Hyderabad, India")
        support_contact = os.getenv("RECEIPT_SUPPORT_CONTACT", "For inquiries contact hostel admin.")
        verify_base_url = os.getenv("RECEIPT_VERIFY_BASE_URL", "")
        verification_url = f"{verify_base_url.rstrip('/')}/{payment_id}" if verify_base_url else ""

        template_path = ReceiptService._resolve_template_path()
        if not template_path.exists():
            raise FileNotFoundError(f"Receipt template not found: {template_path}")

        html_template = Template(template_path.read_text(encoding="utf-8"))
        rendered_html = html_template.render(
            receipt_no=payment.get("id"),
            date=formatted_date,
            student_name=profile.get("name", "N/A"),
            student_address=student_address,
            student_email=profile.get("email", "N/A"),
            student_phone=profile.get("phone", "N/A"),
            payment_method=ReceiptService._normalize_payment_method(payment.get("payment_method")),
            payment_status=(obligation.get("status") if obligation else "PAID"),
            transaction_id=transaction_id,
            description=ReceiptService._build_description(obligation),
            amount=amount_formatted,
            company_name=company_name,
            company_address=company_address,
            support_contact=support_contact,
            verification_url=verification_url,
            generated_on=datetime.now().strftime("%d %b %Y, %I:%M %p"),
        )

        pdf_bytes = HTML(string=rendered_html, base_url=str(template_path.parent)).write_pdf()
        buffer = BytesIO(pdf_bytes)
        buffer.seek(0)
        return buffer

    @staticmethod
    async def verify_receipt(payment_id: str) -> dict:
        """
        Verify if a receipt exists and return lightweight payment metadata.
        Intended for public verification links/QR checks.
        """
        res = supabase.table("payments").select(
            "id, created_at, amount_paid, payment_method, reference_number, "
            "rent_obligations(rent_month, status), "
            "students(profiles(name))"
        ).eq("id", payment_id).execute()

        if not res.data:
            return {
                "valid": False,
                "receipt_no": payment_id,
                "message": "Receipt not found"
            }

        payment = res.data[0]
        obligation = payment.get("rent_obligations") or {}
        student = payment.get("students") or {}
        profile = student.get("profiles") or {}

        created_at = payment.get("created_at")
        try:
            issued_on = datetime.fromisoformat(str(created_at).replace("Z", "+00:00")).isoformat() if created_at else None
        except Exception:
            issued_on = str(created_at) if created_at else None

        return {
            "valid": True,
            "receipt_no": payment.get("id"),
            "issued_on": issued_on,
            "amount": ReceiptService._format_currency(payment.get("amount_paid")),
            "currency": "INR",
            "payment_method": ReceiptService._normalize_payment_method(payment.get("payment_method")),
            "transaction_id": payment.get("reference_number") or "N/A",
            "status": obligation.get("status") or "PAID",
            "description": ReceiptService._build_description(obligation),
            "received_from": profile.get("name") or "N/A"
        }
