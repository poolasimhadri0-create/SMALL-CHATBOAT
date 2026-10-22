from pathlib import Path
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict

_BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
_ROOT_DIR = _BACKEND_DIR.parent

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env", str(_BACKEND_DIR / ".env"), str(_ROOT_DIR / ".env")),
        env_file_encoding="utf-8",
        extra="ignore"
    )

    # Gemini API
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-3.5-flash-lite"
    ENABLE_SEARCH_GROUNDING: bool = False

    # Database (defaults to local/cloud SQLite if no remote MySQL DATABASE_URL is provided)
    DATABASE_URL: str = "sqlite+aiosqlite:///chatbot.db"

    # CORS
    CLIENT_ORIGIN: str = "http://localhost:5173"

    # Server Port
    PORT: int = 5000

    # Safety & Limits
    MAX_MESSAGE_LENGTH: int = 8000
    MAX_FILE_SIZE_MB: int = 5
    ALLOWED_IMAGE_TYPES: List[str] = ["image/png", "image/jpeg", "image/webp"]
    RATE_LIMIT_PER_MINUTE: str = "30/minute"
    MAX_HISTORY_MESSAGES: int = 20
    UPLOAD_DIR: str = str(_BACKEND_DIR / "uploads")

    # Fast, direct system instruction
    SYSTEM_INSTRUCTION: str = (
        "You are an ultra-fast, helpful, and concise AI assistant. "
        "Always respond clearly, accurately, and directly in English with zero filler."
    )


settings = Settings()
