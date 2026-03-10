from app.db import supabase
from app.services.notification_service import create_notification
from app.utils.logger import get_logger

logger = get_logger(__name__)

def handle_student_enrolled(student_id: str, **kwargs):
    """Notify owner when a new student is enrolled."""
    try:
        res = supabase.table("students").select("owner_id, profile_id, profiles!students_profile_id_fkey(name)").eq("id", student_id).execute()
        if res.data:
            student = res.data[0]
            owner_id = student.get("owner_id")
            student_name = student.get("profiles", {}).get("name", "A new student")
            
            if owner_id:
                create_notification(
                    user_id=owner_id,
                    title="New Tenant Enrolled",
                    message=f"{student_name} has been enrolled in your property.",
                    n_type="TENANT"
                )
    except Exception as e:
        logger.error(f"Error in handle_student_enrolled notification: {e}")

def handle_student_allocated(student_id: str, room_id: str, **kwargs):
    """Notify owner when a student is assigned to a room."""
    try:
        # Get student and room info
        s_res = supabase.table("students").select("owner_id, profiles!students_profile_id_fkey(name)").eq("id", student_id).execute()
        r_res = supabase.table("rooms").select("room_no").eq("id", room_id).execute()
        
        if s_res.data and r_res.data:
            owner_id = s_res.data[0].get("owner_id")
            student_name = s_res.data[0].get("profiles", {}).get("name", "Student")
            room_no = r_res.data[0].get("room_no")
            
            if owner_id:
                create_notification(
                    user_id=owner_id,
                    title="Room Allocated",
                    message=f"{student_name} assigned to Room {room_no}.",
                    n_type="ROOM"
                )
    except Exception as e:
        logger.error(f"Error in handle_student_allocated notification: {e}")

def handle_payment_recorded(amount: float, obligation_id: str, **kwargs):
    """Notify owner when a payment is received."""
    try:
        res = supabase.table("rent_obligations").select("owner_id, students(profiles(name))").eq("id", obligation_id).execute()
        if res.data:
            ob = res.data[0]
            owner_id = ob.get("owner_id")
            student_name = ob.get("students", {}).get("profiles", {}).get("name", "A tenant")
            
            if owner_id:
                create_notification(
                    user_id=owner_id,
                    title="Payment Received",
                    message=f"Received ₹{amount} from {student_name}.",
                    n_type="PAYMENT"
                )
    except Exception as e:
        logger.error(f"Error in handle_payment_recorded notification: {e}")

def handle_complaint_created(owner_id: str, student_id: str, title: str, **kwargs):
    """Notify owner when a new complaint is filed."""
    try:
        res = supabase.table("students").select("profiles(name)").eq("id", student_id).execute()
        student_name = "A tenant"
        if res.data:
            student_name = res.data[0].get("profiles", {}).get("name", "A tenant")
            
        if owner_id:
            create_notification(
                user_id=owner_id,
                title="New Complaint",
                message=f"{student_name} filed a complaint: {title}",
                n_type="COMPLAINT"
            )
    except Exception as e:
        logger.error(f"Error in handle_complaint_created notification: {e}")

def handle_complaint_resolved(complaint_id: str, status: str, **kwargs):
    """Notify student when their complaint is resolved."""
    if status.upper() not in ("RESOLVED", "CLOSED"):
        return
        
    try:
        res = supabase.table("complaints").select("title, students(profile_id)").eq("id", complaint_id).execute()
        if res.data:
            complaint = res.data[0]
            profile_id = complaint.get("students", {}).get("profile_id")
            title = complaint.get("title", "Your complaint")
            
            if profile_id:
                create_notification(
                    user_id=profile_id,
                    title="Complaint Resolved",
                    message=f"Your complaint '{title}' has been marked as resolved.",
                    n_type="COMPLAINT"
                )
    except Exception as e:
        logger.error(f"Error in handle_complaint_resolved notification: {e}")

def handle_rent_generated(student_id: str, amount: float, **kwargs):
    """Notify student when a new rent bill is generated."""
    try:
        res = supabase.table("students").select("profile_id").eq("id", student_id).execute()
        if res.data:
            profile_id = res.data[0].get("profile_id")
            if profile_id:
                create_notification(
                    user_id=profile_id,
                    title="New Rent Bill",
                    message=f"A new rent bill of ₹{amount} has been generated.",
                    n_type="PAYMENT"
                )
    except Exception as e:
        logger.error(f"Error in handle_rent_generated notification: {e}")
