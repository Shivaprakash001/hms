from fastapi import APIRouter
from app.api.routes.student_router import router as student_router
from app.api.routes.profile_router import router as profile_router
from app.api.routes.room_allocation_router import router as room_allocation_router
from app.api.routes.payment_router import router as payment_router
from app.api.routes.auth_router import router as auth_router
from app.api.routes.complaint_router import router as complaint_router
from app.api.routes.room_router import router as room_router
from app.api.routes.expense_router import router as expense_router
from app.api.routes.dashboard_router import router as dashboard_router
from app.api.routes.notification_router import router as notification_router
from app.api.routes.document_router import router as document_router

router = APIRouter()

# Include all module routers
router.include_router(student_router)
router.include_router(profile_router)
router.include_router(room_allocation_router)
router.include_router(payment_router)
router.include_router(auth_router)
router.include_router(complaint_router)
router.include_router(room_router)
router.include_router(expense_router)
router.include_router(dashboard_router)
router.include_router(notification_router)
router.include_router(document_router)

@router.get("/health", tags=["API v1 system"])
def health_check():
    return {"status": "ok", "version": "v1.0.0"}

@router.get("/version", tags=["API v1 system"])
def get_version():
    return {"version": "v1.0.0", "deprecated": False}
