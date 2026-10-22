import logging
from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
from slowapi.errors import RateLimitExceeded
from sqlalchemy.exc import SQLAlchemyError
from google.genai.errors import APIError, ClientError, ServerError

from app.core.logging_config import request_id_ctx_var

logger = logging.getLogger(__name__)


class ChatbotException(Exception):
    """Base class for chatbot application errors."""
    def __init__(self, message: str, status_code: int = 500, error_code: str = "INTERNAL_ERROR"):
        self.message = message
        self.status_code = status_code
        self.error_code = error_code
        super().__init__(message)


class GeminiQuotaExceededError(ChatbotException):
    def __init__(self, message: str = "Gemini API quota exceeded. Please try again in a few moments."):
        super().__init__(message, status_code=status.HTTP_429_TOO_MANY_REQUESTS, error_code="QUOTA_EXCEEDED")


class GeminiSafetyBlockError(ChatbotException):
    def __init__(self, message: str = "The request or response was blocked by safety filters."):
        super().__init__(message, status_code=status.HTTP_400_BAD_REQUEST, error_code="SAFETY_BLOCK")


class GeminiAuthError(ChatbotException):
    def __init__(self, message: str = "Invalid or missing Gemini API key. Please verify server configuration."):
        super().__init__(message, status_code=status.HTTP_401_UNAUTHORIZED, error_code="INVALID_API_KEY")


class GeminiNetworkError(ChatbotException):
    def __init__(self, message: str = "Unable to connect to Google Gemini services. Please check network connectivity."):
        super().__init__(message, status_code=status.HTTP_503_SERVICE_UNAVAILABLE, error_code="NETWORK_FAILURE")


class DatabaseConnectionError(ChatbotException):
    def __init__(self, message: str = "Database service is currently unreachable or encountered an error."):
        super().__init__(message, status_code=status.HTTP_503_SERVICE_UNAVAILABLE, error_code="DATABASE_ERROR")


def build_error_response(message: str, error_code: str, status_code: int) -> JSONResponse:
    req_id = request_id_ctx_var.get()
    return JSONResponse(
        status_code=status_code,
        content={
            "error": {
                "code": error_code,
                "message": message,
                "request_id": req_id
            }
        }
    )


def register_exception_handlers(app: FastAPI) -> None:
    """Registers unified global exception handlers on the FastAPI application."""

    @app.exception_handler(RateLimitExceeded)
    async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
        logger.warning("Rate limit exceeded for client: %s", request.client.host if request.client else "unknown")
        return build_error_response(
            message="Rate limit exceeded. Maximum 30 requests per minute allowed.",
            error_code="RATE_LIMIT_EXCEEDED",
            status_code=status.HTTP_429_TOO_MANY_REQUESTS
        )

    @app.exception_handler(ChatbotException)
    async def chatbot_exception_handler(request: Request, exc: ChatbotException):
        logger.error("ChatbotException [%s]: %s", exc.error_code, exc.message)
        return build_error_response(
            message=exc.message,
            error_code=exc.error_code,
            status_code=exc.status_code
        )

    @app.exception_handler(APIError)
    async def gemini_api_error_handler(request: Request, exc: APIError):
        code = getattr(exc, "code", None)
        message = str(exc)
        logger.error("Google GenAI APIError (code=%s): %s", code, message)

        if code == 429:
            return build_error_response(
                message="Gemini API rate limit or quota exceeded. Please try again shortly.",
                error_code="QUOTA_EXCEEDED",
                status_code=status.HTTP_429_TOO_MANY_REQUESTS
            )
        elif code in (401, 403):
            return build_error_response(
                message="Invalid or unauthorized Gemini API key.",
                error_code="INVALID_API_KEY",
                status_code=status.HTTP_401_UNAUTHORIZED
            )
        elif code == 400 and ("safety" in message.lower() or "blocked" in message.lower()):
            return build_error_response(
                message="Request was blocked by content safety policies.",
                error_code="SAFETY_BLOCK",
                status_code=status.HTTP_400_BAD_REQUEST
            )
        elif code in (500, 502, 503, 504):
            return build_error_response(
                message="Gemini AI service temporarily unavailable. Please retry.",
                error_code="NETWORK_FAILURE",
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE
            )
        else:
            return build_error_response(
                message=f"Gemini API error: {message}",
                error_code="GEMINI_API_ERROR",
                status_code=status.HTTP_502_BAD_GATEWAY
            )

    @app.exception_handler(SQLAlchemyError)
    async def sqlalchemy_exception_handler(request: Request, exc: SQLAlchemyError):
        logger.error("Database error occurred: %s", exc, exc_info=True)
        return build_error_response(
            message="Database query or connection failure occurred.",
            error_code="DATABASE_ERROR",
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE
        )

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError):
        logger.warning("Request validation failed: %s", exc.errors())
        return build_error_response(
            message="Invalid request payload or parameters.",
            error_code="VALIDATION_ERROR",
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY
        )

    @app.exception_handler(StarletteHTTPException)
    async def http_exception_handler(request: Request, exc: StarletteHTTPException):
        return build_error_response(
            message=exc.detail if isinstance(exc.detail, str) else "HTTP error occurred",
            error_code=f"HTTP_{exc.status_code}",
            status_code=exc.status_code
        )

    @app.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception):
        logger.error("Unhandled server exception: %s", exc, exc_info=True)
        return build_error_response(
            message="An unexpected server error occurred. Please try again later.",
            error_code="INTERNAL_SERVER_ERROR",
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
