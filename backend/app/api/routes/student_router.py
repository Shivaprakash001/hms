from fastapi import APIRouter, HTTPException, Query, status, Depends, BackgroundTasks, Form, UploadFile, File
from typing import Optional, List
from datetime import date
import json
from pydantic import ValidationError
from app.schemas.student_schema import (
    StudentCreate, StudentUpdate, StudentResponse,
    StudentListResponse, StudentStatus, StudentReactivate, StudentSelfProfileUpdate,
    ReactivationDecisionRequest
)
from app.schemas.document_schema import DocumentResponse
from app.schemas.payment_schema import StudentPaymentHistory
from app.schemas.invitation_schema import TenantInviteRequest, TenantActivateRequest, TenantResendRequest, TenantInviteResponse
from app.services import student_service, auth_service, document_service, payment_service
from app.services.invitation_service import InvitationService
from app.utils.auth import get_current_user, UserContext, require_admin, require_admin_or_owner
from app.utils.responses import ErrorCode
from app.utils.logger import get_logger

router = APIRouter(prefix="/students", tags=["Students"])
logger = get_logger(__name__)


def _handle_service_response(result: dict, success_status: int = status.HTTP_200_OK):
    """Helper to convert service response to HTTP response"""
    if not result.get("success"):
        error = result.get("error", {})
        error_code = error.get("code", ErrorCode.UNKNOWN_ERROR.value)
        message = error.get("message", "An error occurred")
        
        # Map error codes to HTTP status codes
        status_map = {
            ErrorCode.RESOURCE_NOT_FOUND.value: status.HTTP_404_NOT_FOUND,
            ErrorCode.RESOURCE_ALREADY_EXISTS.value: status.HTTP_409_CONFLICT,
            ErrorCode.FORBIDDEN.value: status.HTTP_403_FORBIDDEN,
            ErrorCode.VALIDATION_ERROR.value: status.HTTP_422_UNPROCESSABLE_ENTITY,
            ErrorCode.UNAUTHORIZED.value: status.HTTP_401_UNAUTHORIZED,
            ErrorCode.RESOURCE_INACTIVE.value: status.HTTP_400_BAD_REQUEST,
            ErrorCode.INTERNAL_ERROR.value: status.HTTP_500_INTERNAL_SERVER_ERROR,
        }
        
        http_status = status_map.get(error_code, status.HTTP_400_BAD_REQUEST)
        raise HTTPException(status_code=http_status, detail=result.get("error"))
    
    return result.get("data")


@router.post(
    "/",
    response_model=StudentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create student enrollment",
    description="Enroll a profile into the hostel system as a student",
    dependencies=[Depends(require_admin_or_owner)]
)
def create_new_student(
    student: StudentCreate,
    user: UserContext = Depends(get_current_user)
):
    """
    Create a new student enrollment.
    
    **Business Rules:**
    - Profile must exist and be active
    - Profile role must be 'student' (not admin/warden)
    - Profile cannot already be enrolled as student
    - joined_on cannot be future date
    - monthly_rent must be > 0
    
    **Authorization:**
    - Admin: ✅ Can create
    - Warden: ✅ Can create
    - Student: ❌ Cannot create
    
    **Fields:**
    - **profile_id**: UUID of the profile to enroll
    - **monthly_rent**: Monthly rent amount (must be > 0)
    - **joined_on**: Date student joined (cannot be future)
    - **status**: Initial status (default: ACTIVE)
    """
    student_data = student.model_dump(mode='json')
    if user.role in ("admin", "owner"):
        student_data['owner_id'] = user.user_id
        
    result = student_service.create_student(
        student_data,
        created_by=user.user_id
    )
    return _handle_service_response(result, status.HTTP_201_CREATED)


@router.get(
    "/",
    response_model=List[StudentResponse],
    summary="Get all students",
    description="Retrieve all students with filtering and pagination (Admin/Warden only)",
    dependencies=[Depends(require_admin_or_owner)]
)
def read_all_students(
    status: Optional[StudentStatus] = Query(None, description="Filter by status"),
    joined_after: Optional[date] = Query(None, description="Filter students joined after this date"),
    joined_before: Optional[date] = Query(None, description="Filter students joined before this date"),
    search: Optional[str] = Query(None, description="Search by name or email"),
    limit: int = Query(50, ge=1, le=100, description="Maximum number of results"),
    offset: int = Query(0, ge=0, description="Number of results to skip"),
    user: UserContext = Depends(get_current_user)
):
    """
    Get all students with optional filters.
    
    **Authorization:**
    - Admin: ✅ Can view all
    - Warden: ✅ Can view all
    - Student: ❌ Cannot access (use GET /students/me instead)
    
    **Filters:**
    - **status**: Filter by student status (INVITED, ACTIVE, LEFT)
    - **joined_after**: Students who joined after this date
    - **joined_before**: Students who joined before this date
    - **search**: Search by student name or email
    - **limit**: Page size (1-100)
    - **offset**: Pagination offset
    
    **Performance:** Always uses pagination to prevent large result sets.
    """
    result = student_service.get_all_students(
        status=status.value if status else None,
        joined_after=joined_after,
        joined_before=joined_before,
        search=search,
        limit=limit,
        offset=offset,
        requesting_user_role=user.role,
        owner_id=user.user_id if user.role in ("admin", "owner") else None
    )
    return result.get("data", {}).get("students", [])


@router.get(
    "/by-profile/{profile_id}",
    response_model=StudentResponse,
    summary="Get student by profile ID",
    description="Retrieve student enrollment by profile ID"
)
def read_student_by_profile(
    profile_id: str,
    user: UserContext = Depends(get_current_user)
):
    """
    Get student by profile ID - very useful endpoint.
    
    **Authorization:**
    - Admin/Warden: Can view any student
    - Student: Can only view own record
    """
    result = student_service.get_student_by_profile(
        profile_id,
        requesting_user_id=user.user_id,
        requesting_user_role=user.role
    )
    return _handle_service_response(result)


@router.post(
    "/invite",
    response_model=TenantInviteResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Invite a tenant",
    description="Owner invites a new tenant by email",
    dependencies=[Depends(require_admin_or_owner)]
)
def invite_tenant(
    data: TenantInviteRequest,
    background_tasks: BackgroundTasks,
    user: UserContext = Depends(get_current_user)
):
    """
    Invite a new tenant. Creates a profile and enrollment with INVITED status.
    """
    result = InvitationService.invite_tenant(
        data.model_dump(mode='json'),
        str(user.user_id),
        background_tasks
    )
    return _handle_service_response(result, status.HTTP_201_CREATED)


@router.post(
    "/activate",
    status_code=status.HTTP_200_OK,
    summary="Activate tenant account",
    description="Public endpoint for invited tenants to set password"
)
def activate_tenant(data: TenantActivateRequest):
    """
    Activate an invited tenant account using the secure token and setting a password.
    """
    if data.password != data.confirm_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": ErrorCode.VALIDATION_ERROR.value, "message": "Passwords do not match"}
        )

    result = InvitationService.activate_tenant(data.token, data.password)
    return _handle_service_response(result)


@router.post(
    "/resend-invitation",
    status_code=status.HTTP_200_OK,
    summary="Resend tenant invitation",
    description="Resend a pending invitation with a new token",
    dependencies=[Depends(require_admin_or_owner)]
)
def resend_invitation(
    data: TenantResendRequest,
    background_tasks: BackgroundTasks,
    user: UserContext = Depends(get_current_user)
):
    """
    Resend a pending invitation to a tenant.
    """
    result = InvitationService.resend_invitation(data.email, background_tasks)
    return _handle_service_response(result)


@router.get(
    "/me/profile",
    response_model=StudentResponse,
    summary="Get current student profile",
    description="Retrieve current student's full tenant profile with extended fields"
)
def read_my_profile(
    user: UserContext = Depends(get_current_user)
):
    if not user.is_student():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only students can access this endpoint."
        )

    result = student_service.get_student_by_profile(
        str(user.user_id),
        requesting_user_id=user.user_id,
        requesting_user_role=user.role
    )
    return _handle_service_response(result)


@router.patch(
    "/me/profile",
    response_model=StudentResponse,
    summary="Update current student profile",
    description="Update current student's own profile and extended tenant fields"
)
def update_my_profile(
    data: StudentSelfProfileUpdate,
    user: UserContext = Depends(get_current_user)
):
    if not user.is_student():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only students can access this endpoint."
        )

    result = student_service.update_student_self_profile(
        profile_id=str(user.user_id),
        data=data.model_dump(exclude_unset=True),
        updated_by=user.user_id
    )
    return _handle_service_response(result)


@router.post(
    "/me/complete-profile",
    response_model=StudentResponse,
    summary="Complete current student profile",
    description="Onboarding endpoint to update shared student profile fields and upload Aadhaar in one request"
)
async def complete_my_profile(
    profile_data: str = Form(..., description="JSON string matching StudentSelfProfileUpdate"),
    aadhaar_file: UploadFile = File(..., description="Aadhaar document image/PDF"),
    user: UserContext = Depends(get_current_user)
):
    if not user.is_student():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only students can access this endpoint."
        )

    try:
        payload = json.loads(profile_data)
        data = StudentSelfProfileUpdate(**payload)
    except json.JSONDecodeError:
        raise HTTPException(status_code=422, detail="Invalid JSON in profile_data")
    except ValidationError as e:
        raise HTTPException(status_code=422, detail=e.errors())

    if not aadhaar_file.filename:
        raise HTTPException(status_code=400, detail="Aadhaar file missing")

    file_bytes = await aadhaar_file.read()

    result = student_service.complete_student_self_profile(
        profile_id=str(user.user_id),
        data=data.model_dump(exclude_unset=True),
        aadhaar_file_bytes=file_bytes,
        aadhaar_filename=aadhaar_file.filename,
        aadhaar_content_type=aadhaar_file.content_type
    )
    return _handle_service_response(result)


@router.get(
    "/me/documents",
    response_model=List[DocumentResponse],
    summary="Get current student documents",
    description="Retrieve current student's own identification documents"
)
def read_my_documents(
    user: UserContext = Depends(get_current_user)
):
    if not user.is_student():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only students can access this endpoint."
        )

    from app.db import supabase
    stu_res = supabase.table("students").select("id").eq("profile_id", str(user.user_id)).execute()
    if not stu_res.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student record not found")

    student_id = stu_res.data[0].get("id")
    result = document_service.get_tenant_documents(
        tenant_id=str(student_id),
        requesting_user_id=user.user_id,
        requesting_user_role=user.role
    )
    return _handle_service_response(result)


@router.get(
    "/me/payments/history",
    response_model=StudentPaymentHistory,
    summary="Get current student payment history",
    description="Retrieve obligations, payments and outstanding balance for current student"
)
def read_my_payment_history(
    user: UserContext = Depends(get_current_user)
):
    if not user.is_student():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only students can access this endpoint."
        )

    from app.db import supabase
    student_id = user.student_id
    if not student_id:
        stu_res = supabase.table("students").select("id").eq("profile_id", str(user.user_id)).execute()
        if stu_res.data:
            student_id = stu_res.data[0].get("id")

    if not student_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student record not found")

    result = payment_service.get_student_payment_history(str(student_id))
    return _handle_service_response(result)


@router.get(
    "/me/room",
    response_model=dict,
    summary="Get current student room details",
    description="Retrieve current room, floor/capacity details and roommates for current student"
)
def read_my_room(
    user: UserContext = Depends(get_current_user)
):
    if not user.is_student():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only students can access this endpoint."
        )

    from app.db import supabase

    student_id = user.student_id
    if not student_id:
        stu_res = supabase.table("students").select("id").eq("profile_id", str(user.user_id)).execute()
        if stu_res.data:
            student_id = stu_res.data[0].get("id")

    if not student_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student record not found")

    alloc_res = supabase.table("room_allocations")\
        .select("room_id, rooms(room_no, capacity, floor_id)")\
        .eq("student_id", student_id)\
        .is_("end_date", "null")\
        .execute()

    if not alloc_res.data:
        return {"room": None, "roommates": []}

    alloc = alloc_res.data[0]
    room = alloc.get("rooms") or {}
    room_id = alloc.get("room_id")

    occupants_res = supabase.table("room_allocations")\
        .select("student_id, students!room_allocations_student_id_fkey(profile_id, profiles!students_profile_id_fkey(name))")\
        .eq("room_id", room_id)\
        .is_("end_date", "null")\
        .neq("student_id", student_id)\
        .execute()

    roommates = []
    for occ in (occupants_res.data or []):
        student_rec = occ.get("students") or {}
        profile = student_rec.get("profiles!students_profile_id_fkey") or student_rec.get("profiles") or {}
        name = profile.get("name")
        if name:
            roommates.append({"name": name})

    return {
        "room": {
            "room_no": room.get("room_no"),
            "capacity": room.get("capacity"),
            "floor_id": room.get("floor_id"),
        },
        "roommates": roommates
    }


@router.get(
    "/owner/tenants/{student_id}/overview",
    response_model=dict,
    summary="Get owner tenant overview",
    description="Retrieve owner-safe tenant overview for room management",
    dependencies=[Depends(require_admin_or_owner)]
)
def read_owner_tenant_overview(
    student_id: str,
    user: UserContext = Depends(get_current_user)
):
    result = student_service.get_owner_tenant_overview(
        student_id,
        owner_id=user.user_id if user.role in ("admin", "owner") else None
    )
    return _handle_service_response(result)


@router.get(
    "/{student_id}",
    response_model=StudentResponse,
    summary="Get student by ID",
    description="Retrieve a specific student with profile information"
)
def read_student(
    student_id: str,
    user: UserContext = Depends(get_current_user)
):
    """
    Get student by ID with joined profile information.
    
    **Authorization:**
    - Admin/Warden: Can view any student
    - Student: Can only view own record
    
    **Response includes:**
    - Student information
    - Joined profile data
    - Current room allocation (if any)
    - Payment summary (if available)
    """
    result = student_service.get_student(
        student_id,
        requesting_user_id=user.user_id,
        requesting_user_role=user.role
    )
    return _handle_service_response(result)


@router.put(
    "/{student_id}",
    response_model=StudentResponse,
    summary="Update student",
    description="Update student information (Admin/Warden only)",
    dependencies=[Depends(require_admin_or_owner)]
)
def modify_student(
    student_id: str,
    student: StudentUpdate,
    user: UserContext = Depends(get_current_user)
):
    """
    Update student information.
    
    **Business Rules:**
    - Cannot reduce rent below 0
        - Status changes must follow state machine rules:
            - INVITED → ACTIVE, LEFT
            - ACTIVE → LEFT
            - LEFT → ACTIVE
    - If status changes to LEFT, active room allocation must be ended
    
    **Authorization:**
    - Admin: ✅ Can update
    - Warden: ✅ Can update
    - Student: ❌ Cannot update
    
    **Editable Fields:**
    - **monthly_rent**: Updated rent amount
    - **status**: New status (must follow state machine)
    - **joined_on**: Join date (use with caution)
    
    **Critical:** Changing status to LEFT will trigger room allocation closure.
    """
    result = student_service.update_student(
        student_id,
        student.model_dump(mode='json', exclude_unset=True),
        updated_by=user.user_id,
        requesting_user_role=user.role
    )
    return _handle_service_response(result)


@router.delete(
    "/{student_id}",
    status_code=status.HTTP_200_OK,
    summary="Soft delete student",
    description="Mark student as LEFT (Admin/Owner only - never removes data)",
    dependencies=[Depends(require_admin_or_owner)],
    response_model=StudentResponse
)
def remove_student(
    student_id: str,
    user: UserContext = Depends(get_current_user)
):
    """
    Soft delete student by setting status to LEFT.
    
    **IMPORTANT:** This NEVER removes the database row - critical for audit trail.
    
    **Authorization:**
    - Admin: ✅ Can delete
    - Warden: ❌ Cannot delete
    - Student: ❌ Cannot delete
    
    **Side Effects:**
    - Status set to LEFT
    - Active room allocation will be ended
    - Future payments will be stopped
    """
    result = student_service.delete_student(
        student_id,
        deleted_by=user.user_id,
        requesting_user_role=user.role
    )
    return _handle_service_response(result)


@router.post(
    "/{student_id}/reactivate",
    response_model=StudentResponse,
    status_code=status.HTTP_200_OK,
    summary="Reactivate student",
    description="Reactivate a student who has LEFT status",
    dependencies=[Depends(require_admin_or_owner)]
)
def reactivate_student_endpoint(
    student_id: str,
    reactivation: StudentReactivate,
    user: UserContext = Depends(get_current_user)
):
    """
    Reactivate a student who has LEFT status.
    
    **Business Rules:**
    - Student must have LEFT status
    - Cannot reactivate from other statuses (e.g. ACTIVE)
    - Requires new monthly_rent and joined_on date
    
    **Authorization:**
    - Admin: ✅ Can reactivate
    - Warden: ✅ Can reactivate
    - Student: ❌ Cannot reactivate
    
    **Use Case:** Student re-admission after leaving hostel.
    """
    result = student_service.reactivate_student(
        student_id,
        monthly_rent=reactivation.monthly_rent,
        joined_on=reactivation.joined_on,
        reactivated_by=user.user_id,
        requesting_user_role=user.role
    )
    return _handle_service_response(result)


@router.post(
    "/me/reactivation-request",
    response_model=dict,
    status_code=status.HTTP_201_CREATED,
    summary="Request tenant reactivation",
    description="Student requests owner to restore invited/left access"
)
def create_my_reactivation_request(
    user: UserContext = Depends(get_current_user)
):
    if not user.is_student():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only students can access this endpoint."
        )

    result = student_service.create_reactivation_request(
        profile_id=str(user.user_id),
        requested_by=str(user.user_id)
    )
    return _handle_service_response(result, status.HTTP_201_CREATED)


@router.get(
    "/owner/reactivation-requests",
    response_model=List[dict],
    summary="List tenant reactivation requests",
    description="Owner/admin view of all reactivation requests",
    dependencies=[Depends(require_admin_or_owner)]
)
def list_owner_reactivation_requests(
    user: UserContext = Depends(get_current_user)
):
    result = student_service.list_reactivation_requests(owner_id=str(user.user_id))
    return _handle_service_response(result)


@router.post(
    "/owner/reactivation-requests/{request_id}/decision",
    response_model=dict,
    summary="Approve/Reject tenant reactivation request",
    description="Owner/admin action to process a reactivation request",
    dependencies=[Depends(require_admin_or_owner)]
)
def decide_reactivation_request(
    request_id: str,
    payload: ReactivationDecisionRequest,
    user: UserContext = Depends(get_current_user)
):
    result = student_service.process_reactivation_request(
        request_id=request_id,
        owner_id=str(user.user_id),
        action=payload.action,
        notes=payload.notes
    )
    return _handle_service_response(result)
