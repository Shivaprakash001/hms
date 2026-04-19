import time
from fastapi import Request, HTTPException, status
from collections import defaultdict

# Format: IP -> list of timestamps
login_attempts = defaultdict(list)
password_change_attempts = defaultdict(list)
api_calls = defaultdict(list)

def check_login_rate_limit(request: Request):
    """Max 5 failures per 15 minutes"""
    client_ip = request.client.host if request.client else "unknown"
    now = time.time()
    
    # 15 minutes = 900 seconds
    valid_attempts = [t for t in login_attempts[client_ip] if now - t < 900]
    login_attempts[client_ip] = valid_attempts
    
    if len(valid_attempts) >= 5:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many login attempts. Please try again after 15 minutes."
        )

def record_login_failure(request: Request):
    client_ip = request.client.host if request.client else "unknown"
    login_attempts[client_ip].append(time.time())


def check_password_change_rate_limit(request: Request):
    """Max 3 per hour"""
    client_ip = request.client.host if request.client else "unknown"
    now = time.time()
    
    # 1 hour = 3600 seconds
    valid_attempts = [t for t in password_change_attempts[client_ip] if now - t < 3600]
    password_change_attempts[client_ip] = valid_attempts
    
    if len(valid_attempts) >= 3:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many password change attempts. Please try again after 1 hour."
        )
    password_change_attempts[client_ip].append(time.time())


def check_api_rate_limit(request: Request):
    """Basic API rate limiting: Max 100 requests per minute per IP"""
    client_ip = request.client.host if request.client else "unknown"
    now = time.time()
    
    # 1 minute = 60 seconds
    valid_calls = [t for t in api_calls[client_ip] if now - t < 60]
    api_calls[client_ip] = valid_calls
    
    if len(valid_calls) >= 100:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many requests. Please try again later."
        )
    api_calls[client_ip].append(time.time())
