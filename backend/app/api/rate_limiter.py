from fastapi import Request, HTTPException, status
from typing import Callable, Dict
from functools import wraps
from app.utils.logger import get_logger
import time

logger = get_logger("rate_limiter")

class RateLimitConfig:
    DEFAULT_LIMIT = 100
    DEFAULT_WINDOW = 3600  # seconds
    ENDPOINT_LIMITS = {
        "login": {"limit": 5, "window": 900},
        "payments": {"limit": 20, "window": 3600}
    }

class SimpleInMemoryRateLimiter:
    def __init__(self):
        self.requests: Dict[str, list] = {}

    def is_allowed(self, key: str, limit: int, window: int) -> bool:
        now = time.time()
        if key not in self.requests:
            self.requests[key] = []
        
        # Cleanup old
        self.requests[key] = [t for t in self.requests[key] if now - t < window]
        
        if len(self.requests[key]) >= limit:
            return False
            
        self.requests[key].append(now)
        return True

limiter = SimpleInMemoryRateLimiter()

def rate_limit(endpoint_name: str = "default"):
    def decorator(func: Callable):
        @wraps(func)
        async def wrapper(request: Request, *args, **kwargs):
            # Client IP
            client_ip = request.client.host if request.client else "127.0.0.1"
            key = f"{client_ip}:{endpoint_name}"
            
            config = RateLimitConfig.ENDPOINT_LIMITS.get(
                endpoint_name, 
                {"limit": RateLimitConfig.DEFAULT_LIMIT, "window": RateLimitConfig.DEFAULT_WINDOW}
            )
            
            if not limiter.is_allowed(key, config["limit"], config["window"]):
                logger.warning(f"Rate limit exceeded for {key}")
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Rate limit exceeded"
                )
            return await func(request, *args, **kwargs)
        return wrapper
    return decorator

def rate_limit_by_ip():
    pass

def rate_limit_by_user():
    pass
