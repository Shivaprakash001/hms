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
            
        complaint_data = result.data[0]
        trigger_hook("complaint_created", 
                     complaint_id=complaint_data["id"], 
                     student_id=student_id, 
                     owner_id=owner_id,
                     title=insert_data["title"])

        logger.info(f"Complaint created successfully: {complaint_data['id']}")
        return ServiceResponse.success(complaint_data, "Complaint submitted successfully")
        
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
    offset: int = 0,
    owner_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    List complaints with filtering.
    """
    try:
        # Simplified query: only join students -> profiles (name)
        # Room allocation is fetched separately per student to avoid invalid nested joins
        query = supabase.table("complaints").select(
            "*, students(profiles!students_profile_id_fkey(name))",
            count="exact"
        )
        
        if student_id:
            query = query.eq("student_id", student_id)
        if owner_id:
            query = query.eq("owner_id", owner_id)
        if status:
            query = query.eq("status", status)
        if category:
            query = query.eq("category", category)
            
        query = query.order("created_at", desc=True).limit(limit).offset(offset)
        
        result = query.execute()
        logger.info(f"Complaints query returned {len(result.data)} rows")
        
        # Collect unique student IDs to batch-fetch their current room
        student_ids = list({c["student_id"] for c in result.data if c.get("student_id")})
        room_map = {}  # student_id -> room_no
        if student_ids:
            try:
                alloc_res = supabase.table("room_allocations") \
                    .select("student_id, rooms(room_no)") \
                    .in_("student_id", student_ids) \
                    .is_("end_date", "null") \
                    .execute()
                for alloc in alloc_res.data:
                    sid = alloc.get("student_id")
                    rooms = alloc.get("rooms")
                    if sid and rooms and isinstance(rooms, dict):
                        room_map[sid] = rooms.get("room_no", "N/A")
            except Exception as alloc_err:
                logger.warning(f"Could not fetch room allocations for complaints: {alloc_err}")
        
        complaints_list = []
        for c in result.data:
            student = c.get("students") or {}
            # profiles can be a list or a dict depending on Supabase join type
            profiles_data = student.get("profiles", {})
            if isinstance(profiles_data, list):
                profiles_data = profiles_data[0] if profiles_data else {}
            
            tenant_name = profiles_data.get("name", "Unknown") if profiles_data else "Unknown"
            room_no = room_map.get(c.get("student_id"), "N/A")

            # Map legacy status to frontend friendly status
            status_map = {
                "OPEN": "Pending",
                "PENDING": "Pending",
                "CLOSED": "resolved",
                "RESOLVED": "resolved"
            }
            db_status = c.get("status", "OPEN")
            if db_status:
                display_status = status_map.get(db_status.upper(), db_status)
            else:
                display_status = "Pending"

            complaints_list.append({
                "id": c["id"],
                "tenantName": tenant_name,
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
            "total": result.count if hasattr(result, 'count') and result.count is not None else len(result.data),
            "limit": limit,
            "offset": offset
        })
        
    except Exception as e:
        logger.exception(f"Error listing complaints: {e}")
        return ServiceResponse.error(ErrorCode.DB_QUERY_ERROR, f"Failed to fetch complaints: {str(e)}")


def update_complaint_status(
    complaint_id: str, 
    status: str, 
    remarks: Optional[str] = None,
    updated_by: Optional[str] = None,
    requesting_user_role: Optional[str] = None
) -> Dict[str, Any]:
    """
    Admin/Warden/Owner updates status of a complaint.
    """
    try:
        # Authorization for owners: Must own the complaint link
        if requesting_user_role == 'owner':
            check_res = supabase.table("complaints").select("owner_id").eq("id", complaint_id).execute()
            if not check_res.data:
                return ServiceResponse.not_found("Complaint")
            if str(check_res.data[0].get("owner_id")) != str(updated_by):
                return ServiceResponse.forbidden("You can only resolve complaints from your own tenants")

        # Start with minimal update data (legacy compatible)
        update_data = {
            "status": status,
            "updated_at": datetime.now().isoformat()
        }
        
        # Try to include full resolution data if columns exist
        # We use a nested try-except or check columns first. 
        # For simplicity and robustness, we try full update first.
        full_update = update_data.copy()
        full_update.update({
            "staff_remarks": remarks,
            "updated_by": updated_by
        })
        if status == ComplaintStatus.RESOLVED.value:
            full_update["resolved_at"] = datetime.now().isoformat()
            
        try:
            result = supabase.table("complaints").update(full_update).eq("id", complaint_id).execute()
        except Exception as e:
            if "column" in str(e).lower():
                logger.warning(f"Database schema is outdated (missing resolution columns). Falling back to minimal update. Error: {e}")
                # Fallback to minimal update (only status and updated_at)
                result = supabase.table("complaints").update(update_data).eq("id", complaint_id).execute()
            else:
                raise e
        
        if not result.data:
            return ServiceResponse.not_found("Complaint")
            
        logger.info(f"Complaint {complaint_id} status updated to {status}")
        
        # Trigger hook
        trigger_hook("complaint_updated", complaint_id=complaint_id, status=status)
        
        return ServiceResponse.success(result.data[0], f"Complaint status updated to {status}")
        
    except Exception as e:
        logger.exception(f"Error updating complaint status: {e}")
        return ServiceResponse.error(ErrorCode.INTERNAL_ERROR, str(e))
