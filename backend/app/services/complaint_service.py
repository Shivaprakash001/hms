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
    Handles legacy schema and links to owner.
    """
    try:
        student_id = data.get('student_id')
        logger.info(f"Creating complaint for student: {student_id}")
        
        # Fetch owner_id for this student
        student_res = supabase.table("students").select("owner_id").eq("id", student_id).execute()
        owner_id = None
        if student_res.data:
            owner_id = student_res.data[0].get("owner_id")
            logger.info(f"Found owner_id {owner_id} for student {student_id}")
        
        # Prepare legacy-compatible data
        description = data.get('description', '')
        category = data.get('category', 'OTHER')
        priority = data.get('priority', 'MEDIUM')
        
        # Append extra info to description since columns are missing in legacy DB
        enhanced_description = f"{description}\n\n[Category: {category}] [Priority: {priority}]"
        
        insert_data = {
            "student_id": student_id,
            "owner_id": owner_id, # Link to owner
            "title": data.get("title", "Complaint"),
            "description": enhanced_description,
            "status": "OPEN" # Legacy status
        }
        
        print(f"DEBUG: Inserting legacy complaint data: {insert_data}")
        result = supabase.table("complaints").insert(insert_data).execute()
        print(f"DEBUG: Insert result: {result}")
        
        if not result.data:
            return ServiceResponse.error(ErrorCode.DB_QUERY_ERROR, "Failed to create complaint")
            
        logger.info(f"Complaint created successfully: {result.data[0]['id']}")
        return ServiceResponse.success(result.data[0], "Complaint submitted successfully")
        
    except Exception as e:
        print(f"DEBUG: Error creating complaint: {str(e)}")
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

            # Map legacy status to frontend friendly status
            status_map = {
                "OPEN": "Pending",
                "PENDING": "Pending",
                "CLOSED": "resolved",
                "RESOLVED": "resolved"
            }
            db_status = c.get("status", "OPEN")
            display_status = status_map.get(db_status.upper(), db_status)

            complaints_list.append({
                "id": c["id"],
                "tenantName": profile.get("name", "Unknown"),
                "room": room_no,
                "title": c.get("title") or c.get("category") or "Complaint",
                "description": c.get("description", ""),
                "category": c.get("category") or "General",
                "date": c.get("created_at", datetime.now().isoformat()).split("T")[0],
                "status": display_status,
                "priority": c.get("priority", "Medium")
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
