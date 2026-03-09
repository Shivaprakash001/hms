from app.db import supabase
from typing import Optional, Dict, Any
from postgrest.exceptions import APIError
from app.utils.responses import ServiceResponse, ErrorCode
from app.utils.logger import get_logger

logger = get_logger(__name__)


def create_profile(data: dict, created_by: Optional[str] = None) -> Dict[str, Any]:
    """
    Create a new profile in the database.
    
    Args:
        data: Profile data dictionary
        created_by: ID of user creating the profile (for audit trail)
    """
    try:
        logger.info(f"Creating profile for email: {data.get('email')}")
        result = supabase.table("profiles").insert(data).execute()
        
        if not result.data:
            logger.error("Profile creation returned no data")
            return ServiceResponse.error(
                ErrorCode.DB_QUERY_ERROR,
                "Profile creation failed",
                "No data returned from database"
            )
        
        logger.info(f"Profile created successfully: {result.data[0].get('id')}")
        return ServiceResponse.success(result.data[0], "Profile created successfully")
        
    except APIError as e:
        error_msg = str(e)
        logger.error(f"Database error creating profile: {error_msg}")
        
        # Check for unique constraint violation
        if "duplicate" in error_msg.lower() or "unique" in error_msg.lower():
            return ServiceResponse.already_exists("Profile with this email", error_msg)
        
        return ServiceResponse.error(
            ErrorCode.DB_CONSTRAINT_VIOLATION,
            "Database constraint violation",
            error_msg
        )
    except Exception as e:
        logger.exception(f"Unexpected error creating profile: {e}")
        return ServiceResponse.error(
            ErrorCode.INTERNAL_ERROR,
            "An unexpected error occurred",
            str(e)
        )


def get_profile(profile_id: str) -> Dict[str, Any]:
    """Get a single active profile by ID."""
    try:
        logger.debug(f"Fetching profile: {profile_id}")
        result = supabase.table("profiles")\
            .select("*")\
            .eq("id", profile_id)\
            .eq("is_active", True)\
            .execute()
        
        if not result.data:
            logger.warning(f"Profile not found: {profile_id}")
            return ServiceResponse.not_found("Profile")
        
        return ServiceResponse.success(result.data[0])
        
    except Exception as e:
        logger.exception(f"Error fetching profile {profile_id}: {e}")
        return ServiceResponse.error(ErrorCode.DB_QUERY_ERROR, "Failed to fetch profile", str(e))


def get_profile_by_email(email: str) -> Dict[str, Any]:
    """Get an active profile by email address."""
    try:
        logger.debug(f"Fetching profile by email: {email}")
        result = supabase.table("profiles")\
            .select("*")\
            .eq("email", email)\
            .eq("is_active", True)\
            .execute()
        
        if not result.data:
            return ServiceResponse.not_found("Profile")
        
        return ServiceResponse.success(result.data[0])
        
    except Exception as e:
        logger.exception(f"Error fetching profile by email {email}: {e}")
        return ServiceResponse.error(ErrorCode.DB_QUERY_ERROR, "Failed to fetch profile", str(e))


def get_all_profiles(
    role: Optional[str] = None,
    limit: Optional[int] = None,
    offset: Optional[int] = 0,
    include_inactive: bool = False
) -> Dict[str, Any]:
    """
    Get all profiles with optional filtering and pagination.
    
    Args:
        role: Filter by role (student, admin, warden)
        limit: Maximum number of results to return
        offset: Number of results to skip
        include_inactive: Include soft-deleted profiles (admin only)
    """
    try:
        logger.debug(f"Fetching profiles - role: {role}, limit: {limit}, offset: {offset}")
        query = supabase.table("profiles").select("*", count="exact")
        
        # Filter by active status unless explicitly including inactive
        if not include_inactive:
            query = query.eq("is_active", True)
        
        # Apply role filter if provided
        if role:
            query = query.eq("role", role)
        
        # Apply pagination
        if limit:
            query = query.limit(limit)
        if offset:
            query = query.offset(offset)
        
        # Order by created_at descending
        query = query.order("created_at", desc=True)
        
        result = query.execute()
        
        return ServiceResponse.success({
            "profiles": result.data,
            "count": result.count if hasattr(result, 'count') else len(result.data),
            "limit": limit,
            "offset": offset
        })
        
    except Exception as e:
        logger.exception(f"Error fetching profiles: {e}")
        return ServiceResponse.error(ErrorCode.DB_QUERY_ERROR, "Failed to fetch profiles", str(e))


def update_profile(
    profile_id: str,
    data: dict,
    updated_by: Optional[str] = None,
    is_admin: bool = False
) -> Dict[str, Any]:
    """
    Update a profile by ID.
    
    Args:
        profile_id: Profile ID to update
        data: Update data dictionary
        updated_by: ID of user performing the update
        is_admin: Whether the user is an admin (for role changes)
    """
    try:
        logger.info(f"Updating profile {profile_id} by user: {updated_by}")
        
        # Remove None values from update data
        update_data = {k: v for k, v in data.items() if v is not None}
        
        if not update_data:
            return ServiceResponse.validation_error("No valid fields to update")
        
        # Check if role change is attempted by non-admin
        if 'role' in update_data and not is_admin:
            logger.warning(f"Non-admin user attempted role change for profile {profile_id}")
            return ServiceResponse.forbidden(
                "Only administrators can change user roles",
                "Role changes require admin privileges"
            )
        
        # Single update query (no pre-check) - database will handle if not found
        result = supabase.table("profiles")\
            .update(update_data)\
            .eq("id", profile_id)\
            .eq("is_active", True)\
            .execute()
        
        if not result.data:
            logger.warning(f"Profile not found or inactive: {profile_id}")
            return ServiceResponse.not_found("Profile")
        
        logger.info(f"Profile updated successfully: {profile_id}")
        return ServiceResponse.success(result.data[0], "Profile updated successfully")
        
    except APIError as e:
        error_msg = str(e)
        logger.error(f"Database error updating profile {profile_id}: {error_msg}")
        
        if "duplicate" in error_msg.lower() or "unique" in error_msg.lower():
            return ServiceResponse.already_exists("Profile with this email", error_msg)
        
        return ServiceResponse.error(ErrorCode.DB_CONSTRAINT_VIOLATION, "Database constraint violation", error_msg)
        
    except Exception as e:
        logger.exception(f"Unexpected error updating profile {profile_id}: {e}")
        return ServiceResponse.error(ErrorCode.INTERNAL_ERROR, "An unexpected error occurred", str(e))


def delete_profile(profile_id: str, deleted_by: Optional[str] = None) -> Dict[str, Any]:
    """
    Soft delete a profile by ID (sets is_active = false).
    
    Args:
        profile_id: Profile ID to delete
        deleted_by: ID of user performing the deletion
    """
    try:
        logger.info(f"Soft deleting profile {profile_id} by user: {deleted_by}")
        
        # Soft delete: set is_active to false instead of hard delete
        result = supabase.table("profiles")\
            .update({"is_active": False})\
            .eq("id", profile_id)\
            .eq("is_active", True)\
            .execute()
        
        if not result.data:
            logger.warning(f"Profile not found or already deleted: {profile_id}")
            return ServiceResponse.not_found("Profile")
        
        logger.info(f"Profile soft deleted successfully: {profile_id}")
        return ServiceResponse.success(result.data[0], "Profile deleted successfully")
        
    except Exception as e:
        logger.exception(f"Error deleting profile {profile_id}: {e}")
        return ServiceResponse.error(ErrorCode.DB_QUERY_ERROR, "Failed to delete profile", str(e))


def restore_profile(profile_id: str, restored_by: Optional[str] = None) -> Dict[str, Any]:
    """
    Restore a soft-deleted profile.
    
    Args:
        profile_id: Profile ID to restore
        restored_by: ID of user performing the restoration
    """
    try:
        logger.info(f"Restoring profile {profile_id} by user: {restored_by}")
        
        result = supabase.table("profiles")\
            .update({"is_active": True})\
            .eq("id", profile_id)\
            .eq("is_active", False)\
            .execute()
        
        if not result.data:
            logger.warning(f"Profile not found or already active: {profile_id}")
            return ServiceResponse.not_found("Deleted profile")
        
        logger.info(f"Profile restored successfully: {profile_id}")
        return ServiceResponse.success(result.data[0], "Profile restored successfully")
        
    except Exception as e:
        logger.exception(f"Error restoring profile {profile_id}: {e}")
        return ServiceResponse.error(ErrorCode.DB_QUERY_ERROR, "Failed to restore profile", str(e))


def get_profiles_by_role(role: str) -> Dict[str, Any]:
    """Get all active profiles with a specific role."""
    return get_all_profiles(role=role)


def get_unassigned_student_profiles() -> Dict[str, Any]:
    """
    Get all active student profiles that are not currently assigned to any room.
    
    This includes:
    1. Profiles with role='student' that have no student record.
    2. Profiles with role='student' that have a student record but no active room allocation.
    """
    try:
        logger.debug("Fetching unassigned student profiles")
        
        # 1. Get all students with active allocations
        active_allocations = supabase.table("room_allocations")\
            .select("student_id")\
            .is_("end_date", "null")\
            .execute()
        
        assigned_student_ids = [a.get("student_id") for a in active_allocations.data]
        
        # 2. Get profiles to exclude: 
        # - Those with active allocations
        # - Those marked as BLACKLISTED or ARCHIVED (restricted)
        exclude_profile_ids = []
        
        # Get profile_ids for assigned students
        if assigned_student_ids:
            assigned_students = supabase.table("students")\
                .select("profile_id")\
                .in_("id", assigned_student_ids)\
                .execute()
            exclude_profile_ids.extend([s.get("profile_id") for s in assigned_students.data])
            
        # Get profile_ids for restricted students
        restricted_students = supabase.table("students")\
            .select("profile_id")\
            .in_("status", ["BLACKLISTED", "ARCHIVED"])\
            .execute()
        exclude_profile_ids.extend([s.get("profile_id") for s in restricted_students.data])
        
        # Remove duplicates
        exclude_profile_ids = list(set(exclude_profile_ids))
            
        # 3. Get all active student profiles not in the exclude list
        query = supabase.table("profiles")\
            .select("*")\
            .eq("role", "student")\
            .eq("is_active", True)
            
        if exclude_profile_ids:
            query = query.not_.in_("id", exclude_profile_ids)
            
        result = query.execute()
        
        return ServiceResponse.success({
            "profiles": result.data,
            "count": len(result.data)
        })
        
    except Exception as e:
        logger.exception(f"Error fetching unassigned profiles: {e}")
        return ServiceResponse.error(ErrorCode.DB_QUERY_ERROR, "Failed to fetch unassigned profiles", str(e))

