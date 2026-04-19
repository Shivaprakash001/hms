import time
import logging
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

# Using Python's default logging to simplify or custom if preferred
from app.utils.logger import get_logger
logger = get_logger("query_monitor")

class QueryMonitorMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        start_time = time.time()
        
        # Execute the endpoint
        response = await call_next(request)
        
        process_time = time.time() - start_time
        
        # Add Execution Time header for easy client tracking
        response.headers["X-Process-Time"] = str(round(process_time, 4))
        
        # Log slow queries (Threshold: 0.5 seconds, can be configured via env var)
        if process_time > 0.5:
            logger.warning(
                f"Slow HTTP Query Detected: {request.method} {request.url.path} "
                f"took {process_time:.4f}s"
            )
            
        return response
