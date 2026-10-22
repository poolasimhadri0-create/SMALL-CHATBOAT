import logging
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.rate_limiter import limiter
from app.schemas.conversation import (
    ConversationUpdate,
    ConversationDetailResponse,
    ConversationResponse,
)
from app.services.conversation_service import conversation_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/conversations", tags=["Conversations"])


@router.get("", response_model=List[Dict[str, Any]])
async def list_conversations(
    q: Optional[str] = Query(None, description="Search term for conversation titles"),
    db: AsyncSession = Depends(get_db),
):
    """
    List all conversations ordered by newest first.
    Supports search filtering via `?q=`.
    """
    return await conversation_service.list_conversations(db, search_query=q)


@router.get("/{conversation_id}", response_model=ConversationDetailResponse)
async def get_conversation(
    conversation_id: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Get full details of a specific conversation, including all its messages.
    """
    conv = await conversation_service.get_conversation_with_messages(db, conversation_id)
    if not conv:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Conversation '{conversation_id}' not found."
        )
    return conv


@router.patch("/{conversation_id}", response_model=ConversationResponse)
async def rename_conversation(
    conversation_id: str,
    payload: ConversationUpdate,
    db: AsyncSession = Depends(get_db),
):
    """
    Rename an existing conversation title.
    """
    new_title = payload.title.strip()
    if not new_title:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Title cannot be empty."
        )

    updated_conv = await conversation_service.update_title(db, conversation_id, new_title)
    if not updated_conv:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Conversation '{conversation_id}' not found."
        )
    return updated_conv


@router.delete("/{conversation_id}", status_code=status.HTTP_200_OK)
async def delete_conversation(
    conversation_id: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Delete a conversation and all its associated messages.
    """
    success = await conversation_service.delete_conversation(db, conversation_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Conversation '{conversation_id}' not found."
        )
    return {"message": f"Conversation '{conversation_id}' deleted successfully."}
