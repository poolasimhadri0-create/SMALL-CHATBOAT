import json
import logging
from typing import AsyncIterator, List, Dict, Any, Optional
from google import genai
from google.genai import types
from google.genai.errors import APIError
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception

from app.core.config import settings

logger = logging.getLogger(__name__)


def is_retryable_gemini_error(exc: BaseException) -> bool:
    """Returns True if the exception from Gemini is retryable (429 or 503)."""
    if isinstance(exc, APIError):
        code = getattr(exc, "code", None)
        return code in (429, 503)
    return False


from app.core.exceptions import GeminiAuthError


class GeminiService:
    """Service wrapping Google Gen AI SDK for chat completions, grounding, and title generation."""

    def __init__(self):
        self._client: Optional[genai.Client] = None

    def get_client(self) -> genai.Client:
        """Lazy initialization of Google GenAI client."""
        if self._client is not None:
            return self._client
        if not settings.GEMINI_API_KEY:
            raise GeminiAuthError("GEMINI_API_KEY is not configured on the server. Please check your .env file.")
        self._client = genai.Client(api_key=settings.GEMINI_API_KEY)
        return self._client

    def format_sse(self, event: str, data: Dict[str, Any]) -> str:
        """Formats data into standard Server-Sent Events (SSE) string."""
        json_data = json.dumps(data, ensure_ascii=False)
        return f"event: {event}\ndata: {json_data}\n\n"

    def build_system_config(self, enable_search: bool = True) -> types.GenerateContentConfig:
        """Constructs GenerateContentConfig with system instructions and Google Search grounding."""
        tools = []
        if enable_search:
            tools.append(types.Tool(google_search=types.GoogleSearch()))

        return types.GenerateContentConfig(
            system_instruction=settings.SYSTEM_INSTRUCTION,
            tools=tools if tools else None,
            temperature=0.2,
            max_output_tokens=400,
        )

    def extract_sources_from_candidate(self, candidate: Any) -> List[Dict[str, str]]:
        """Extracts web grounding sources from candidate metadata."""
        sources: List[Dict[str, str]] = []
        seen_uris = set()

        grounding_meta = getattr(candidate, "grounding_metadata", None)
        if not grounding_meta:
            return sources

        grounding_chunks = getattr(grounding_meta, "grounding_chunks", None)
        if grounding_chunks:
            for chunk in grounding_chunks:
                web = getattr(chunk, "web", None)
                if web:
                    uri = getattr(web, "uri", None)
                    title = getattr(web, "title", None)
                    if uri and uri not in seen_uris:
                        seen_uris.add(uri)
                        sources.append({
                            "title": title or uri,
                            "uri": uri
                        })
        return sources

    async def generate_title(self, user_message: str) -> str:
        """Instantly generates a clean 3-5 word title for the conversation without extra network latency."""
        clean_words = user_message.strip().split()[:5]
        if not clean_words:
            return "New Conversation"
        title = " ".join(clean_words).replace('"', '').replace("'", "")
        return title[:60].capitalize()


gemini_service = GeminiService()
