from app.db import supabase
from typing import Optional, Dict, Any
from datetime import date, datetime
from postgrest.exceptions import APIError
from app.utils.responses import ServiceResponse, ErrorCode
from app.utils.logger import get_logger
from app.utils.hooks import trigger_hook
from app.schemas.student_schema import StudentCreate, StudentStatus, VALID_STATUS_TRANSITIONS
from decimal import Decimal

logger = get_logger(__name__)


def _build_payment_summary(student: dict, obligation: Optional[dict], payments: list[dict], latest_payment: Optional[dict]) -> dict:
    obligation_amount = Decimal(str((obligation or {}).get("amount") or 0))
    paid_amount = sum(Decimal(str(payment.get("amount_paid") or 0)) for payment in payments)
    pending_amount = max(Decimal("0"), obligation_amount - paid_amount)

    if obligation:
        obligation_status = str(obligation.get("status") or "PENDING").upper()
        if obligation_status == "WAIVED":
            payment_status = "WAIVED"
        elif pending_amount <= Decimal("0"):
            payment_status = "PAID"
        elif paid_amount > Decimal("0"):
            payment_status = "PARTIAL"
        else:
            payment_status = "PENDING"
    else:
        payment_status = "NOT_GENERATED" if student.get("status") == "ACTIVE" else "INACTIVE"

    return {
        "payment_status": payment_status,
        "current_month_amount": float(obligation_amount),
        "paid_amount": float(paid_amount),
        "pending_amount": float(pending_amount),
        "last_paid_at": latest_payment.get("payment_date") if latest_payment else None,
        "last_paid_amount": float(latest_payment.get("amount_paid") or 0) if latest_payment else 0,
        "current_obligation_id": obligation.get("id") if obligation else None
    }


def _attach_hostel_info(student: dict) -> dict:
    """Attach hostel/owner contact metadata to a student payload."""
    try:
        owner_id = student.get("owner_id")
        if not owner_id:
            student["hostel"] = None
            return student

        owner_res = supabase.table("profiles")\
            .select("id, name, phone, address")\
            .eq("id", owner_id)\
            .eq("is_active", True)\
            .execute()

        if not owner_res.data:
            student["hostel"] = None
            return student

        owner = owner_res.data[0]
        student["hostel"] = {
            "owner_id": owner.get("id"),
            "name": owner.get("name"),
            "phone": owner.get("phone"),
            "address": owner.get("address")
        }
        return student
    except Exception:
        student["hostel"] = None
        return student


def create_student(
    data: dict,
    created_by: Optional[str] = None
) -> Dict[str, Any]:
    """
    Create a new student enrollment.
    
    Business Rules:
    1. Profile must exist and be active
    2. Profile role must be 'student'
    3. Profile cannot already be enrolled as student
    4. joined_on cannot be future date
    5. monthly_rent must be > 0
    
    Args:
        data: Student data dictionary
        created_by: ID of user creating the student
    """
    try:
        profile_id = data.get('profile_id')
        logger.info(f"Creating student enrollment for profile: {profile_id}")
        
        # Rule 1: Check if profile exists and is active
        profile_result = supabase.table("profiles")\
            .select("id, role, is_active, name, email")\
            .eq("id", profile_id)\
            .execute()
        
        if not profile_result.data:
            logger.warning(f"Profile not found: {profile_id}")
            return ServiceResponse.not_found("Profile")
        
        profile = profile_result.data[0]
        
        if not profile.get('is_active'):
            logger.warning(f"Profile is inactive: {profile_id}")
            return ServiceResponse.error(
                ErrorCode.RESOURCE_INACTIVE,
                "Cannot enroll inactive profile",
                "Profile must be active to create student enrollment"
            )
        
        # Rule 3: Profile role must be 'student'
        if profile.get('role') != 'student':
            logger.warning(f"Profile role is not student: {profile.get('role')}")
            return ServiceResponse.forbidden(
                "Cannot create student enrollment for admin or warden",
                f"Profile has role '{profile.get('role')}', only 'student' role can be enrolled"
            )
        
        # Rule 2: Check if profile is already enrolled as student
        existing_student = supabase.table("students")\
            .select("id, status")\
            .eq("profile_id", profile_id)\
            .execute()
        
        if existing_student.data:
            student_status = existing_student.data[0].get('status')
            logger.warning(f"Profile already enrolled as student with status: {student_status}")
            return ServiceResponse.already_exists(
                "Student enrollment",
                f"Profile is already enrolled with status '{student_status}'"
            )
        
        # Create student record
        result = supabase.table("students").insert(data).execute()
        
        if not result.data:
            logger.error("Student creation returned no data")
            return ServiceResponse.error(
                ErrorCode.DB_QUERY_ERROR,
                "Student enrollment failed",
                "No data returned from database"
            )
        
        logger.info(f"Student created successfully: {result.data[0].get('id')}")
        
        # Return with profile info
        student_data = result.data[0]
        student_data['profile'] = profile
        
        # Trigger hooks
        trigger_hook("student_enrolled", student_id=student_data["id"], user_id=created_by)
        
        return ServiceResponse.success(student_data, "Student enrolled successfully")
        
    except APIError as e:
        error_msg = str(e)
        logger.error(f"Database error creating student: {error_msg}")
        
        if "duplicate" in error_msg.lower() or "unique" in error_msg.lower():
            return ServiceResponse.already_exists("Student enrollment", error_msg)
        
        return ServiceResponse.error(
            ErrorCode.DB_CONSTRAINT_VIOLATION,
            "Database constraint violation",
            error_msg
        )
    except Exception as e:
        logger.exception(f"Unexpected error creating student: {e}")
        return ServiceResponse.error(
            ErrorCode.INTERNAL_ERROR,
            "An unexpected error occurred",
            str(e)
        )


def get_student(
    student_id: str,
    requesting_user_id: Optional[str] = None,
    requesting_user_role: Optional[str] = None
) -> Dict[str, Any]:
    """
    Get student by ID with profile information.
    
    Authorization:
    - Admin/Warden: Can view any student
    - Student: Can only view own record
    """
    try:
        logger.debug(f"Fetching student: {student_id}")
        
        # Fetch student with profile join and active allocations
        result = supabase.table("students")\
            .select("*, profiles!students_profile_id_fkey(*), room_allocations(*, rooms(*))")\
            .eq("id", student_id)\
            .execute()
        
        if not result.data:
            logger.warning(f"Student not found: {student_id}")
            return ServiceResponse.not_found("Student")
        
        student = result.data[0]
        
        # Normalize joined profile relation
        if "profiles" in student:
            profile_rel = student.pop("profiles")
            student["profile"] = profile_rel[0] if isinstance(profile_rel, list) and profile_rel else profile_rel

        # Process room allocations to find active one
        if "room_allocations" in student:
            allocations = student.pop("room_allocations")
            active_allocation = next((a for a in allocations if a.get("end_date") is None), None)
            if active_allocation:
                student["current_room"] = active_allocation.get("rooms")
            else:
                student["current_room"] = None
        
        # Authorization check
        if requesting_user_role == 'student':
            # Students can only view their own record
            if str(student.get('profile_id')) != str(requesting_user_id):
                logger.warning(f"Student {requesting_user_id} attempted to view student {student_id}")
                return ServiceResponse.forbidden(
                    "You can only view your own student record",
                    "Students can only access their own information"
                )

            student = _attach_hostel_info(student)
        
        return ServiceResponse.success(student)
        
    except Exception as e:
        logger.exception(f"Error fetching student {student_id}: {e}")
        return ServiceResponse.error(ErrorCode.DB_QUERY_ERROR, "Failed to fetch student", str(e))


def get_owner_tenant_overview(
    student_id: str,
    owner_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    Minimal operational tenant profile for owner room-management views.
    """
    try:
        student_result = get_student(student_id, requesting_user_role="owner")
        if not student_result.get("success"):
            return student_result

        student = student_result.get("data") or {}
        if owner_id and str(student.get("owner_id")) != str(owner_id):
            return ServiceResponse.forbidden("You can only view your own tenants")

        profile = student.get("profile") or {}
        current_room = student.get("current_room") or {}

        from app.services import payment_service
        payment_result = payment_service.get_student_payment_history(student_id)
        if not payment_result.get("success"):
            return payment_result

        payment_data = payment_result.get("data") or {}
        payments = payment_data.get("payments") or []
        total_due = Decimal(str(payment_data.get("total_due") or 0))
        total_paid = Decimal(str(payment_data.get("total_paid") or 0))
        outstanding = Decimal(str(payment_data.get("outstanding_balance") or 0))

        recent_payments = [
            {
                "id": payment.get("id"),
                "amount": float(payment.get("amount_paid") or 0),
                "date": payment.get("payment_date"),
                "method": payment.get("payment_method"),
                "status": "paid",
                "reference_number": payment.get("reference_number")
            }
            for payment in payments[:5]
        ]

        return ServiceResponse.success({
            "id": student.get("id"),
            "name": profile.get("name"),
            "phone": student.get("phone_1") or profile.get("phone"),
            "guardian_phone": student.get("phone_2") or profile.get("emergency_contact"),
            "email": profile.get("email"),
            "roll_number": student.get("roll_number"),
            "course": student.get("course"),
            "year_of_study": student.get("year_of_study"),
            "section": student.get("section"),
            "branch": student.get("branch"),
            "college_name": student.get("college_name"),
            "room_number": current_room.get("room_no") if current_room else None,
            "floor": current_room.get("room_no")[:-2] if current_room and current_room.get("room_no") and len(current_room.get("room_no")) >= 3 else "G",
            "joined_at": student.get("joined_on"),
            "status": student.get("status"),
            "rent": float(student.get("monthly_rent") or 0),
            "total_paid": float(total_paid),
            "total_due": float(total_due),
            "outstanding": float(outstanding),
            "recent_payments": recent_payments
        })

    except Exception as e:
        logger.exception(f"Error fetching owner tenant overview for {student_id}: {e}")
        return ServiceResponse.error(ErrorCode.DB_QUERY_ERROR, "Failed to fetch tenant overview", str(e))


def get_student_by_profile(
    profile_id: str,
    requesting_user_id: Optional[str] = None,
    requesting_user_role: Optional[str] = None
) -> Dict[str, Any]:
    """Get student by profile ID - very useful endpoint"""
    try:
        logger.debug(f"Fetching student by profile: {profile_id}")
        
        result = supabase.table("students")\
            .select("*, profiles!students_profile_id_fkey(*), room_allocations(*, rooms(*))")\
            .eq("profile_id", profile_id)\
            .execute()
        
        if not result.data:
            return ServiceResponse.not_found("Student")
        
        student = result.data[0]
        
        # Normalize joined profile relation
        if "profiles" in student:
            profile_rel = student.pop("profiles")
            student["profile"] = profile_rel[0] if isinstance(profile_rel, list) and profile_rel else profile_rel

        # Process room allocations to find active one
        if "room_allocations" in student:
            allocations = student.pop("room_allocations")
            active_allocation = next((a for a in allocations if a.get("end_date") is None), None)
            if active_allocation:
                student["current_room"] = active_allocation.get("rooms")
            else:
                student["current_room"] = None
        
        # Authorization check
        if requesting_user_role == 'student':
            if str(profile_id) != str(requesting_user_id):
                return ServiceResponse.forbidden(
                    "You can only view your own student record"
                )

        student = _attach_hostel_info(student)
        
        return ServiceResponse.success(student)
        
    except Exception as e:
        logger.exception(f"Error fetching student by profile {profile_id}: {e}")
        return ServiceResponse.error(ErrorCode.DB_QUERY_ERROR, "Failed to fetch student", str(e))


def get_all_students(
    status: Optional[str] = None,
    joined_after: Optional[date] = None,
    joined_before: Optional[date] = None,
    search: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    requesting_user_role: Optional[str] = None,
    owner_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    Get all students with filtering and pagination.
    
    Authorization:
    - Admin/Warden: Can view all students
    - Student: Cannot access this endpoint
    """
    try:
        # Authorization check
        if requesting_user_role == 'student':
            logger.warning("Student attempted to access all students list")
            return ServiceResponse.forbidden(
                "Students cannot view all student records",
                "Only admin and warden can access student list"
            )
        
        logger.debug(f"Fetching students - status: {status}, limit: {limit}, offset: {offset}")
        
        # Build query with profile join and allocations
        query = supabase.table("students")\
            .select("*, profiles!students_profile_id_fkey(*), room_allocations(*, rooms(*))", count="exact")
        
        # Filter by owner if provided (for owner-isolation)
        if owner_id:
            query = query.eq("owner_id", owner_id)
        
        # Apply filters
        if status:
            query = query.eq("status", status)
        
        if joined_after:
            query = query.gte("joined_on", joined_after.isoformat())
        
        if joined_before:
            query = query.lte("joined_on", joined_before.isoformat())
        
        # Note: searching by profile name/email requires fetching all and filtering
        # in Python, since PostgREST .or_() on joined columns is not supported this way
        
        # Pagination
        query = query.limit(limit).offset(offset)
        
        # Order by joined date descending
        query = query.order("joined_on", desc=True)
        
        result = query.execute()

        students_raw = result.data or []
        student_ids = [student.get("id") for student in students_raw if student.get("id")]

        current_month = date.today().replace(day=1).isoformat()
        obligations_by_student = {}
        payments_by_obligation = {}
        latest_payment_by_student = {}

        if student_ids:
            obligation_result = supabase.table("rent_obligations")\
                .select("id, student_id, amount, status, rent_month, due_date")\
                .in_("student_id", student_ids)\
                .eq("rent_month", current_month)\
                .execute()

            for obligation in (obligation_result.data or []):
                obligations_by_student[obligation.get("student_id")] = obligation

            payment_result = supabase.table("payments")\
                .select("id, student_id, obligation_id, amount_paid, payment_date")\
                .in_("student_id", student_ids)\
                .order("payment_date", desc=True)\
                .limit(500)\
                .execute()

            for payment in (payment_result.data or []):
                student_id = payment.get("student_id")
                obligation_id = payment.get("obligation_id")

                if student_id and student_id not in latest_payment_by_student:
                    latest_payment_by_student[student_id] = payment

                if obligation_id:
                    payments_by_obligation.setdefault(obligation_id, []).append(payment)
        
        # Process active room for each student
        students_data = []
        for student in students_raw:
            # Normalize profile
            if "profiles" in student:
                student["profile"] = student.pop("profiles")
            
            if "room_allocations" in student:
                allocations = student.pop("room_allocations")
                # IMPORTANT: only pick allocations with NO end_date (still active)
                # Do NOT use end_date >= today — that shows closed allocations as active
                active_allocation = next(
                    (a for a in allocations if a.get("end_date") is None),
                    None
                )
                if active_allocation:
                    student["current_room"] = active_allocation.get("rooms")
                else:
                    student["current_room"] = None

            
            # Apply in-memory search filter if provided
            if search:
                profile = student.get("profile") or {}
                current_room = student.get("current_room") or {}
                name = (profile.get("name") or "").lower()
                email = (profile.get("email") or "").lower()
                phone = (student.get("phone_1") or profile.get("phone") or "").lower()
                room_no = (current_room.get("room_no") or "").lower()
                roll_no = (student.get("roll_number") or "").lower()
                q = search.lower()
                if q not in name and q not in email and q not in phone and q not in room_no and q not in roll_no:
                    continue

            obligation = obligations_by_student.get(student.get("id"))
            obligation_payments = payments_by_obligation.get((obligation or {}).get("id"), [])
            latest_payment = latest_payment_by_student.get(student.get("id"))
            student["payment_summary"] = _build_payment_summary(student, obligation, obligation_payments, latest_payment)
            
            students_data.append(student)
        
        return ServiceResponse.success({
            "students": students_data,
            "total": len(students_data),
            "limit": limit,
            "offset": offset
        })
        
    except Exception as e:
        logger.exception(f"Error fetching students: {e}")
        return ServiceResponse.error(ErrorCode.DB_QUERY_ERROR, "Failed to fetch students", str(e))


def update_student(
    student_id: str,
    data: dict,
    updated_by: Optional[str] = None,
    requesting_user_role: Optional[str] = None
) -> Dict[str, Any]:
    """
    Update student information.
    
    Business Rules:
    1. Cannot reduce rent below 0
    2. Status changes must follow state machine rules
    3. If status changes to LEFT, must end active room allocation
    
    Authorization:
    - Admin/Warden: Can update
    - Student: Cannot update
    """
    try:
        # Authorization check
        if requesting_user_role == 'student':
            return ServiceResponse.forbidden(
                "Students cannot update student records",
                "Only admin and warden can update student information"
            )
        
        logger.info(f"Updating student {student_id} by user: {updated_by}")
        
        # Get current student data
        current_result = supabase.table("students")\
            .select("*")\
            .eq("id", student_id)\
            .execute()
        
        if not current_result.data:
            return ServiceResponse.not_found("Student")
        
        current_student = current_result.data[0]
        current_status = current_student.get('status')
        
        # Remove None values
        update_data = {k: v for k, v in data.items() if v is not None}
        
        if not update_data:
            return ServiceResponse.validation_error("No valid fields to update")
        
        # Validate status transition if status is being changed
        new_status = update_data.get('status')
        if new_status and new_status != current_status:
            # Check if transition is valid
            valid_transitions = VALID_STATUS_TRANSITIONS.get(StudentStatus(current_status), [])
            
            if StudentStatus(new_status) not in valid_transitions:
                logger.warning(f"Invalid status transition: {current_status} -> {new_status}")
                return ServiceResponse.validation_error(
                    f"Invalid status transition from '{current_status}' to '{new_status}'",
                    f"Valid transitions from '{current_status}': {[s.value for s in valid_transitions]}"
                )
            
            # CRITICAL: If changing to LEFT, must end active room allocation
            if new_status == StudentStatus.LEFT.value:
                logger.info(f"Student {student_id} status changing to LEFT - triggering auto-deallocation hook")
                trigger_hook("student_left", student_id=student_id, user_id=updated_by)
        
        # Sanitize types for Supabase JSON serialization (Decimal, date -> str)
        import datetime as _dt
        from decimal import Decimal as _Dec
        sanitized = {}
        for k, v in update_data.items():
            if isinstance(v, _Dec):
                sanitized[k] = str(v)
            elif isinstance(v, (_dt.datetime, _dt.date)):
                sanitized[k] = v.isoformat()
            else:
                sanitized[k] = v

        # Perform update
        result = supabase.table("students")\
            .update(sanitized)\
            .eq("id", student_id)\
            .execute()
        
        if not result.data:
            return ServiceResponse.not_found("Student")
        
        logger.info(f"Student updated successfully: {student_id}")
        return ServiceResponse.success(result.data[0], "Student updated successfully")
        
    except APIError as e:
        error_msg = str(e)
        logger.error(f"Database error updating student {student_id}: {error_msg}")
        return ServiceResponse.error(ErrorCode.DB_CONSTRAINT_VIOLATION, "Database constraint violation", error_msg)
        
    except Exception as e:
        logger.exception(f"Unexpected error updating student {student_id}: {e}")
        return ServiceResponse.error(ErrorCode.INTERNAL_ERROR, "An unexpected error occurred", str(e))


def delete_student(
    student_id: str,
    deleted_by: Optional[str] = None,
    requesting_user_role: Optional[str] = None
) -> Dict[str, Any]:
    """
    Soft delete student by setting status to LEFT.
    NEVER removes the row - this is critical for audit trail.
    
    Authorization:
    - Admin or Owner
    """
    try:
        # Authorization check - only admin or owner can delete
        if requesting_user_role not in ('admin', 'owner'):
            return ServiceResponse.forbidden(
                "Only administrators or owners can delete student records",
                "Deletion requires elevated privileges"
            )
        
        logger.info(f"Soft deleting student {student_id} by user: {deleted_by}")
        
        # Ownership check for owners
        if requesting_user_role == 'owner':
            check_res = supabase.table("students").select("owner_id").eq("id", student_id).execute()
            if not check_res.data:
                return ServiceResponse.not_found("Student")
            if str(check_res.data[0].get("owner_id")) != str(deleted_by):
                logger.warning(f"Owner {deleted_by} attempted to delete student {student_id} belonging to {check_res.data[0].get('owner_id')}")
                return ServiceResponse.forbidden("You can only delete your own tenants")

        # Soft delete: set status to LEFT
        result = supabase.table("students")\
            .update({"status": StudentStatus.LEFT.value})\
            .eq("id", student_id)\
            .execute()
        
        if not result.data:
            return ServiceResponse.not_found("Student")
        
        logger.info(f"Student soft deleted successfully: {student_id}")
        trigger_hook("student_left", student_id=student_id, user_id=deleted_by)
        
        return ServiceResponse.success(result.data[0], "Student marked as LEFT")
        
    except Exception as e:
        logger.exception(f"Error deleting student {student_id}: {e}")
        return ServiceResponse.error(ErrorCode.DB_QUERY_ERROR, "Failed to delete student", str(e))


def reactivate_student(
    student_id: str,
    monthly_rent: Decimal,
    joined_on: date,
    reactivated_by: Optional[str] = None,
    requesting_user_role: Optional[str] = None
) -> Dict[str, Any]:
    """
    Reactivate a student who has LEFT status.
    
    Business Rules:
    - Student must have LEFT status
    - Cannot reactivate from other statuses
    
    Authorization:
    - Admin/Warden can reactivate
    """
    try:
        # Authorization check
        if requesting_user_role == 'student':
            return ServiceResponse.forbidden(
                "Students cannot reactivate student records"
            )
        
        logger.info(f"Reactivating student {student_id} by user: {reactivated_by}")
        
        # Get current student
        current_result = supabase.table("students")\
            .select("*")\
            .eq("id", student_id)\
            .execute()
        
        if not current_result.data:
            return ServiceResponse.not_found("Student")
        
        current_student = current_result.data[0]
        current_status = current_student.get('status')
        
        # Can only reactivate if status is LEFT
        if current_status != StudentStatus.LEFT.value:
            logger.warning(f"Cannot reactivate student with status: {current_status}")
            return ServiceResponse.validation_error(
                f"Cannot reactivate student with status '{current_status}'",
                "Only students with LEFT status can be reactivated"
            )
        
        # Reactivate
        result = supabase.table("students")\
            .update({
                "status": StudentStatus.ACTIVE.value,
                "monthly_rent": str(monthly_rent),
                "joined_on": joined_on.isoformat()
            })\
            .eq("id", student_id)\
            .execute()
        
        if not result.data:
            return ServiceResponse.not_found("Student")
        
        logger.info(f"Student reactivated successfully: {student_id}")
        trigger_hook("student_reactivated", student_id=student_id, user_id=reactivated_by)
        return ServiceResponse.success(result.data[0], "Student reactivated successfully")
        
    except Exception as e:
        logger.exception(f"Error reactivating student {student_id}: {e}")
        return ServiceResponse.error(ErrorCode.DB_QUERY_ERROR, "Failed to reactivate student", str(e))


def update_student_self_profile(
    profile_id: str,
    data: dict,
    updated_by: Optional[str] = None
) -> Dict[str, Any]:
    """
    Update current student's own profile (profiles + students extended fields).
    """
    try:
        # Resolve student by profile
        student_res = supabase.table("students")\
            .select("id, profile_id")\
            .eq("profile_id", profile_id)\
            .execute()

        if not student_res.data:
            return ServiceResponse.not_found("Student")

        student_id = student_res.data[0].get("id")

        profile_fields = {
            "name", "email", "phone", "address"
        }
        student_fields = {
            "photo_url", "phone_1", "phone_2", "phone_3", "personal_email",
            "college_name", "roll_number", "course", "year_of_study", "section", "branch", "office_name", "office_location", "job_role",
            "permanent_address", "temporary_address"
        }

        profile_update = {k: v for k, v in data.items() if k in profile_fields and v is not None}
        student_update = {k: v for k, v in data.items() if k in student_fields and v is not None}

        # Backward-compatible mapping: emergency_contact is stored on students.phone_2
        # because many deployments do not have profiles.emergency_contact column.
        if data.get("emergency_contact") is not None and "phone_2" not in student_update:
            student_update["phone_2"] = data.get("emergency_contact")

        if not profile_update and not student_update:
            return ServiceResponse.validation_error("No valid fields to update")

        # Update profiles table
        if profile_update:
            p_res = supabase.table("profiles")\
                .update(profile_update)\
                .eq("id", profile_id)\
                .eq("is_active", True)\
                .execute()
            if not p_res.data:
                return ServiceResponse.not_found("Profile")

        # Update students table
        if student_update:
            s_res = supabase.table("students")\
                .update(student_update)\
                .eq("id", student_id)\
                .execute()
            if not s_res.data:
                return ServiceResponse.not_found("Student")

        # Return fresh merged record
        fresh = get_student_by_profile(
            profile_id=profile_id,
            requesting_user_id=profile_id,
            requesting_user_role='student'
        )

        if not fresh.get("success"):
            return fresh

        student = fresh.get("data") or {}
        profile = student.get("profile") or {}

        # Shared completion rule for onboarding + profile edit
        # (single source of truth)
        has_aadhaar = False
        try:
            doc_res = supabase.table("identification_documents") \
                .select("id") \
                .eq("tenant_id", student_id) \
                .eq("doc_type", "AADHAR") \
                .limit(1) \
                .execute()
            has_aadhaar = bool(doc_res.data)
        except Exception as doc_err:
            logger.warning(f"Failed Aadhaar completion check for student {student_id}: {doc_err}")

        is_complete = all([
            bool((profile.get("name") or "").strip()),
            bool((profile.get("email") or "").strip()),
            bool((profile.get("phone") or student.get("phone_1") or "").strip()),
            bool((student.get("phone_2") or profile.get("emergency_contact") or "").strip()),
            bool((student.get("college_name") or "").strip()),
            bool((student.get("roll_number") or "").strip()),
            bool(student.get("year_of_study")),
            bool((student.get("branch") or "").strip()),
            bool((student.get("temporary_address") or student.get("permanent_address") or profile.get("address") or "").strip()),
            has_aadhaar,
        ])

        if is_complete:
            try:
                supabase.table("profiles") \
                    .update({"is_profile_completed": True}) \
                    .eq("id", profile_id) \
                    .execute()
                if isinstance(student.get("profile"), dict):
                    student["profile"]["is_profile_completed"] = True
            except Exception as complete_err:
                logger.warning(f"Failed to mark profile completed for {profile_id}: {complete_err}")

            # Keep completion state in students table too (new canonical flag).
            try:
                supabase.table("students") \
                    .update({"profile_completed": True}) \
                    .eq("id", student_id) \
                    .execute()
                student["profile_completed"] = True
            except Exception as stu_complete_err:
                logger.warning(f"Failed to mark student.profile_completed for {student_id}: {stu_complete_err}")

        return ServiceResponse.success(student)
    except Exception as e:
        logger.exception(f"Error updating self profile for {profile_id}: {e}")
        return ServiceResponse.error(ErrorCode.DB_QUERY_ERROR, "Failed to update profile", str(e))


def complete_student_self_profile(
    profile_id: str,
    data: dict,
    aadhaar_file_bytes: bytes,
    aadhaar_filename: str,
    aadhaar_content_type: Optional[str] = None
) -> Dict[str, Any]:
    """
    Complete current student's onboarding profile using the same contract as /students/me/profile.
    Updates profile+student fields and uploads Aadhaar in one flow.
    """
    try:
        required_checks = {
            "name": bool((data.get("name") or "").strip()),
            "phone": bool((data.get("phone") or "").strip()),
            "emergency_contact": bool((data.get("emergency_contact") or "").strip()),
            "college_name": bool((data.get("college_name") or "").strip()),
            "roll_number": bool((data.get("roll_number") or "").strip()),
            "year_of_study": bool(data.get("year_of_study")),
            "branch": bool((data.get("branch") or "").strip()),
            "address": bool((data.get("temporary_address") or data.get("permanent_address") or data.get("address") or "").strip()),
            "aadhaar_file": bool(aadhaar_file_bytes),
        }

        missing = [k for k, ok in required_checks.items() if not ok]
        if missing:
            return ServiceResponse.validation_error(
                "Missing required onboarding fields",
                f"Required: {', '.join(missing)}"
            )

        # Step 1: update profile + student fields via shared path
        update_result = update_student_self_profile(
            profile_id=profile_id,
            data=data,
            updated_by=profile_id
        )
        if not update_result.get("success"):
            return update_result

        student_payload = update_result.get("data") or {}
        student_id = student_payload.get("id")
        if not student_id:
            student_res = supabase.table("students") \
                .select("id") \
                .eq("profile_id", profile_id) \
                .limit(1) \
                .execute()
            if not student_res.data:
                return ServiceResponse.not_found("Student")
            student_id = student_res.data[0].get("id")

        # Step 2: upload Aadhaar document in shared documents table
        from app.services import document_service

        doc_result = document_service.upload_document(
            tenant_id=str(student_id),
            doc_type="AADHAR",
            document_number=None,
            file_bytes=aadhaar_file_bytes,
            filename=aadhaar_filename,
            content_type=aadhaar_content_type,
            uploaded_by=profile_id,
            requesting_user_id=profile_id,
            requesting_user_role="student"
        )
        if not doc_result.get("success"):
            return doc_result

        # Step 3: refresh/update once more so completion checks include Aadhaar presence.
        final_result = update_student_self_profile(
            profile_id=profile_id,
            data=data,
            updated_by=profile_id
        )
        if not final_result.get("success"):
            return final_result

        return ServiceResponse.success(final_result.get("data"), "Profile completed successfully")
    except Exception as e:
        logger.exception(f"Error completing self profile for {profile_id}: {e}")
        return ServiceResponse.error(ErrorCode.INTERNAL_ERROR, "Failed to complete profile", str(e))
