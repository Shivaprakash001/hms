from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.services import activity_service
from app.utils.auth import UserContext, require_admin_or_owner

router = APIRouter(prefix="/activity", tags=["Activity"])


def _handle_response(result: dict):
    if not result.get("success"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result.get("error"),
        )
    return result.get("data")


@router.get("/")
def get_owner_activity(
    search: Optional[str] = Query(default=None),
    event_type: Optional[str] = Query(default=None),
    start_date: Optional[date] = Query(default=None),
    end_date: Optional[date] = Query(default=None),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    user: UserContext = Depends(require_admin_or_owner),
):
    result = activity_service.get_owner_activity(
        user_id=user.user_id,
        search=search,
        event_type=event_type,
        start_date=start_date,
        end_date=end_date,
        limit=limit,
        offset=offset,
    )
    return _handle_response(result)
