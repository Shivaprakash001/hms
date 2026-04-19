import os
from io import BytesIO
from datetime import datetime, timezone
from pathlib import Path
from decimal import Decimal
from jinja2 import Template
from zoneinfo import ZoneInfo
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
        normalized = str(method).replace("_", " ").strip()
        if normalized.upper() in {"UPI", "CASH", "CARD", "NEFT", "RTGS", "IMPS"}:
            return normalized.upper()
        return normalized.title()

    @staticmethod
    def _detect_payment_gateway(reference_number: str) -> str:
        if not reference_number:
            return os.getenv("RECEIPT_PAYMENT_GATEWAY", "N/A")
        ref = str(reference_number).lower()
        if ref.startswith("pay_"):
            return "Razorpay"
        return os.getenv("RECEIPT_PAYMENT_GATEWAY", "N/A")

    @staticmethod
    def _get_receipt_timezone() -> ZoneInfo:
        tz_name = os.getenv("RECEIPT_TIMEZONE", "Asia/Kolkata")
        try:
            return ZoneInfo(tz_name)
        except Exception:
            logger.warning(f"Invalid RECEIPT_TIMEZONE '{tz_name}', falling back to Asia/Kolkata")
            return ZoneInfo("Asia/Kolkata")

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
        Generate a professional PDF receipt using ReportLab when WeasyPrint rendering fails.
        """
        buffer = BytesIO()
        c = canvas.Canvas(buffer, pagesize=A4)
        width, height = A4

        y = height - 50
        line_gap = 14

        # Header
        c.setFont("Helvetica-Bold", 16)
        c.drawString(50, y, context.get("hostel_name", "HOSTEL MANAGEMENT"))
        y -= 18
        c.setFont("Helvetica", 10)
        c.drawString(50, y, context.get("hostel_address", ""))
        y -= 30

        # Title
        c.setFont("Helvetica-Bold", 14)
        c.drawString(50, y, "PAYMENT RECEIPT")
        y -= 24

        # Receipt metadata (right-aligned)
        c.setFont("Helvetica", 9)
        receipt_x = width - 200
        c.drawString(receipt_x, y, f"Receipt No: {context.get('receipt_no', 'N/A')}")
        y -= line_gap
        c.drawString(receipt_x, y, f"Date: {context.get('date', 'N/A')}")
        y -= line_gap
        c.drawString(receipt_x, y, f"Rent Month: {context.get('rent_month', 'N/A')}")
        y -= 24

        # Hostel Info Block
        c.setFont("Helvetica-Bold", 10)
        c.drawString(50, y, "HOSTEL DETAILS")
        y -= 14
        c.setFont("Helvetica", 9)
        c.drawString(50, y, f"Name: {context.get('hostel_name', 'N/A')}")
        y -= line_gap
        c.drawString(50, y, f"Address: {context.get('hostel_address', 'N/A')}")
        y -= line_gap
        c.drawString(50, y, f"Email: {context.get('hostel_email', 'N/A')}")
        y -= line_gap
        c.drawString(50, y, f"Phone: {context.get('hostel_phone', 'N/A')}")
        y -= 24

        # Tenant Info Block
        c.setFont("Helvetica-Bold", 10)
        c.drawString(50, y, "TENANT DETAILS")
        y -= 14
        c.setFont("Helvetica", 9)
        c.drawString(50, y, f"Name: {context.get('student_name', 'N/A')}")
        y -= line_gap
        c.drawString(50, y, f"Roll Number: {context.get('student_roll_number', 'N/A')}")
        y -= line_gap
        c.drawString(50, y, f"Course: {context.get('student_course', 'N/A')}")
        y -= line_gap
        c.drawString(50, y, f"Year/Section: {context.get('student_year_section', 'N/A')}")
        y -= line_gap
        c.drawString(50, y, f"Room: {context.get('room_number', 'N/A')}")
        y -= line_gap
        c.drawString(50, y, f"Phone: {context.get('student_phone', 'N/A')}")
        y -= line_gap
        c.drawString(50, y, f"Email: {context.get('student_email', 'N/A')}")
        y -= 24

        # Payment Info Block
        c.setFont("Helvetica-Bold", 10)
        c.drawString(50, y, "PAYMENT DETAILS")
        y -= 14
        c.setFont("Helvetica", 9)
        c.drawString(50, y, f"Method: {context.get('payment_method', 'N/A')}")
        y -= line_gap
        c.drawString(50, y, f"Transaction ID: {context.get('transaction_id', 'N/A')}")
        y -= line_gap
        c.drawString(50, y, f"Status: {context.get('payment_status', 'PAID')}")
        y -= line_gap
        c.drawString(50, y, f"Description: {context.get('description', 'Hostel Rent')}")
        y -= line_gap
        c.drawString(50, y, f"Amount: ₹{context.get('amount', '0.00')}")
        y -= 24

        # Total
        c.setFont("Helvetica-Bold", 12)
        c.drawString(50, y, f"Total Paid: ₹{context.get('amount', '0.00')}")
        y -= 24

        # Verification
        verification_url = context.get("verification_url")
        if verification_url:
            c.setFont("Helvetica", 8)
            c.drawString(50, y, f"Verify: {verification_url}")
            y -= line_gap

        # Footer
        c.setFont("Helvetica", 8)
        c.drawString(50, y, f"Generated: {context.get('generated_on', 'N/A')}")
        y -= line_gap
        c.drawString(50, y, "This is a computer-generated receipt and does not require a signature.")

        c.showPage()
        c.save()
        buffer.seek(0)
        return buffer

    @staticmethod
    async def generate_receipt_pdf(payment_id: str) -> BytesIO:
        """
        Generates a professional PDF receipt for a payment.
        Fetches hostel info, tenant academic details, room info, and payment metadata.
        Returns a BytesIO object for the PDF.
        """
        # Fetch payment with all related data
        res = supabase.table("payments").select(
            "id, created_at, amount_paid, payment_method, reference_number, receipt_number, owner_id, obligation_id, "
            "rent_obligations(id, rent_month, status), "
            "students(id, room_id, permanent_address, temporary_address, roll_number, course, year_of_study, section, branch, phone_1, "
            "  profiles!students_profile_id_fkey(name, email, phone))"
        ).eq("id", payment_id).single().execute()
        
        if not res.data:
            raise ValueError(f"Payment not found for id {payment_id}")
            
        payment = res.data
        student = payment.get("students") or {}
        profile = student.get("profiles") or {}
        obligation = payment.get("rent_obligations") or {}

        # Resolve room number from students.room_id
        room_no = "N/A"
        try:
            room_id = student.get("room_id")
            if room_id:
                room_res = supabase.table("rooms").select("room_no").eq("id", room_id).single().execute()
                if room_res.data:
                    room_no = room_res.data.get("room_no") or "N/A"
        except Exception:
            room_no = "N/A"

        # Resolve hostel details using owner_id (payments has owner_id)
        hostel = {}
        owner_profile = {}
        try:
            owner_id = payment.get("owner_id")
            if owner_id:
                hostel_res = supabase.table("hostels").select("name, address, city, state, pincode, phone, logo_url").eq("owner_id", owner_id).single().execute()
                if hostel_res.data:
                    hostel = hostel_res.data
                owner_res = supabase.table("profiles").select("email, phone").eq("id", owner_id).single().execute()
                if owner_res.data:
                    owner_profile = owner_res.data
        except Exception:
            hostel = {}
            owner_profile = {}

        # Format dates
        created_at = payment.get("created_at")
        receipt_tz = ReceiptService._get_receipt_timezone()
        try:
            if created_at:
                created_dt = datetime.fromisoformat(str(created_at).replace("Z", "+00:00"))
                if created_dt.tzinfo is None:
                    created_dt = created_dt.replace(tzinfo=timezone.utc)
                formatted_date = created_dt.astimezone(receipt_tz).strftime("%d %b %Y")
            else:
                formatted_date = datetime.now(receipt_tz).strftime("%d %b %Y")
        except Exception:
            formatted_date = str(created_at or datetime.now(receipt_tz).date())

        # Format rent month
        rent_month_str = "N/A"
        try:
            rent_month = obligation.get("rent_month")
            if rent_month:
                if isinstance(rent_month, str):
                    parsed = datetime.fromisoformat(rent_month.replace("Z", "+00:00"))
                else:
                    parsed = rent_month
                rent_month_str = parsed.strftime("%B %Y")
        except Exception:
            pass

        # Get student address (prefer temporary)
        student_address = (
            student.get("temporary_address")
            or student.get("permanent_address")
            or "N/A"
        )

        # Get phone (prefer phone_1 from students table, fallback to profile)
        student_phone = student.get("phone_1") or profile.get("phone") or "N/A"

        # Year and section
        year_of_study = student.get("year_of_study") or "N/A"
        section = student.get("section") or ""
        year_section = f"Year {year_of_study}, {section}" if section and year_of_study != "N/A" else f"Year {year_of_study}"

        transaction_id = payment.get("reference_number") or "N/A"
        amount_formatted = ReceiptService._format_currency(payment.get("amount_paid"))

        # Default hostel info from env if not in DB
        hostel_name = hostel.get("name") or os.getenv("RECEIPT_COMPANY_NAME", "Trishul Hostel Management")
        hostel_phone = hostel.get("phone") or owner_profile.get("phone") or os.getenv("RECEIPT_SUPPORT_PHONE", "+91 9876543210")
        hostel_email = owner_profile.get("email") or os.getenv("RECEIPT_SUPPORT_EMAIL", "support@trishul.com")

        hostel_address_parts = [
            hostel.get("address"),
            hostel.get("city"),
            hostel.get("state"),
            hostel.get("pincode"),
        ]
        hostel_address = ", ".join([part for part in hostel_address_parts if part]) or os.getenv("RECEIPT_COMPANY_ADDRESS", "Hyderabad, India")

        verify_base_url = os.getenv("RECEIPT_VERIFY_BASE_URL", "")
        verification_url = f"{verify_base_url.rstrip('/')}/{payment_id}" if verify_base_url else ""

        template_path = ReceiptService._resolve_template_path()
        if not template_path.exists():
            raise FileNotFoundError(f"Receipt template not found: {template_path}")

        # Build professional receipt context
        receipt_month = ""
        try:
            receipt_month = datetime.fromisoformat(str(created_at).replace("Z", "+00:00")).astimezone(receipt_tz).strftime("%Y-%m")
        except Exception:
            receipt_month = datetime.now(receipt_tz).strftime("%Y-%m")

        render_context = dict(
            receipt_no=f"REC-{receipt_month}-{str(payment.get('receipt_number', 1)).zfill(5)}",  # e.g., REC-2026-04-00012
            date=formatted_date,
            rent_month=rent_month_str,
            
            # Hostel info
            hostel_name=hostel_name,
            hostel_address=hostel_address,
            hostel_email=hostel_email,
            hostel_phone=hostel_phone,
            hostel_logo_url=hostel.get("logo_url") or os.getenv("RECEIPT_LOGO_URL", ""),
            
            # Student/Tenant info
            student_name=profile.get("name") or "N/A",
            student_roll_number=student.get("roll_number") or "N/A",
            student_course=student.get("course") or "N/A",
            student_year_section=year_section,
            room_number=room_no or "N/A",
            student_phone=student_phone,
            student_address=student_address,
            student_email=profile.get("email") or "N/A",
            
            # Payment info
            payment_method=ReceiptService._normalize_payment_method(payment.get("payment_method")),
            payment_status=obligation.get("status") or "PAID",
            transaction_id=transaction_id,
            payment_gateway=ReceiptService._detect_payment_gateway(transaction_id),
            issued_by=os.getenv("RECEIPT_ISSUED_BY", "Hostel Management System"),
            description=ReceiptService._build_description(obligation),
            amount=amount_formatted,
            
            # Footer
            verification_url=verification_url,
            generated_on=datetime.now(receipt_tz).strftime("%d %b %Y, %I:%M %p"),
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
        Verify if a receipt exists and return comprehensive payment metadata.
        Intended for public verification links/QR checks.
        """
        res = supabase.table("payments").select(
            "id, created_at, amount_paid, payment_method, reference_number, receipt_number, owner_id, "
            "rent_obligations(rent_month, status), "
            "students(id, room_id, roll_number, course, year_of_study, section, profiles!students_profile_id_fkey(name))"
        ).eq("id", payment_id).single().execute()

        if not res.data:
            return {
                "valid": False,
                "receipt_no": payment_id,
                "message": "Receipt not found"
            }

        payment = res.data
        obligation = payment.get("rent_obligations") or {}
        student = payment.get("students") or {}
        profile = student.get("profiles") or {}
        # Resolve room number
        room_no = "N/A"
        try:
            room_id = student.get("room_id")
            if room_id:
                room_res = supabase.table("rooms").select("room_no").eq("id", room_id).single().execute()
                if room_res.data:
                    room_no = room_res.data.get("room_no") or "N/A"
        except Exception:
            room_no = "N/A"

        # Resolve hostel name from owner_id
        hostel_name = "N/A"
        try:
            owner_id = payment.get("owner_id")
            if owner_id:
                hostel_res = supabase.table("hostels").select("name").eq("owner_id", owner_id).single().execute()
                if hostel_res.data:
                    hostel_name = hostel_res.data.get("name") or "N/A"
        except Exception:
            hostel_name = "N/A"

        created_at = payment.get("created_at")
        try:
            issued_on = datetime.fromisoformat(str(created_at).replace("Z", "+00:00")).isoformat() if created_at else None
        except Exception:
            issued_on = str(created_at) if created_at else None

        # Format rent month
        rent_month_str = ""
        try:
            rent_month = obligation.get("rent_month")
            if rent_month:
                if isinstance(rent_month, str):
                    parsed = datetime.fromisoformat(rent_month.replace("Z", "+00:00"))
                else:
                    parsed = rent_month
                rent_month_str = parsed.strftime("%B %Y")
        except Exception:
            pass

        return {
            "valid": True,
            "receipt_no": payment.get("id"),
            "issued_on": issued_on,
            "hostel": hostel_name or "N/A",
            "tenant": profile.get("name") or "N/A",
            "roll_number": student.get("roll_number") or "N/A",
            "room_number": room_no or "N/A",
            "amount": ReceiptService._format_currency(payment.get("amount_paid")),
            "currency": "INR",
            "rent_month": rent_month_str,
            "payment_method": ReceiptService._normalize_payment_method(payment.get("payment_method")),
            "transaction_id": payment.get("reference_number") or "N/A",
            "status": obligation.get("status") or "PAID",
            "description": ReceiptService._build_description(obligation),
        }

    @staticmethod
    def _get_receipt_storage_path(payment_id: str, owner_id: str, created_at: datetime) -> str:
        """
        Generate consistent storage path for receipt PDF.
        Format: receipts/YYYY-MM/hostel_id/payment_id.pdf
        """
        try:
            if isinstance(created_at, str):
                dt = datetime.fromisoformat(str(created_at).replace("Z", "+00:00"))
            else:
                dt = created_at
            month_str = dt.strftime("%Y-%m")
        except Exception:
            month_str = datetime.now().strftime("%Y-%m")
        
        return f"receipts/{month_str}/{owner_id}/{payment_id}.pdf"

    @staticmethod
    async def cache_receipt_pdf(payment_id: str, pdf_bytes: bytes, owner_id: str, created_at: str) -> str:
        """
        Cache generated receipt PDF to Supabase storage.
        Returns the public URL or storage path.
        """
        try:
            storage_path = ReceiptService._get_receipt_storage_path(payment_id, owner_id, created_at)
            
            # Upload PDF to Supabase storage
            res = supabase.storage.from_("receipts").upload(
                path=storage_path,
                file=pdf_bytes,
                file_options={"content-type": "application/pdf"}
            )
            
            # Get public URL
            public_url = supabase.storage.from_("receipts").get_public_url(storage_path)
            
            # Update payment record with cached URL and timestamp
            supabase.table("payments").update({
                "receipt_pdf_url": public_url,
                "receipt_pdf_generated_at": datetime.now(timezone.utc).isoformat()
            }).eq("id", payment_id).execute()
            
            logger.info(f"Receipt PDF cached for payment {payment_id}: {public_url}")
            return public_url
            
        except Exception as e:
            logger.warning(f"Failed to cache receipt PDF for payment {payment_id}: {e}")
            # Return None - caller should generate on-demand
            return None

    @staticmethod
    async def get_or_generate_receipt_pdf(payment_id: str) -> tuple[BytesIO, bool]:
        """
        Get cached receipt PDF if available, otherwise generate new one.
        Returns (BytesIO, is_cached) tuple.
        """
        try:
            # Check if cached
            res = supabase.table("payments").select(
                "id, receipt_pdf_url, receipt_pdf_generated_at, owner_id, created_at"
            ).eq("id", payment_id).single().execute()
            
            if not res.data:
                raise ValueError(f"Payment not found for id {payment_id}")
            
            payment = res.data
            cached_url = payment.get("receipt_pdf_url")
            
            # If cached and recent (< 30 days), use cached version
            if cached_url and payment.get("receipt_pdf_generated_at"):
                try:
                    gen_dt = datetime.fromisoformat(str(payment.get("receipt_pdf_generated_at")).replace("Z", "+00:00"))
                    now = datetime.now(timezone.utc)
                    age_days = (now - gen_dt).days
                    
                    if age_days < 30:
                        # Download cached PDF
                        storage_path = ReceiptService._get_receipt_storage_path(
                            payment_id,
                            payment.get("owner_id"),
                            payment.get("created_at")
                        )
                        
                        cached_bytes = supabase.storage.from_("receipts").download(storage_path)
                        return BytesIO(cached_bytes), True
                except Exception as e:
                    logger.warning(f"Failed to retrieve cached receipt for {payment_id}: {e}. Regenerating...")
            
            # Generate new PDF
            pdf_buffer = await ReceiptService.generate_receipt_pdf(payment_id)
            pdf_bytes = pdf_buffer.getvalue()
            
            # Try to cache it
            await ReceiptService.cache_receipt_pdf(
                payment_id,
                pdf_bytes,
                payment.get("owner_id"),
                payment.get("created_at")
            )
            
            return BytesIO(pdf_bytes), False
            
        except Exception as e:
            logger.exception(f"Error in get_or_generate_receipt_pdf for {payment_id}: {e}")
            # Fallback: generate without caching
            return await ReceiptService.generate_receipt_pdf(payment_id), False

