import pytest
from httpx import AsyncClient, ASGITransport
from unittest.mock import MagicMock
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.pool import StaticPool

from app.main import app
from app.core.config import settings
from app.core.database import Base, get_db
from app.services.gemini_service import gemini_service

# Setup in-memory SQLite async engine for automated integration testing
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


@pytest.fixture(autouse=True)
async def setup_test_db():
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest.mark.asyncio
async def test_health_check():
    """Verify GET /api/health returns database status and model configuration."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert data["database"] == "connected"
        assert data["gemini_model"] == settings.GEMINI_MODEL
        assert "timestamp" in data


@pytest.mark.asyncio
async def test_message_validation_empty():
    """Verify that empty message is rejected with 400 Bad Request."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post("/api/chat", data={"message": "   "})
        assert response.status_code == 400
        assert "Message content cannot be empty" in response.json()["error"]["message"]


@pytest.mark.asyncio
async def test_message_validation_length():
    """Verify that message exceeding 8000 characters is rejected with 400 Bad Request."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        long_msg = "a" * 8001
        response = await client.post("/api/chat", data={"message": long_msg})
        assert response.status_code == 400
        assert "exceeds maximum allowed length" in response.json()["error"]["message"]


@pytest.mark.asyncio
async def test_disallowed_image_type():
    """Verify that unsupported image MIME types are rejected with 400 Bad Request."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        files = {"image": ("test.txt", b"plain text content", "text/plain")}
        response = await client.post("/api/chat", data={"message": "Hello"}, files=files)
        assert response.status_code == 400
        assert "Invalid image type" in response.json()["error"]["message"]


@pytest.mark.asyncio
async def test_conversation_crud_flow():
    """Test full CRUD lifecycle for conversations."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. List conversations initially empty
        res = await client.get("/api/conversations")
        assert res.status_code == 200
        assert res.json() == []

        # 2. Create conversation in DB directly
        from app.services.conversation_service import conversation_service
        async with TestingSessionLocal() as session:
            conv, _ = await conversation_service.get_or_create_conversation(session)
            conv_id = conv.id

        # 3. Retrieve conversation
        res = await client.get(f"/api/conversations/{conv_id}")
        assert res.status_code == 200
        assert res.json()["id"] == conv_id
        assert res.json()["title"] == "New Conversation"

        # 4. Rename conversation
        res = await client.patch(f"/api/conversations/{conv_id}", json={"title": "Updated Topic"})
        assert res.status_code == 200
        assert res.json()["title"] == "Updated Topic"

        # 5. Search conversations
        search_res = await client.get("/api/conversations?q=Updated")
        assert search_res.status_code == 200
        assert len(search_res.json()) == 1

        search_empty = await client.get("/api/conversations?q=NonExistent")
        assert search_empty.status_code == 200
        assert len(search_empty.json()) == 0

        # 6. Delete conversation
        del_res = await client.delete(f"/api/conversations/{conv_id}")
        assert del_res.status_code == 200

        # 7. Verify deletion
        res_after = await client.get(f"/api/conversations/{conv_id}")
        assert res_after.status_code == 404


def test_gemini_sse_formatting():
    """Verify standard SSE format generation."""
    token_sse = gemini_service.format_sse("token", {"token": "Namaste"})
    assert token_sse == 'event: token\ndata: {"token": "Namaste"}\n\n'

    sources_sse = gemini_service.format_sse("sources", {"sources": [{"title": "Wiki", "uri": "https://wiki.org"}]})
    assert sources_sse == 'event: sources\ndata: {"sources": [{"title": "Wiki", "uri": "https://wiki.org"}]}\n\n'


def test_grounding_sources_extraction():
    """Verify source extraction from Google GenAI candidate."""
    mock_candidate = MagicMock()
    mock_chunk = MagicMock()
    mock_chunk.web.uri = "https://example.com"
    mock_chunk.web.title = "Example News"
    mock_candidate.grounding_metadata.grounding_chunks = [mock_chunk]

    sources = gemini_service.extract_sources_from_candidate(mock_candidate)
    assert len(sources) == 1
    assert sources[0]["uri"] == "https://example.com"
    assert sources[0]["title"] == "Example News"
