from fastapi import HTTPException, status
from typing import Any, Dict, Optional

class AppException(HTTPException):
    def __init__(
        self,
        status_code: int,
        code: str,
        message: str,
        details: Optional[Dict[str, Any]] = None,
    ):
        error_content = {
            "error": {
                "code": code,
                "message": message,
                "status": status_code,
            }
        }
        if details:
            error_content["error"]["details"] = details
        super().__init__(status_code=status_code, detail=error_content)

class NotFoundException(AppException):
    def __init__(self, message: str = "Resource not found", code: str = "RESOURCE_NOT_FOUND", details: Optional[Dict[str, Any]] = None):
        super().__init__(status.HTTP_404_NOT_FOUND, code, message, details)

class ConflictException(AppException):
    def __init__(self, message: str = "Resource conflict", code: str = "CONFLICT", details: Optional[Dict[str, Any]] = None):
        super().__init__(status.HTTP_409_CONFLICT, code, message, details)

class SlotConflictException(AppException):
    def __init__(
        self,
        message: str = "The selected appointment slot has just been booked. Please select another slot.",
        details: Optional[Dict[str, Any]] = None
    ):
        super().__init__(status.HTTP_409_CONFLICT, "SLOT_CONFLICT", message, details)

class UnauthorizedException(AppException):
    def __init__(self, message: str = "Authentication required or token expired", code: str = "UNAUTHORIZED"):
        super().__init__(status.HTTP_401_UNAUTHORIZED, code, message)

class ForbiddenException(AppException):
    def __init__(self, message: str = "Access forbidden: Insufficient privileges", code: str = "FORBIDDEN"):
        super().__init__(status.HTTP_403_FORBIDDEN, code, message)

class BadRequestException(AppException):
    def __init__(self, message: str = "Invalid request syntax or parameters", code: str = "VALIDATION_ERROR", details: Optional[Dict[str, Any]] = None):
        super().__init__(status.HTTP_400_BAD_REQUEST, code, message, details)
