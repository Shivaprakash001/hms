import sys
import os
import re
from datetime import datetime
from zoneinfo import ZoneInfo

# Ensure the 'backend' directory is in the Python path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi import FastAPI, status, Request, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.openapi.utils import get_openapi
from fastapi.openapi.docs import get_swagger_ui_html, get_redoc_html
from app.api.v1_router import router as v1_router
from app.api.rate_limiter import RateLimitConfig
from app.utils.logger import get_logger

logger = get_logger(__name__)
import uvicorn
import sentry_sdk

from app.utils.hooks import register_hook
from app.services.room_allocation_service import handle_student_left
from app.middleware import LoggingMiddleware

app = FastAPI(
    title="Hostel Management System API",
    version="1.0.0",
    servers=[
        {"url": "https://api.trishul.solutions", "description": "Production server"}
    ],
)

app.add_middleware(LoggingMiddleware)

# Explicitly allowed origins for CORS (can be overridden by CORS_ALLOW_ORIGINS env)
cors_origins_env = os.getenv("CORS_ALLOW_ORIGINS", "").strip()
origins = [
    origin.strip()
    for origin in cors_origins_env.split(",")
    if origin.strip()
] or [
    "https://trishul.solutions",
    "http://trishul.solutions",
    "https://www.trishul.solutions",
    "http://www.trishul.solutions",
    "https://app.trishul.solutions",
    "http://app.trishul.solutions",
    "https://trishul-hms.vercel.app",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

_ALLOWED_ORIGIN_REGEX = re.compile(r"https?://([a-z0-9-]+\.)?trishul\.solutions$")


def _is_origin_allowed(origin: str | None) -> bool:
    if not origin:
        return False
    if origin in origins:
        return True
    return bool(_ALLOWED_ORIGIN_REGEX.fullmatch(origin))


def _apply_cors_headers(request: Request, response: JSONResponse):
    origin = request.headers.get("origin")
    if not _is_origin_allowed(origin):
        return response

    response.headers["Access-Control-Allow-Origin"] = origin
    response.headers["Access-Control-Allow-Credentials"] = "true"
    vary_header = response.headers.get("Vary")
    response.headers["Vary"] = "Origin" if not vary_header else f"{vary_header}, Origin"

    request_headers = request.headers.get("access-control-request-headers")
    if request_headers:
        response.headers["Access-Control-Allow-Headers"] = request_headers
    else:
        response.headers.setdefault("Access-Control-Allow-Headers", "*")
    response.headers.setdefault("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS")
    return response

from app.utils.middleware import QueryMonitorMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"https?://([a-z0-9-]+\.)?trishul\.solutions$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(QueryMonitorMiddleware)

from fastapi.responses import JSONResponse
from fastapi import Request, HTTPException

@app.middleware("http")
async def security_headers_middleware(request: Request, call_next):
    # Apply global API rate limit
    if request.method != "OPTIONS":
        from app.utils.rate_limit import check_api_rate_limit
        try:
            check_api_rate_limit(request)
        except HTTPException as exc:
            blocked = JSONResponse(
                status_code=exc.status_code,
                content={"detail": exc.detail}
            )
            return _apply_cors_headers(request, blocked)

    response = await call_next(request)

    # Security headers
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    # TEMP: CSP disabled to unblock Swagger UI during testing.
    # Re-enable before production hardening.
    # response.headers["Content-Security-Policy"] = "..."

    return _apply_cors_headers(request, response)

@app.on_event("startup")
def startup_event():
    import os
    sentry_dsn = os.getenv("SENTRY_DSN")
    if sentry_dsn:
        sentry_sdk.init(
            dsn=sentry_dsn,
            traces_sample_rate=1.0,
            profiles_sample_rate=1.0,
        )
        get_logger("sentry").info("Sentry initialized")

    from app.services.notification_handler import (
        handle_student_enrolled, handle_student_allocated,
        handle_payment_recorded, handle_rent_generated
    )
    
    # Core logic hooks
    register_hook("student_left", handle_student_left)
    
    # Notification hooks
    register_hook("student_enrolled", handle_student_enrolled)
    register_hook("student_allocated_room", handle_student_allocated)
    register_hook("payment_recorded", handle_payment_recorded)
    register_hook("rent_obligation_created", handle_rent_generated)

    # Initialize APScheduler for automated jobs
    from apscheduler.schedulers.asyncio import AsyncIOScheduler
    from app.jobs.payment_generation_job import PaymentGenerationJob
    
    app_timezone = ZoneInfo(os.getenv("APP_TIMEZONE", "Asia/Kolkata"))
    scheduler = AsyncIOScheduler(timezone=app_timezone)
    # Schedule to run daily and let owner preferences decide who gets rent generated.
    scheduler.add_job(
        PaymentGenerationJob.run_scheduled_rent_generation,
        'cron', 
        day='*',
        hour=0, 
        minute=5,
        id='scheduled_rent_generation',
        replace_existing=True
    )
    scheduler.start()
    get_logger("scheduler").info("APScheduler initialized and jobs scheduled.")


@app.post("/internal/cron/generate-rent", include_in_schema=False)
def run_internal_rent_generation(x_cron_secret: str | None = Header(default=None)):
    configured_secret = os.getenv("INTERNAL_CRON_SECRET")
    if not configured_secret:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"message": "INTERNAL_CRON_SECRET is not configured"}
        )
    if x_cron_secret != configured_secret:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"message": "Invalid cron secret"}
        )

    from app.jobs.payment_generation_job import PaymentGenerationJob

    app_timezone = ZoneInfo(os.getenv("APP_TIMEZONE", "Asia/Kolkata"))
    target_date = datetime.now(app_timezone).date()
    result = PaymentGenerationJob.run_scheduled_rent_generation(target_date)
    return {
        "status": "ok",
        "target_month": target_date.replace(day=1).isoformat(),
        "result": result.get("data", result)
    }

app.include_router(v1_router)
app.include_router(v1_router, prefix="/api/v1")

def custom_openapi():
    """
    Custom OpenAPI schema with enhanced documentation
    """
    if app.openapi_schema:
        return app.openapi_schema
    
    openapi_schema = get_openapi(
        title="Hostel Management System API",
        version="v1.0.0",
        description="""
        ### 📚 HMS API Documentation
        
        Professional Hostel Management System API with JWT authentication,
        role-based access control, and comprehensive endpoint documentation.
        
        ### 🔐 Authentication
        - **Method**: JWT Bearer Token
        - **Token Expiration**: 1 hour
        - **Obtain Token**: POST `/api/v1/auth/login`
        
        ### ⏱️ Rate Limiting
        - **Default Limit**: 100 requests/hour
        - **Login**: 5 requests/15 minutes
        - **Response Headers**: `X-RateLimit-*`
        
        ### 👥 Roles
        - **Admin**: Full access
        - **Warden**: Room and student management
        - **Student**: Limited access (own data only)
        
        ### 📖 Documentation
        - **Swagger UI**: /docs
        - **ReDoc**: /redoc
        - **OpenAPI Schema**: /openapi.json
        
        ### 🚀 Quick Start
        
        1. **Register**: `POST /api/v1/auth/register`
        2. **Login**: `POST /api/v1/auth/login`
        3. **Get Token**: Extract from response
        4. **Use in Requests**: Add header `Authorization: Bearer {token}`
        """,
        routes=app.routes,
        contact={
            "name": "HMS Support",
            "url": "https://hms.example.com/support",
            "email": "support@hms.example.com",
        },
        license_info={
            "name": "Proprietary",
            "url": "https://hms.example.com/license",
        },
        servers=[
            {"url": "https://trishul-solutions1.onrender.com", "description": "Production server"},
            {"url": "http://localhost:8000", "description": "Development server"}
        ],
    )
    
    # Add security scheme
    if "components" not in openapi_schema:
        openapi_schema["components"] = {}
    openapi_schema["components"]["securitySchemes"] = {
        "BearerAuth": {
            "type": "http",
            "scheme": "bearer",
            "bearerFormat": "JWT",
            "description": "JWT Bearer authentication"
        }
    }
    
    # Add security to all endpoints
    for path in openapi_schema.get("paths", {}).values():
        for operation in path.values():
            if isinstance(operation, dict) and operation.get("tags") != ["API v1 system"]:
                if "security" not in operation:
                    operation["security"] = [{"BearerAuth": []}]
    
    app.openapi_schema = openapi_schema
    return app.openapi_schema

app.openapi = custom_openapi

@app.get("/docs", include_in_schema=False)
async def custom_swagger_ui_html():
    return get_swagger_ui_html(openapi_url=app.openapi_url, title="HMS API - Swagger UI")

@app.get("/redoc", include_in_schema=False)
async def custom_redoc_html():
    return get_redoc_html(openapi_url=app.openapi_url, title="HMS API - ReDoc")

@app.get("/api-reference", include_in_schema=False)
async def api_reference():
    return {
        "message": "API Reference",
        "endpoints": [
            {"path": "/docs", "description": "Swagger UI"},
            {"path": "/redoc", "description": "ReDoc"},
            {"path": "/openapi.json", "description": "OpenAPI Schema"},
        ]
    }

from sqlalchemy.exc import SQLAlchemyError
from pydantic import ValidationError

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    import traceback
    from app.utils.logger import get_logger
    logger = get_logger("global_error")
    logger.error(f"Unhandled exception: {exc}\n{traceback.format_exc()}")
    return JSONResponse(
        status_code=500,
        content={"message": "An unexpected error occurred. Please try again later.", "code": "INTERNAL_SERVER_ERROR"}
    )

@app.exception_handler(SQLAlchemyError)
async def sqlalchemy_exception_handler(request: Request, exc: SQLAlchemyError):
    from app.utils.logger import get_logger
    logger = get_logger("database_error")
    logger.error(f"Database error: {exc}")
    return JSONResponse(
        status_code=500,
        content={"message": "A database error occurred.", "code": "DATABASE_ERROR"}
    )

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    from app.utils.logger import get_logger
    logger = get_logger("validation_error")
    
    errors = exc.errors()
    simplified_errors = []
    for error in errors:
        # loc gives path to the field. Usually loc[0] is body, query, or path. Next are actual fields.
        loc = error.get("loc", [])
        field = ".".join([str(l) for l in loc]) if loc else "unknown"
        # Removing starting 'body.' or 'query.' for cleaner frontend display if desired, but let's keep it complete for now.
        if field.startswith("body."):
            field = field[5:]
        msg = error.get("msg", "Invalid value")
        simplified_errors.append({"field": field, "message": msg})
        
    logger.error(f"Validation error for {request.method} {request.url}: {simplified_errors}")
    
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "message": "Validation failed", 
            "code": "VALIDATION_ERROR", 
            "details": simplified_errors
        },
    )

@app.get("/")
def read_root():
    return {"message": "Hello World"}

if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
