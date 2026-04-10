import sys
import os
import asyncio
import importlib

# Ensure the 'backend' directory is in the Python path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi import FastAPI, status, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from app.api.routes.student_router import router as student_router
from app.api.routes.profile_router import router as profile_router
from app.api.routes.room_allocation_router import router as room_allocation_router

from app.api.routes.payment_router import router as payment_router
from app.api.routes.payment_webhook_router import router as payment_webhook_router
from app.api.routes.auth_router import router as auth_router
from app.api.routes.room_router import router as room_router
from app.api.routes.expense_router import router as expense_router
from app.api.routes.dashboard_router import router as dashboard_router
from app.api.routes.notification_router import router as notification_router
from app.api.routes.owner_router import router as owner_router
from app.api.routes.activity_router import router as activity_router
from app.api.routes.billing_router import router as billing_router
import uvicorn

from app.utils.hooks import register_hook
from app.services.room_allocation_service import handle_student_left
from app.services import payment_service
from app.utils.logger import get_logger

app = FastAPI(title="Hostel Management System API", version="1.0.0")
app.state.payment_reconciliation_task = None
logger = get_logger(__name__)

try:
    complaint_router = getattr(importlib.import_module("app.api.routes.complaint_router"), "router", None)
except ImportError:
    complaint_router = None

# CORS Configuration
origins = [
    "https://trishul.solutions",
    "https://www.trishul.solutions",
    "https://trishul-hms.vercel.app",
    "https://hms-sand-five.vercel.app",
    "http://localhost:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"https://.*\.vercel\.app|https://(.*\.)?trishul\.solutions",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_event():
    from app.services.notification_handler import (
        handle_student_enrolled,
        handle_student_allocated,
        handle_payment_recorded,
        handle_rent_generated,
    )
    
    # Core logic hooks
    register_hook("student_left", handle_student_left)
    
    # Notification hooks
    register_hook("student_enrolled", handle_student_enrolled)
    register_hook("student_allocated_room", handle_student_allocated)
    register_hook("payment_recorded", handle_payment_recorded)
    register_hook("rent_obligation_created", handle_rent_generated)

    # Optional complaint hooks (do not crash startup if handlers are not implemented yet)
    try:
        from app.services import notification_handler as notification_module

        complaint_created_handler = getattr(notification_module, "handle_complaint_created", None)
        complaint_updated_handler = getattr(notification_module, "handle_complaint_resolved", None)

        if callable(complaint_created_handler):
            register_hook("complaint_created", complaint_created_handler)
        else:
            logger.warning("Complaint created notification hook is not implemented")

        if callable(complaint_updated_handler):
            register_hook("complaint_updated", complaint_updated_handler)
        else:
            logger.warning("Complaint updated notification hook is not implemented")
    except Exception:
        logger.exception("Failed to configure optional complaint notification hooks")

    if app.state.payment_reconciliation_task is None:
        app.state.payment_reconciliation_task = asyncio.create_task(_payment_reconciliation_loop())


@app.on_event("shutdown")
async def shutdown_event():
    task = app.state.payment_reconciliation_task
    if task:
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass


async def _payment_reconciliation_loop():
    while True:
        try:
            payment_service.reconcile_pending_payment_attempts()
        except Exception:
            from app.utils.logger import get_logger
            get_logger(__name__).exception("Payment reconciliation loop failed")
        await asyncio.sleep(900)

app.include_router(student_router)
app.include_router(profile_router)
app.include_router(room_allocation_router)
app.include_router(payment_router)
app.include_router(payment_webhook_router)
app.include_router(auth_router)
if complaint_router is not None:
    app.include_router(complaint_router)
app.include_router(room_router)
app.include_router(expense_router)
app.include_router(dashboard_router)
app.include_router(notification_router)
app.include_router(owner_router)
app.include_router(activity_router)
app.include_router(billing_router)

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    import json
    from app.utils.logger import get_logger
    logger = get_logger("validation_error")
    
    error_details = exc.errors()
    logger.error(f"Validation error for {request.method} {request.url}: {json.dumps(error_details, indent=2)}")
    
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": error_details, "body": exc.body},
    )

@app.get("/")
def read_root():
    return {"message": "Hello World"}

if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
