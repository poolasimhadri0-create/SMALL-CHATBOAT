import asyncio
import os
import sys
from unittest.mock import MagicMock
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.pool import StaticPool

# Ensure project root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.main import app
from app.core.config import settings
from app.core.database import Base, get_db
from app.services.gemini_service import gemini_service
from app.services.conversation_service import conversation_service

TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

test_engine = create_async_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = async_sessionmaker(
    bind=test_engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def override_get_db():
    async with TestingSessionLocal() as session:
        yield session


app.dependency_overrides[get_db] = override_get_db


async def run_all_tests():
    print("==================================================")
    print("      AI CHATBOT BACKEND AUTOMATED TEST SUITE     ")
    print("==================================================")

    # Initialize in-memory tables
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Test 1: Health Check Endpoint
        print("\n[TEST 1] Testing GET /api/health ...")
        res = await client.get("/api/health")
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        data = res.json()
        assert data["status"] == "ok"
        assert data["database"] == "connected"
        assert data["gemini_model"] == settings.GEMINI_MODEL
        print(f"  --> PASSED: Health check OK (database={data['database']}, model={data['gemini_model']})")

        # Test 2: Input Validation (Empty message)
        print("\n[TEST 2] Testing POST /api/chat empty message validation ...")
        res = await client.post("/api/chat", data={"message": "   "})
        assert res.status_code == 400, f"Expected 400, got {res.status_code}"
        assert "Message content cannot be empty" in res.json()["error"]["message"]
        print("  --> PASSED: Empty message rejected with 400 Bad Request")

        # Test 3: Input Validation (Message length > 8000)
        print("\n[TEST 3] Testing POST /api/chat length validation (> 8000 chars) ...")
        res = await client.post("/api/chat", data={"message": "a" * 8001})
        assert res.status_code == 400, f"Expected 400, got {res.status_code}"
        assert "exceeds maximum allowed length" in res.json()["error"]["message"]
        print("  --> PASSED: Oversized message rejected with 400 Bad Request")

        # Test 4: Image MIME validation
        print("\n[TEST 4] Testing image MIME validation (disallowing text/plain) ...")
        files = {"image": ("note.txt", b"plain text", "text/plain")}
        res = await client.post("/api/chat", data={"message": "Analyze this"}, files=files)
        assert res.status_code == 400, f"Expected 400, got {res.status_code}"
        assert "Invalid image type" in res.json()["error"]["message"]
        print("  --> PASSED: Invalid image type rejected with 400 Bad Request")

        # Test 5: Conversations CRUD Lifecycle
        print("\n[TEST 5] Testing Conversations CRUD Lifecycle ...")
        # List initial
        res = await client.get("/api/conversations")
        assert res.status_code == 200
        assert res.json() == []

        # Create conversation directly in test DB
        async with TestingSessionLocal() as session:
            conv, _ = await conversation_service.get_or_create_conversation(session)
            conv_id = conv.id

        # Retrieve conversation details
        res = await client.get(f"/api/conversations/{conv_id}")
        assert res.status_code == 200
        assert res.json()["id"] == conv_id
        assert res.json()["title"] == "New Conversation"

        # Rename conversation
        res = await client.patch(f"/api/conversations/{conv_id}", json={"title": "Hinglish Chat with Gemini"})
        assert res.status_code == 200
        assert res.json()["title"] == "Hinglish Chat with Gemini"

        # Search conversation
        res_search = await client.get("/api/conversations?q=Hinglish")
        assert res_search.status_code == 200
        assert len(res_search.json()) == 1

        res_none = await client.get("/api/conversations?q=NonExistent")
        assert res_none.status_code == 200
        assert len(res_none.json()) == 0

        # Delete conversation
        del_res = await client.delete(f"/api/conversations/{conv_id}")
        assert del_res.status_code == 200

        # Verify deletion returns 404
        res_deleted = await client.get(f"/api/conversations/{conv_id}")
        assert res_deleted.status_code == 404
        print("  --> PASSED: Conversations listing, get, patch, search, and delete work flawlessly")

        # Test 6: SSE Format Verification
        print("\n[TEST 6] Testing SSE Formatter ...")
        token_sse = gemini_service.format_sse("token", {"token": "Namaste"})
        assert token_sse == 'event: token\ndata: {"token": "Namaste"}\n\n'
        done_sse = gemini_service.format_sse("done", {"conversation_id": "123", "message_id": 456})
        assert "event: done" in done_sse
        print("  --> PASSED: SSE format follows RFC event/data specification")

        # Test 7: Grounding metadata extraction
        print("\n[TEST 7] Testing Grounding Metadata / Sources Extraction ...")
        mock_cand = MagicMock()
        mock_chunk = MagicMock()
        mock_chunk.web.uri = "https://news.google.com/sample"
        mock_chunk.web.title = "Sample News Grounding"
        mock_cand.grounding_metadata.grounding_chunks = [mock_chunk]

        sources = gemini_service.extract_sources_from_candidate(mock_cand)
        assert len(sources) == 1
        assert sources[0]["uri"] == "https://news.google.com/sample"
        assert sources[0]["title"] == "Sample News Grounding"
        print(f"  --> PASSED: Grounding source extracted: {sources[0]['title']}")

        # Test 8: End-to-end SSE Streaming chat
        print("\n[TEST 8] Testing POST /api/chat SSE streaming with mocked Gemini...")
        import app.api.routes.chat as chat_module
        chat_module.AsyncSessionLocal = TestingSessionLocal

        class MockChunk:
            def __init__(self, text="", sources=None):
                self.text = text
                if sources:
                    mock_chunk = MagicMock()
                    mock_chunk.web.uri = sources[0]["uri"]
                    mock_chunk.web.title = sources[0]["title"]
                    mock_cand = MagicMock()
                    mock_cand.grounding_metadata.grounding_chunks = [mock_chunk]
                    self.candidates = [mock_cand]
                else:
                    self.candidates = []

        async def mock_generate_stream(*args, **kwargs):
            yield MockChunk(sources=[{"title": "Google", "uri": "https://google.com"}])
            yield MockChunk(text="Hello ")
            yield MockChunk(text="World!")

        mock_client = MagicMock()
        mock_client.aio.models.generate_content_stream = mock_generate_stream
        gemini_service._client = mock_client
        gemini_service.generate_title = MagicMock(return_value=asyncio.Future())
        gemini_service.generate_title.return_value.set_result("AI Greetings")

        chat_res = await client.post("/api/chat", data={"message": "Hi Gemini!"})
        assert chat_res.status_code == 200
        assert "text/event-stream" in chat_res.headers["content-type"]
        body = chat_res.text
        assert "event: sources" in body
        assert "event: token" in body
        assert "event: done" in body
        print("  --> PASSED: Chat streamed SSE events (sources, token, done)")

        # Test 9: Regenerate endpoint
        print("\n[TEST 9] Testing POST /api/chat/{id}/regenerate...")
        all_convs = (await client.get("/api/conversations")).json()
        assert len(all_convs) > 0
        active_conv_id = all_convs[0]["id"]

        regen_res = await client.post(f"/api/chat/{active_conv_id}/regenerate")
        assert regen_res.status_code == 200
        assert "text/event-stream" in regen_res.headers["content-type"]
        regen_body = regen_res.text
        assert "event: token" in regen_body
        assert "event: done" in regen_body
        print("  --> PASSED: Regenerate streamed new SSE response")

    print("\n==================================================")
    print("       ALL 9 BACKEND TESTS PASSED SUCCESSFULLY!   ")
    print("==================================================")


if __name__ == "__main__":
    asyncio.run(run_all_tests())
