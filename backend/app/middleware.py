import time
import uuid
import sys
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from app.utils.logger import get_logger

logger = get_logger("request_middleware")

class LoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        request_id = str(uuid.uuid4())
        start_time = time.time()
        
        # Attach request_id to request state so other parts of the app can use it
        request.state.request_id = request_id
        
        # We can extract user_context if needed (e.g. from Authorization headers, though not decoded here)
        user_id = "anonymous"
        
        # Put contextual info into logger by creating a specialized log record or by injecting it into log messages
        # Here we just pass it in the extra dict as python-json-logger supports that
        extra = {
            "request_id": request_id,
            "user_id": user_id,
            "method": request.method,
            "url": str(request.url.path),
            "client_ip": request.client.host if request.client else None
        }
        
        logger.info(f"Incoming request: {request.method} {request.url.path}", extra=extra)
        
        try:
            response = await call_next(request)
            
            process_time = time.time() - start_time
            extra["latency"] = round(process_time, 4)
            extra["status_code"] = response.status_code
            
            # Record metric
            logger.info("Request completed", extra={
                **extra, 
                "metric_type": "http_request",
                "duration": process_time
            })
            
            response.headers["X-Request-ID"] = request_id
            response.headers["X-Process-Time"] = str(process_time)
            return response
            
        except Exception as e:
            process_time = time.time() - start_time
            extra["latency"] = round(process_time, 4)
            extra["error"] = str(e)
            
            # Record metric error
            logger.error("Request failed with unhandled exception", extra={
                **extra,
                "metric_type": "http_request_error",
                "duration": process_time
            }, exc_info=True)
            
            raise e
