import json
import os
import redis
from functools import wraps
import asyncio
from typing import Optional
from app.utils.logger import get_logger

logger = get_logger("redis_cache")

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

try:
    redis_client = redis.from_url(REDIS_URL, decode_responses=True)
    # Test connection
    redis_client.ping()
except Exception as e:
    logger.warning(f"Failed to connect to Redis. Caching will be disabled. Error: {e}")
    redis_client = None

def get_cache(key: str) -> Optional[dict]:
    if not redis_client:
        return None
    try:
        data = redis_client.get(key)
        return json.loads(data) if data else None
    except Exception as e:
        logger.error(f"Redis get error: {e}")
        return None

def set_cache(key: str, value: dict, ttl_seconds: int = 300) -> bool:
    if not redis_client:
        return False
    try:
        redis_client.setex(key, ttl_seconds, json.dumps(value))
        return True
    except Exception as e:
        logger.error(f"Redis set error: {e}")
        return False

def invalidate_cache(key_pattern: str):
    """
    Invalidates cache using a pattern.
    Example: invalidate_cache("cache:rooms:*")
    """
    if not redis_client:
        return
    try:
        keys = redis_client.keys(key_pattern)
        if keys:
            redis_client.delete(*keys)
    except Exception as e:
        logger.error(f"Redis invalidate error: {e}")
