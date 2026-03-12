import sys
import os

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
from app.api.routes.auth_router import router as auth_router
from app.api.routes.complaint_router import router as complaint_router
from app.api.routes.room_router import router as room_router
from app.api.routes.expense_router import router as expense_router
from app.api.routes.dashboard_router import router as dashboard_router
from app.api.routes.notification_router import router as notification_router
import uvicorn

from app.utils.hooks import register_hook
from app.services.room_allocation_service import handle_student_left

app = FastAPI(title="Hostel Management System API", version="1.0.0")

# CORS Configuration
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "https://hms-sand-five.vercel.app",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def startup_event():
    from app.services.notification_handler import (
        handle_student_enrolled, handle_student_allocated,
        handle_payment_recorded, handle_complaint_created,
        handle_complaint_resolved, handle_rent_generated
    )
    
    # Core logic hooks
    register_hook("student_left", handle_student_left)
    
    # Notification hooks
    register_hook("student_enrolled", handle_student_enrolled)
    register_hook("student_allocated_room", handle_student_allocated)
    register_hook("payment_recorded", handle_payment_recorded)
    register_hook("complaint_created", handle_complaint_created)
    register_hook("complaint_updated", handle_complaint_resolved)
    register_hook("rent_obligation_created", handle_rent_generated)

app.include_router(student_router)
app.include_router(profile_router)
app.include_router(room_allocation_router)
app.include_router(payment_router)
app.include_router(auth_router)
app.include_router(complaint_router)
app.include_router(room_router)
app.include_router(expense_router)
app.include_router(dashboard_router)
app.include_router(notification_router)

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