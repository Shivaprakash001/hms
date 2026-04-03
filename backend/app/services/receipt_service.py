import os
from io import BytesIO
from datetime import datetime
from pathlib import Path
from decimal import Decimal
from jinja2 import Template
try:
    from weasyprint import HTML
    _WEASYPRINT_IMPORT_ERROR = None
except Exception as import_error:
    HTML = None
    _WEASYPRINT_IMPORT_ERROR = import_error
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
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
    def _generate_fallback_pdf(context: dict) -> BytesIO:
        """
        Generate a simple PDF receipt using ReportLab when WeasyPrint rendering fails.
        """
        buffer = BytesIO()
        c = canvas.Canvas(buffer, pagesize=A4)
        width, height = A4

        y = height - 50
        line_gap = 18

        c.setFont("Helvetica-Bold", 16)
        c.drawString(50, y, "PAYMENT RECEIPT")
        y -= 30

        c.setFont("Helvetica", 10)
        c.drawString(50, y, f"Company: {context.get('company_name', 'N/A')}")
        y -= line_gap
        c.drawString(50, y, f"Address: {context.get('company_address', 'N/A')}")
        y -= line_gap * 2

        c.setFont("Helvetica-Bold", 11)
        c.drawString(50, y, "Receipt Details")
        y -= line_gap
        c.setFont("Helvetica", 10)
        c.drawString(50, y, f"Receipt No: {context.get('receipt_no', 'N/A')}")
        y -= line_gap
        c.drawString(50, y, f"Date: {context.get('date', 'N/A')}")
        y -= line_gap
        c.drawString(50, y, f"Received From: {context.get('student_name', 'N/A')}")
        y -= line_gap
        c.drawString(50, y, f"Email: {context.get('student_email', 'N/A')}")
        y -= line_gap
        c.drawString(50, y, f"Phone: {context.get('student_phone', 'N/A')}")
        y -= line_gap

        student_address = str(context.get('student_address', 'N/A'))
        max_len = 95
        address_chunks = [student_address[i:i + max_len] for i in range(0, len(student_address), max_len)] or ["N/A"]
        c.drawString(50, y, f"Address: {address_chunks[0]}")
        y -= line_gap
        for chunk in address_chunks[1:]:
            c.drawString(100, y, chunk)
            y -= line_gap

        c.drawString(50, y, f"Payment Method: {context.get('payment_method', 'N/A')}")
        y -= line_gap
        c.drawString(50, y, f"Transaction ID: {context.get('transaction_id', 'N/A')}")
        y -= line_gap
        c.drawString(50, y, f"Status: {context.get('payment_status', 'PAID')}")
        y -= line_gap
        c.drawString(50, y, f"Description: {context.get('description', 'Hostel Rent')}")
        y -= line_gap
        c.drawString(50, y, f"Amount Paid: ₹{context.get('amount', '0.00')}")
        y -= line_gap * 2

        c.drawString(50, y, f"Support: {context.get('support_contact', 'N/A')}")
        y -= line_gap
        c.drawString(50, y, f"Generated On: {context.get('generated_on', 'N/A')}")

        verification_url = context.get('verification_url')
        if verification_url:
            y -= line_gap
            c.drawString(50, y, f"Verify Receipt: {verification_url}")

        c.showPage()
        c.save()
        buffer.seek(0)
        return buffer

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

        render_context = dict(
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

        html_template = Template(template_path.read_text(encoding="utf-8"))
        rendered_html = html_template.render(**render_context)

        if HTML is None:
            logger.warning(
                "WeasyPrint unavailable, using fallback receipt renderer: %s",
                _WEASYPRINT_IMPORT_ERROR
            )
            return ReceiptService._generate_fallback_pdf(render_context)

        try:
            pdf_bytes = HTML(string=rendered_html, base_url=str(template_path.parent)).write_pdf()
            buffer = BytesIO(pdf_bytes)
            buffer.seek(0)
            return buffer
        except Exception as e:
            logger.exception(f"WeasyPrint receipt generation failed for payment {payment_id}: {e}. Falling back to ReportLab.")
            return ReceiptService._generate_fallback_pdf(render_context)

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
