from fastapi import FastAPI
from app.api.routes.student_router import router as student_router
from app.api.routes.profile_router import router as profile_router
from app.api.routes.room_allocation_router import router as room_allocation_router
from app.api.routes.payment_router import router as payment_router
import uvicorn

from app.utils.hooks import register_hook
from app.services.room_allocation_service import handle_student_left

app = FastAPI(title="Hostel Management System API", version="1.0.0")

# Register hooks on startup
@app.on_event("startup")
def startup_event():
    # When student leaves hostel, auto-end room allocation
    register_hook("student_left", handle_student_left)

app.include_router(student_router)
app.include_router(profile_router)
app.include_router(room_allocation_router)
app.include_router(payment_router)

@app.get("/")
def read_root():
    return {"message": "Hello World"}

if __name__ == "__main__":
    uvicorn.run("backend.app.main:app", host="0.0.0.0", port=8000, reload=True)