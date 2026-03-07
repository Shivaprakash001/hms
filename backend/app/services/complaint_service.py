from app.db import supabase
from typing import Optional, Dict, Any, List
from datetime import datetime
from app.utils.responses import ServiceResponse, ErrorCode
from app.utils.logger import get_logger
from app.utils.hooks import trigger_hook
from app.schemas.complaint_schema import ComplaintStatus

logger = get_logger(__name__)


def create_complaint(data: dict, created_by: Optional[str] = None) -> Dict[str, Any]:
    """
    Create a new complaint/maintenance request.
    """
    try:
        logger.info(f"Creating complaint for student: {data.get('student_id')}")
        
        # Add metadata
        data['created_by'] = created_by
        data['status'] = ComplaintStatus.PENDING.value
        
        result = supabase.table("complaints").insert(data).execute()
        
        if not result.data:
            return ServiceResponse.error(ErrorCode.DB_QUERY_ERROR, "Failed to create complaint")
            
        logger.info(f"Complaint created successfully: {result.data[0]['id']}")
        return ServiceResponse.success(result.data[0], "Complaint submitted successfully")
        
    except Exception as e:
        logger.exception(f"Error creating complaint: {e}")
        return ServiceResponse.error(ErrorCode.INTERNAL_ERROR, str(e))


def get_complaint(complaint_id: str, user_id: str, role: str) -> Dict[str, Any]:
    """
    Fetch a single complaint with authorization check.
    """
    try:
        query = supabase.table("complaints").select("*, students(*, profiles!students_profile_id_fkey(name, email))").eq("id", complaint_id)
        
        result = query.execute()
        if not result.data:
            return ServiceResponse.not_found("Complaint")
            
        complaint = result.data[0]
        
        # Authorization: Student can only see own
        if role == "student":
            # We need to check if this student_id belongs to the user
            # Simplified: check if student profile_id matches user_id
            student_profile_id = complaint.get('students', {}).get('profile_id')
            if str(student_profile_id) != str(user_id):
                return ServiceResponse.forbidden("Access denied to this complaint")
                
        return ServiceResponse.success(complaint)
        
    except Exception as e:
        logger.exception(f"Error fetching complaint: {e}")
        return ServiceResponse.error(ErrorCode.DB_QUERY_ERROR, str(e))


def get_all_complaints(
    student_id: Optional[str] = None,
    status: Optional[str] = None,
    category: Optional[str] = None,
    limit: int = 50,
    offset: int = 0
) -> Dict[str, Any]:
    """
    List complaints with filtering.
    """
    try:
        # Custom query to match mock data
        # MOCK_COMPLAINTS: { id, tenantName, room, title, description, date, status, priority }
        # Backend: { id, student_id, category(title?), description, created_at(date), status, priority }
        
        query = supabase.table("complaints").select("*, students(profiles!students_profile_id_fkey(name), room_allocations(rooms(room_no)))", count="exact")
        
        if student_id:
            query = query.eq("student_id", student_id)
        if status:
            query = query.eq("status", status)
        if category:
            query = query.eq("category", category)
            
        query = query.order("created_at", desc=True).limit(limit).offset(offset)
        
        result = query.execute()
        
        complaints_list = []
        for c in result.data:
            student = c.get("students", {})
            profile = student.get("profiles", {})
            allocations = student.get("room_allocations", [])
            room_no = "N/A"
            if allocations:
                if allocations[0].get("rooms"):
                    room_no = allocations[0]["rooms"]["room_no"]

            complaints_list.append({
                "id": c["id"],
                "tenantName": profile.get("name", "Unknown"),
                "room": room_no,
                "title": c["category"] or "Complaint", # Use category as title if title missing
                "description": c["description"],
                "date": c["created_at"].split("T")[0],
                "status": c["status"],
                "priority": c.get("priority", "medium") # Ensure priority exists in DB or default
            })

        return ServiceResponse.success({
            "complaints": complaints_list,
            "total": result.count if hasattr(result, 'count') else len(result.data),
            "limit": limit,
            "offset": offset
        })
        
    except Exception as e:
        logger.exception(f"Error listing complaints: {e}")
        return ServiceResponse.error(ErrorCode.DB_QUERY_ERROR, str(e))


def update_complaint_status(
    complaint_id: str, 
    status: str, 
    remarks: Optional[str] = None,
    updated_by: Optional[str] = None
) -> Dict[str, Any]:
    """
    Admin/Warden updates status of a complaint.
    """
    try:
        update_data = {
            "status": status,
            "staff_remarks": remarks,
            "updated_by": updated_by,
            "updated_at": datetime.now().isoformat()
        }
        
        if status == ComplaintStatus.RESOLVED.value:
            update_data["resolved_at"] = datetime.now().isoformat()
            
        result = supabase.table("complaints").update(update_data).eq("id", complaint_id).execute()
        
        if not result.data:
            return ServiceResponse.not_found("Complaint")
            
        logger.info(f"Complaint {complaint_id} status updated to {status}")
        
        # Trigger hook
        trigger_hook("complaint_updated", complaint_id=complaint_id, status=status)
        
        return ServiceResponse.success(result.data[0], f"Complaint status updated to {status}")
        
    except Exception as e:
        logger.exception(f"Error updating complaint status: {e}")
        return ServiceResponse.error(ErrorCode.INTERNAL_ERROR, str(e))
