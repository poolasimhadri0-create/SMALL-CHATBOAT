import logging
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, status
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/health", tags=["Health"])


@router.get("")
async def health_check(db: AsyncSession = Depends(get_db)):
    """
    Health check endpoint:
    - Verifies API server is responsive.
    - Pings MySQL database connection with SELECT 1.
    """
    db_status = "connected"
    overall_status = "ok"
    http_status_code = status.HTTP_200_OK

    try:
        await db.execute(text("SELECT 1"))
    except Exception as exc:
        logger.error("Health check database ping failed: %s", exc)
        db_status = f"unhealthy: {exc}"
        overall_status = "degraded"
        http_status_code = status.HTTP_503_SERVICE_UNAVAILABLE

    return JSONResponse(
        status_code=http_status_code,
        content={
            "status": overall_status,
            "database": db_status,
            "gemini_model": settings.GEMINI_MODEL,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
    )
