"""
Centralized error handling and response utilities
"""
from typing import Dict, Any, Optional
from enum import Enum


class ErrorCode(str, Enum):
    """Standardized error codes for the application"""
    # Database errors
    DB_CONNECTION_ERROR = "DB_001"
    DB_QUERY_ERROR = "DB_002"
    DB_CONSTRAINT_VIOLATION = "DB_003"
    
    # Resource errors
    RESOURCE_NOT_FOUND = "RES_001"
    RESOURCE_ALREADY_EXISTS = "RES_002"
    RESOURCE_INACTIVE = "RES_003"
    
    # Validation errors
    VALIDATION_ERROR = "VAL_001"
    INVALID_INPUT = "VAL_002"
    
    # Authorization errors
    UNAUTHORIZED = "AUTH_001"
    FORBIDDEN = "AUTH_002"
    INSUFFICIENT_PERMISSIONS = "AUTH_003"
    
    # General errors
    INTERNAL_ERROR = "SYS_001"
    UNKNOWN_ERROR = "SYS_999"


class ServiceResponse:
    """Standardized service response wrapper"""
    
    @staticmethod
    def success(data: Any, message: str = "Operation successful") -> Dict[str, Any]:
        """Create a successful response"""
        return {
            "success": True,
            "data": data,
            "message": message,
            "error": None
        }
    
    @staticmethod
    def error(
        error_code: ErrorCode,
        message: str,
        details: Optional[str] = None,
        data: Any = None
    ) -> Dict[str, Any]:
        """Create an error response"""
        return {
            "success": False,
            "data": data,
            "message": message,
            "error": {
                "code": error_code.value,
                "message": message,
                "details": details
            }
        }
    
    @staticmethod
    def not_found(resource: str = "Resource", details: Optional[str] = None) -> Dict[str, Any]:
        """Create a not found error response"""
        return ServiceResponse.error(
            ErrorCode.RESOURCE_NOT_FOUND,
            f"{resource} not found",
            details
        )
    
    @staticmethod
    def already_exists(resource: str = "Resource", details: Optional[str] = None) -> Dict[str, Any]:
        """Create an already exists error response"""
        return ServiceResponse.error(
            ErrorCode.RESOURCE_ALREADY_EXISTS,
            f"{resource} already exists",
            details
        )
    
    @staticmethod
    def forbidden(message: str = "Insufficient permissions", details: Optional[str] = None) -> Dict[str, Any]:
        """Create a forbidden error response"""
        return ServiceResponse.error(
            ErrorCode.FORBIDDEN,
            message,
            details
        )
    
    @staticmethod
    def validation_error(message: str, details: Optional[str] = None) -> Dict[str, Any]:
        """Create a validation error response"""
        return ServiceResponse.error(
            ErrorCode.VALIDATION_ERROR,
            message,
            details
        )
