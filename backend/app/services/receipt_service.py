import os
from io import BytesIO
from datetime import datetime
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from reportlab.lib import colors
from app.db import supabase
from app.utils.logger import get_logger

logger = get_logger(__name__)

class ReceiptService:
    @staticmethod
    async def generate_receipt_pdf(payment_id: str) -> BytesIO:
        """
        Generates a PDF receipt for a payment.
        Returns a BytesIO object for the PDF.
        """
        # Fetch payment info
        res = supabase.table("payments").select(
            "*, rent_obligations(*, room_allocations(*, rooms(room_number))), students(*, profiles(name, email, phone))"
        ).eq("id", payment_id).execute()
        
        if not res.data:
            raise ValueError(f"Payment not found for format {payment_id}")
            
        payment = res.data[0]
        student = payment.get("students", {})
        profile = student.get("profiles", {}) if student else {}
        obligation = payment.get("rent_obligations", {})
        allocation = obligation.get("room_allocations", {}) if obligation else {}
        room = allocation.get("rooms", {}) if allocation else {}
        
        buffer = BytesIO()
        c = canvas.Canvas(buffer, pagesize=A4)
        width, height = A4
        
        # Header
        c.setFont("Helvetica-Bold", 24)
        c.drawString(50, height - 50, "Payment Receipt")
        
        c.setFont("Helvetica", 12)
        c.drawString(50, height - 80, "Trishul Hostel Management System")
        c.drawString(50, height - 100, f"Receipt No: {payment['id'][:8].upper()}")
        c.drawString(50, height - 120, f"Date: {datetime.now().strftime('%d %b %Y %H:%M')}")
        
        # Tenant Info
        c.setFont("Helvetica-Bold", 14)
        c.drawString(50, height - 160, "Billed To:")
        c.setFont("Helvetica", 12)
        c.drawString(50, height - 180, f"Name: {profile.get('name', 'N/A')}")
        c.drawString(50, height - 200, f"Email: {profile.get('email', 'N/A')}")
        c.drawString(50, height - 220, f"Phone: {profile.get('phone', 'N/A')}")
        c.drawString(50, height - 240, f"Room No: {room.get('room_number', 'N/A')}")
        
        # Payment details box
        c.rect(50, height - 350, 500, 80)
        c.setFont("Helvetica-Bold", 12)
        c.drawString(60, height - 290, "Description")
        c.drawString(250, height - 290, "Method")
        c.drawString(450, height - 290, "Amount")
        
        c.line(50, height - 300, 550, height - 300)
        
        c.setFont("Helvetica", 12)
        desc = f"Rent for {obligation.get('rent_month', 'N/A')}" if obligation else "Payment"
        c.drawString(60, height - 325, desc)
        c.drawString(250, height - 325, str(payment.get('payment_method', 'N/A')))
        c.drawString(450, height - 325, f"₹{payment.get('amount_paid', 0)}")
        
        # Footer text
        c.setFont("Helvetica-Oblique", 10)
        c.drawString(50, 50, "This is a computer-generated receipt.")
        
        c.save()
        buffer.seek(0)
        return buffer
