import os
import inspect
import asyncio
import logging
from typing import Optional, List, Dict, Any
from fastapi import (
    APIRouter,
    Depends,
    Request,
    Form,
    File,
    UploadFile,
    HTTPException,
    BackgroundTasks,
    status,
)
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from google.genai import types

from app.core.config import settings
from app.core.database import get_db, AsyncSessionLocal
from app.core.rate_limiter import limiter
from app.services.gemini_service import gemini_service
from app.services.conversation_service import conversation_service
from app.api.deps import process_and_save_image

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/chat", tags=["Chat"])


async def generate_title_background_task(conversation_id: str, first_message: str):
    """Background task to generate and persist a short title for a new conversation."""
    try:
        new_title = await gemini_service.generate_title(first_message)
        async with AsyncSessionLocal() as db_session:
            await conversation_service.update_title(db_session, conversation_id, new_title)
            logger.info("Title generated for %s: '%s'", conversation_id, new_title)
    except Exception as e:
        logger.error("Failed background title generation for %s: %s", conversation_id, e)


@router.post("")
@limiter.limit("30/minute")
async def chat_endpoint(
    request: Request,
    background_tasks: BackgroundTasks,
    message: str = Form(..., description="User message text"),
    conversation_id: Optional[str] = Form(None, description="Optional conversation UUID"),
    image: Optional[UploadFile] = File(None, description="Optional image upload (PNG, JPEG, WEBP <= 5MB)"),
    db: AsyncSession = Depends(get_db),
):
    """
    Main chat completion endpoint.
    - Supports text and optional image (multimodal).
    - Creates conversation if none provided.
    - Loads conversation history (trimmed to context window).
    - Streams response token-by-token using SSE (events: token, sources, done, error).
    - Saves user message and full/partial model reply to MySQL.
    """
    # Validate message length
    trimmed_msg = message.strip()
    if not trimmed_msg:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Message content cannot be empty."
        )
    if len(trimmed_msg) > settings.MAX_MESSAGE_LENGTH:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Message exceeds maximum allowed length of {settings.MAX_MESSAGE_LENGTH} characters."
        )

    # Process image if provided
    image_info = await process_and_save_image(image)
    image_path = image_info[0] if image_info else None
    image_bytes = image_info[1] if image_info else None
    image_mime = image_info[2] if image_info else None

    # Generate instant title for zero-latency startup
    auto_title = " ".join(trimmed_msg.split()[:5])[:60].capitalize() if not conversation_id else None
    conv, is_new = await conversation_service.get_or_create_conversation(db, conversation_id, initial_title=auto_title)
    conv_id = conv.id

    # Save user message to database
    await conversation_service.save_user_message(
        db=db,
        conversation_id=conv_id,
        content=trimmed_msg,
        image_path=image_path
    )

    # Fetch history only if existing conversation with prior messages
    history_to_add = []
    if not is_new:
        recent_messages = await conversation_service.get_recent_history(
            db=db,
            conversation_id=conv_id,
            limit=settings.MAX_HISTORY_MESSAGES
        )
        history_to_add = recent_messages[:-1] if len(recent_messages) > 1 else []

    contents: List[types.Content] = []
    for msg in history_to_add:
        contents.append(
            types.Content(
                role=msg.role,
                parts=[types.Part.from_text(text=msg.content)]
            )
        )

    # Add current message (with image part if present)
    current_parts = []
    if image_bytes and image_mime:
        current_parts.append(types.Part.from_bytes(data=image_bytes, mime_type=image_mime))
    current_parts.append(types.Part.from_text(text=trimmed_msg))

    contents.append(types.Content(role="user", parts=current_parts))

    # Prepare streaming response (enable search if configured)
    config = gemini_service.build_system_config(enable_search=settings.ENABLE_SEARCH_GROUNDING)

    async def event_generator():
        client = gemini_service.get_client()
        full_reply_text = ""
        captured_sources: List[Dict[str, str]] = []
        sources_sent = False

        try:
            import time
            t_gen_start = time.time()
            # Attempt generation with configured settings
            active_config = config
            try:
                stream_or_coro = client.aio.models.generate_content_stream(
                    model=settings.GEMINI_MODEL,
                    contents=contents,
                    config=active_config,
                )
                response_stream = await stream_or_coro if inspect.isawaitable(stream_or_coro) else stream_or_coro
                logger.info("Time to establish Gemini stream: %.3fs", time.time() - t_gen_start)
            except Exception as init_err:
                if active_config.tools and ("quota" in str(init_err).lower() or "429" in str(init_err)):
                    logger.warning("Search tool exceeded quota; falling back to standard generation.")
                    active_config = gemini_service.build_system_config(enable_search=False)
                    stream_or_coro = client.aio.models.generate_content_stream(
                        model=settings.GEMINI_MODEL,
                        contents=contents,
                        config=active_config,
                    )
                    response_stream = await stream_or_coro if inspect.isawaitable(stream_or_coro) else stream_or_coro
                else:
                    raise init_err

            try:
                async for chunk in response_stream:
                    # Check for client cancellation
                    if await request.is_disconnected():
                        logger.warning("Client disconnected from chat stream for conv %s", conv_id)
                        break

                    # Extract grounding metadata / sources
                    if chunk.candidates:
                        cand = chunk.candidates[0]
                        sources = gemini_service.extract_sources_from_candidate(cand)
                        if sources and not sources_sent:
                            captured_sources = sources
                            sources_sent = True
                            yield gemini_service.format_sse("sources", {"sources": sources})
                            await asyncio.sleep(0)

                    # Stream tokens
                    if chunk.text:
                        if not full_reply_text:
                            logger.info("Time to FIRST token chunk: %.3fs", time.time() - t_gen_start)
                        full_reply_text += chunk.text
                        yield gemini_service.format_sse("token", {"token": chunk.text})
                        await asyncio.sleep(0)

            except Exception as stream_iter_err:
                # If search tool triggered quota exhaustion during iteration and no tokens were sent yet
                if active_config.tools and not full_reply_text and ("quota" in str(stream_iter_err).lower() or "429" in str(stream_iter_err)):
                    logger.warning("Search tool stream failed with quota limit; retrying cleanly without search.")
                    fallback_config = gemini_service.build_system_config(enable_search=False)
                    fallback_stream = await client.aio.models.generate_content_stream(
                        model=settings.GEMINI_MODEL,
                        contents=contents,
                        config=fallback_config,
                    )
                    async for chunk in fallback_stream:
                        if await request.is_disconnected():
                            break
                        if chunk.text:
                            full_reply_text += chunk.text
                            yield gemini_service.format_sse("token", {"token": chunk.text})
                            await asyncio.sleep(0)
                else:
                    raise stream_iter_err

            # Save model response in DB (even if disconnected/partial)
            async with AsyncSessionLocal() as save_db:
                model_msg = await conversation_service.save_model_message(
                    db=save_db,
                    conversation_id=conv_id,
                    content=full_reply_text,
                    sources=captured_sources if captured_sources else None
                )
                yield gemini_service.format_sse(
                    "done",
                    {
                        "conversation_id": conv_id,
                        "message_id": model_msg.id,
                        "title": conv.title
                    }
                )

        except Exception as exc:
            logger.error("Error during Gemini chat streaming: %s", exc, exc_info=True)
            yield gemini_service.format_sse("error", {"error": str(exc)})
            # Save partial reply if any was generated
            if full_reply_text:
                try:
                    async with AsyncSessionLocal() as save_db:
                        await conversation_service.save_model_message(
                            db=save_db,
                            conversation_id=conv_id,
                            content=full_reply_text,
                            sources=captured_sources if captured_sources else None
                        )
                except Exception as save_err:
                    logger.error("Failed saving partial reply: %s", save_err)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
    )


@router.post("/{conversation_id}/regenerate")
@limiter.limit("30/minute")
async def regenerate_endpoint(
    conversation_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    Regenerates the last model answer in the given conversation.
    - Deletes previous AI message.
    - Sends conversation history back to Gemini.
    - Streams new reply token-by-token via SSE.
    """
    # Verify conversation exists
    conv = await conversation_service.get_conversation_by_id(db, conversation_id)
    if not conv:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Conversation '{conversation_id}' not found."
        )

    # Check last user message
    last_user_msg = await conversation_service.get_last_user_message(db, conversation_id)
    if not last_user_msg:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot regenerate: No previous user message found in this conversation."
        )

    # Remove last model reply
    await conversation_service.remove_last_model_message(db, conversation_id)

    # Load history up to MAX_HISTORY_MESSAGES
    recent_messages = await conversation_service.get_recent_history(
        db=db,
        conversation_id=conversation_id,
        limit=settings.MAX_HISTORY_MESSAGES
    )

    contents: List[types.Content] = []
    for msg in recent_messages:
        parts = []
        # If user message had an image stored locally, read and include it
        if msg.role == "user" and msg.image_path and os.path.exists(msg.image_path):
            try:
                with open(msg.image_path, "rb") as img_f:
                    img_bytes = img_f.read()
                mime = "image/png" if msg.image_path.endswith(".png") else "image/jpeg"
                parts.append(types.Part.from_bytes(data=img_bytes, mime_type=mime))
            except Exception as read_err:
                logger.warning("Could not reload image from disk for regeneration: %s", read_err)

        parts.append(types.Part.from_text(text=msg.content))
        contents.append(types.Content(role=msg.role, parts=parts))

    config = gemini_service.build_system_config(enable_search=settings.ENABLE_SEARCH_GROUNDING)

    async def regenerate_generator():
        client = gemini_service.get_client()
        full_reply_text = ""
        captured_sources: List[Dict[str, str]] = []
        sources_sent = False

        try:
            active_config = config
            try:
                stream_or_coro = client.aio.models.generate_content_stream(
                    model=settings.GEMINI_MODEL,
                    contents=contents,
                    config=active_config,
                )
                response_stream = await stream_or_coro if inspect.isawaitable(stream_or_coro) else stream_or_coro
            except Exception as init_err:
                if active_config.tools and ("quota" in str(init_err).lower() or "429" in str(init_err)):
                    logger.warning("Regenerate search tool hit quota limit; falling back to standard generation.")
                    active_config = gemini_service.build_system_config(enable_search=False)
                    stream_or_coro = client.aio.models.generate_content_stream(
                        model=settings.GEMINI_MODEL,
                        contents=contents,
                        config=active_config,
                    )
                    response_stream = await stream_or_coro if inspect.isawaitable(stream_or_coro) else stream_or_coro
                else:
                    raise init_err

            try:
                async for chunk in response_stream:
                    if await request.is_disconnected():
                        logger.warning("Client disconnected from regenerate stream: %s", conversation_id)
                        break

                    if chunk.candidates:
                        cand = chunk.candidates[0]
                        sources = gemini_service.extract_sources_from_candidate(cand)
                        if sources and not sources_sent:
                            captured_sources = sources
                            sources_sent = True
                            yield gemini_service.format_sse("sources", {"sources": sources})
                            await asyncio.sleep(0)

                    if chunk.text:
                        full_reply_text += chunk.text
                        yield gemini_service.format_sse("token", {"token": chunk.text})
                        await asyncio.sleep(0)
            except Exception as loop_err:
                if active_config.tools and not full_reply_text and ("quota" in str(loop_err).lower() or "429" in str(loop_err)):
                    logger.warning("Regenerate search tool failed in stream; falling back.")
                    fallback_config = gemini_service.build_system_config(enable_search=False)
                    fallback_stream = await client.aio.models.generate_content_stream(
                        model=settings.GEMINI_MODEL,
                        contents=contents,
                        config=fallback_config,
                    )
                    async for chunk in fallback_stream:
                        if await request.is_disconnected():
                            break
                        if chunk.text:
                            full_reply_text += chunk.text
                            yield gemini_service.format_sse("token", {"token": chunk.text})
                            await asyncio.sleep(0)
                else:
                    raise loop_err

            async with AsyncSessionLocal() as save_db:
                model_msg = await conversation_service.save_model_message(
                    db=save_db,
                    conversation_id=conversation_id,
                    content=full_reply_text,
                    sources=captured_sources if captured_sources else None
                )
                yield gemini_service.format_sse(
                    "done",
                    {
                        "conversation_id": conversation_id,
                        "message_id": model_msg.id,
                        "title": conv.title
                    }
                )

        except Exception as exc:
            logger.error("Error during regeneration streaming: %s", exc, exc_info=True)
            yield gemini_service.format_sse("error", {"error": str(exc)})
            if full_reply_text:
                try:
                    async with AsyncSessionLocal() as save_db:
                        await conversation_service.save_model_message(
                            db=save_db,
                            conversation_id=conversation_id,
                            content=full_reply_text,
                            sources=captured_sources if captured_sources else None
                        )
                except Exception as save_err:
                    logger.error("Failed saving partial reply: %s", save_err)

    return StreamingResponse(
        regenerate_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
    )
