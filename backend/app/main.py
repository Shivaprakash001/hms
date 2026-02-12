from fastapi import FastAPI
from app.api.routes.student_router import router as student_router
from app.api.routes.profile_router import router as profile_router
import uvicorn

app = FastAPI(title="Hostel Management System API", version="1.0.0")

app.include_router(student_router)
app.include_router(profile_router)

@app.get("/")
def read_root():
    return {"message": "Hello World"}

if __name__ == "__main__":
    uvicorn.run("backend.app.main:app", host="0.0.0.0", port=8000, reload=True)