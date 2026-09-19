from datetime import datetime, timezone
from typing import Any, Optional
from fastapi import HTTPException, Request
from fastapi.responses import JSONResponse

class AppException(HTTPException):
    def __init__(
        self,
        status_code: int,
        code: str,
        message: str,
        details: Optional[Any] = None
    ):
        super().__init__(status_code=status_code, detail=message)
        self.code = code
        self.message = message
        self.details = details

class InsufficientStockException(AppException):
    def __init__(self, message: str = "Insufficient available inventory", details: Optional[Any] = None):
        super().__init__(status_code=409, code="INSUFFICIENT_STOCK", message=message, details=details)

class KYCPendingException(AppException):
    def __init__(self, message: str = "KYC verification is required before performing this action", details: Optional[Any] = None):
        super().__init__(status_code=403, code="KYC_NOT_APPROVED", message=message, details=details)

class InvalidOrderStateTransitionException(AppException):
    def __init__(self, message: str = "Invalid order state transition", details: Optional[Any] = None):
        super().__init__(status_code=400, code="INVALID_ORDER_STATE_TRANSITION", message=message, details=details)

class UnauthorizedRoleException(AppException):
    def __init__(self, message: str = "You do not have permission to perform this action", details: Optional[Any] = None):
        super().__init__(status_code=403, code="FORBIDDEN_ROLE", message=message, details=details)

async def app_exception_handler(request: Request, exc: AppException) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "code": exc.code,
                "message": exc.message,
                "details": exc.details,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
        }
    )
