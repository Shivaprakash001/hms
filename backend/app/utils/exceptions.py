from fastapi import HTTPException, status

class BaseAPIException(HTTPException):
    def __init__(self, status_code: int, detail: str):
        super().__init__(status_code=status_code, detail=detail)

class ResourceNotFound(BaseAPIException):
    def __init__(self, resource_name: str, resource_id: str = None):
        detail = f"{resource_name} not found"
        if resource_id:
            detail += f" with id: {resource_id}"
        super().__init__(status.HTTP_404_NOT_FOUND, detail)

class UnauthorizedException(BaseAPIException):
    def __init__(self, detail: str = "Not authenticated"):
        super().__init__(
            status.HTTP_401_UNAUTHORIZED, 
            detail
        )
        self.headers = {"WWW-Authenticate": "Bearer"}

class ValidationException(BaseAPIException):
    def __init__(self, detail: str):
        super().__init__(status.HTTP_400_BAD_REQUEST, detail)

class RateLimitExceeded(BaseAPIException):
    def __init__(self, detail: str = "Rate limit exceeded. Please try again later."):
        super().__init__(status.HTTP_429_TOO_MANY_REQUESTS, detail)

class ForbiddenException(BaseAPIException):
     def __init__(self, detail: str = "You do not have permission to perform this action"):
        super().__init__(status.HTTP_403_FORBIDDEN, detail)
