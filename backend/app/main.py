import os
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.core.config import settings
from app.core.database import engine
from app.core.logging_config import setup_logging, RequestIdMiddleware
from app.core.rate_limiter import limiter
from app.core.exceptions import register_exception_handlers
from app.api.routes import chat_router, conversations_router, health_router

# Initialize structured logging
setup_logging()
logger = logging.getLogger("app.main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Handles startup and shutdown lifecycle events."""
    logger.info("Initializing AI Chatbot Backend...")
    logger.info("Gemini Model configured: %s", settings.GEMINI_MODEL)
    logger.info("Allowed CORS Origin: %s", settings.CLIENT_ORIGIN)

    # Ensure upload directory exists
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)

    # Ensure database schema is created
    try:
        from app.core.database import Base
        import app.models
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.info("Database schema initialized.")
    except Exception as db_init_err:
        logger.warning("Database schema auto-creation deferred: %s", db_init_err)

    # Pre-warm Gemini GenAI client
    try:
        from app.services.gemini_service import gemini_service
        gemini_service.get_client()
        logger.info("Gemini client connection pre-warmed.")
    except Exception as e:
        logger.warning("Client pre-warm skipped: %s", e)

    yield

    # Clean shutdown of database pool
    logger.info("Shutting down database connection engine...")
    await engine.dispose()
    logger.info("Application shutdown complete.")


# Instantiate FastAPI application
app = FastAPI(
    title="Gemini AI Chatbot Backend",
    description="High-performance async backend for an AI chatbot powered by Google Gemini API and MySQL.",
    version="1.0.0",
    lifespan=lifespan,
)

# Attach slowapi rate limiter state
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Request ID tracking middleware
app.add_middleware(RequestIdMiddleware)

# CORS middleware supporting configured origin, Render frontend, and local dev ports
raw_origins = [o.strip() for o in settings.CLIENT_ORIGIN.split(",") if o.strip()]
raw_origins.extend([
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "https://small-chatboat-1.onrender.com",
])
allowed_origins = list(set(raw_origins))

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins if "*" not in allowed_origins else ["*"],
    allow_origin_regex=r"https://.*\.onrender\.com",
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["X-Request-ID"],
)

# Register unified global exception handlers
register_exception_handlers(app)

# Include API route modules
app.include_router(health_router)
app.include_router(chat_router)
app.include_router(conversations_router)


@app.get("/", tags=["Root"])
async def root():
    """Welcome endpoint providing service status and quick links."""
    return {
        "service": "Gemini AI Chatbot API",
        "status": "online",
        "model": settings.GEMINI_MODEL,
        "docs_swagger": "/docs",
        "docs_redoc": "/redoc",
        "health_check": "/api/health",
        "endpoints": [
            {"method": "POST", "path": "/api/chat", "desc": "Chat streaming (SSE) with text, image & grounding"},
            {"method": "POST", "path": "/api/chat/{id}/regenerate", "desc": "Regenerate last response"},
            {"method": "GET", "path": "/api/conversations", "desc": "List conversations (?q=search)"},
            {"method": "GET", "path": "/api/conversations/{id}", "desc": "Get conversation with messages"},
            {"method": "PATCH", "path": "/api/conversations/{id}", "desc": "Rename conversation title"},
            {"method": "DELETE", "path": "/api/conversations/{id}", "desc": "Delete conversation and messages"},
            {"method": "GET", "path": "/api/health", "desc": "Health check and MySQL ping"}
        ]
    }


# Mount uploads directory for static image access
if not os.path.exists(settings.UPLOAD_DIR):
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=settings.PORT, reload=True)
