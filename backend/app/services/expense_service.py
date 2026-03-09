from app.db import supabase
from app.utils.responses import ServiceResponse, ErrorCode
from app.utils.logger import get_logger

logger = get_logger(__name__)

def get_all_expenses(owner_id: str = None):
    try:
        query = supabase.table("expenses").select("*")
        if owner_id:
            query = query.eq("owner_id", owner_id)
        response = query.order("date", desc=True).execute()
        
        # MOCK_EXPENSES: { id, title, amount, date, category, status }
        # Map DB fields to Mock fields if necessary
        expenses = []
        for item in response.data:
            expenses.append({
                "id": item["id"],
                "title": item.get("title", "Expense"),
                "amount": item["amount"],
                "date": item["date"],
                "category": item["category"],
                "status": item.get("status", "pending")  # fallback if column doesn't exist
            })
            
        return ServiceResponse.success(expenses)
    except Exception as e:
        logger.error(f"Error fetching expenses: {e}")
        return ServiceResponse.error(ErrorCode.INTERNAL_ERROR, str(e))

def create_expense(data: dict):
    try:
        # Remove 'status' if the DB column doesn't exist yet
        data.pop("status", None)
        response = supabase.table("expenses").insert(data).execute()
        if response.data:
            result = response.data[0]
            result.setdefault("status", "pending")  # add default for response schema
            return ServiceResponse.success(result)
        return ServiceResponse.error(ErrorCode.DB_QUERY_ERROR, "Failed to create expense")
    except Exception as e:
        logger.error(f"Error creating expense: {e}")
        return ServiceResponse.error(ErrorCode.INTERNAL_ERROR, str(e))

def update_expense(expense_id, data: dict):
    try:
        import datetime as _dt
        # Serialize date objects to ISO strings for Supabase
        serialized = {}
        for k, v in data.items():
            if isinstance(v, (_dt.date, _dt.datetime)):
                serialized[k] = v.isoformat()
            else:
                serialized[k] = v

        # Try with status first; if DB doesn't have the column, retry without it
        status_value = serialized.pop("status", None)
        try:
            if status_value is not None:
                serialized["status"] = status_value
            response = supabase.table("expenses").update(serialized).eq("id", expense_id).execute()
        except Exception:
            # Retry without status if the column doesn't exist
            serialized.pop("status", None)
            response = supabase.table("expenses").update(serialized).eq("id", expense_id).execute()

        if response.data:
            result = response.data[0]
            result.setdefault("status", status_value or "pending")
            return ServiceResponse.success(result)
        return ServiceResponse.error(ErrorCode.RESOURCE_NOT_FOUND, "Expense not found")
    except Exception as e:
        logger.error(f"Error updating expense: {e}")
        return ServiceResponse.error(ErrorCode.INTERNAL_ERROR, str(e))

def delete_expense(expense_id: int):
    try:
        response = supabase.table("expenses").delete().eq("id", expense_id).execute()
        if response.data:
            return ServiceResponse.success(response.data[0])
        return ServiceResponse.error(ErrorCode.RESOURCE_NOT_FOUND, "Expense not found")
    except Exception as e:
        logger.error(f"Error deleting expense: {e}")
        return ServiceResponse.error(ErrorCode.INTERNAL_ERROR, str(e))
