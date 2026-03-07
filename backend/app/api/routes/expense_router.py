from fastapi import APIRouter, HTTPException, status, Depends
from app.schemas.expense_schema import ExpenseCreate, ExpenseUpdate, ExpenseResponse
from app.services import expense_service
from app.utils.auth import get_current_user, UserContext, require_admin, require_admin_or_owner
from typing import List

router = APIRouter(prefix="/expenses", tags=["Expenses"])

def _handle_response(result: dict):
    if not result.get("success"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result.get("error")
        )
    return result.get("data")

@router.get("/", response_model=List[ExpenseResponse])
def get_expenses(user: UserContext = Depends(require_admin_or_owner)):
    result = expense_service.get_all_expenses()
    return _handle_response(result)

@router.post("/", response_model=ExpenseResponse)
def create_expense(expense: ExpenseCreate, user: UserContext = Depends(require_admin_or_owner)):
    result = expense_service.create_expense(expense.model_dump(mode='json'))
    return _handle_response(result)

@router.put("/{expense_id}", response_model=ExpenseResponse)
def update_expense(expense_id: int, expense: ExpenseUpdate, user: UserContext = Depends(require_admin_or_owner)):
    result = expense_service.update_expense(expense_id, expense.model_dump(exclude_unset=True, mode='json'))
    return _handle_response(result)

@router.delete("/{expense_id}")
def delete_expense(expense_id: int, user: UserContext = Depends(require_admin)):
    result = expense_service.delete_expense(expense_id)
    return _handle_response(result)
