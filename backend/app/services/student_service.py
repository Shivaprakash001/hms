from app.db import supabase
from typing import Optional, Dict, Any
from datetime import date
from postgrest.exceptions import APIError
from app.utils.responses import ServiceResponse, ErrorCode
from app.utils.logger import get_logger
from app.utils.hooks import trigger_hook
from app.schemas.student_schema import StudentCreate, StudentStatus, VALID_STATUS_TRANSITIONS
from decimal import Decimal

logger = get_logger(__name__)


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
            .select("*, profiles(*), room_allocations(*, rooms(*))")\
            .eq("id", student_id)\
            .execute()
        
        if not result.data:
            logger.warning(f"Student not found: {student_id}")
            return ServiceResponse.not_found("Student")
        
        student = result.data[0]
        
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
        
        return ServiceResponse.success(student)
        
    except Exception as e:
        logger.exception(f"Error fetching student {student_id}: {e}")
        return ServiceResponse.error(ErrorCode.DB_QUERY_ERROR, "Failed to fetch student", str(e))


def get_student_by_profile(
    profile_id: str,
    requesting_user_id: Optional[str] = None,
    requesting_user_role: Optional[str] = None
) -> Dict[str, Any]:
    """Get student by profile ID - very useful endpoint"""
    try:
        logger.debug(f"Fetching student by profile: {profile_id}")
        
        result = supabase.table("students")\
            .select("*, profiles(*), room_allocations(*, rooms(*))")\
            .eq("profile_id", profile_id)\
            .execute()
        
        if not result.data:
            return ServiceResponse.not_found("Student")
        
        student = result.data[0]
        
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
    requesting_user_role: Optional[str] = None
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
            .select("*, profiles(*), room_allocations(*, rooms(*))", count="exact")
        
        # Apply filters
        if status:
            query = query.eq("status", status)
        
        if joined_after:
            query = query.gte("joined_on", joined_after.isoformat())
        
        if joined_before:
            query = query.lte("joined_on", joined_before.isoformat())
        
        # Search by name or email (requires profile join)
        if search:
            # Note: This is a simplified search. For production, use full-text search
            query = query.or_(f"profiles.name.ilike.%{search}%,profiles.email.ilike.%{search}%")
        
        # Pagination
        query = query.limit(limit).offset(offset)
        
        # Order by joined date descending
        query = query.order("joined_on", desc=True)
        
        result = query.execute()
        
        # Process active room for each student
        students_data = []
        for student in result.data:
            # Normalize profile
            if "profiles" in student:
                student["profile"] = student.pop("profiles")
            
            if "room_allocations" in student:
                allocations = student.pop("room_allocations")
                active_allocation = next((a for a in allocations if a.get("end_date") is None), None)
                if active_allocation:
                    student["current_room"] = active_allocation.get("rooms")
                else:
                    student["current_room"] = None
            students_data.append(student)
        
        return ServiceResponse.success({
            "students": students_data,
            "total": result.count if hasattr(result, 'count') else len(result.data),
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
        
        # Perform update
        result = supabase.table("students")\
            .update(update_data)\
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
    - Admin only
    """
    try:
        # Authorization check - only admin can delete
        if requesting_user_role != 'admin':
            return ServiceResponse.forbidden(
                "Only administrators can delete student records",
                "Deletion requires admin privileges"
            )
        
        logger.info(f"Soft deleting student {student_id} by user: {deleted_by}")
        
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
