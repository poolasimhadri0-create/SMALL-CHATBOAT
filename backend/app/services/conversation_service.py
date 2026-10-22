import uuid
import logging
from typing import Optional, List, Dict, Any
from sqlalchemy import select, func, desc, delete
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.conversation import Conversation
from app.models.message import Message

logger = logging.getLogger(__name__)


class ConversationService:
    """Handles conversation and message persistence operations in MySQL."""

    @staticmethod
    async def get_or_create_conversation(
        db: AsyncSession, conversation_id: Optional[str] = None, initial_title: Optional[str] = None
    ) -> tuple[Conversation, bool]:
        """
        Retrieves an existing conversation or creates a new one with an immediate title.
        Returns (conversation, is_new_created).
        """
        if conversation_id:
            stmt = select(Conversation).where(Conversation.id == conversation_id)
            result = await db.execute(stmt)
            conv = result.scalar_one_or_none()
            if conv:
                return conv, False

        # Create new conversation with generated UUID and title directly (0 latency)
        new_id = conversation_id if (conversation_id and len(conversation_id) == 36) else str(uuid.uuid4())
        title = initial_title if initial_title else "New Conversation"
        new_conv = Conversation(id=new_id, title=title)
        db.add(new_conv)
        await db.commit()
        await db.refresh(new_conv)
        return new_conv, True

    @staticmethod
    async def get_conversation_by_id(
        db: AsyncSession, conversation_id: str
    ) -> Optional[Conversation]:
        """Fetch conversation by ID."""
        stmt = select(Conversation).where(Conversation.id == conversation_id)
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    @staticmethod
    async def get_conversation_with_messages(
        db: AsyncSession, conversation_id: str
    ) -> Optional[Conversation]:
        """Fetch conversation with all associated messages ordered by created_at."""
        stmt = (
            select(Conversation)
            .options(selectinload(Conversation.messages))
            .where(Conversation.id == conversation_id)
        )
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    @staticmethod
    async def get_recent_history(
        db: AsyncSession, conversation_id: str, limit: int = 20
    ) -> List[Message]:
        """Fetch the most recent N messages using indexed query ordered chronologically."""
        stmt = (
            select(Message)
            .where(Message.conversation_id == conversation_id)
            .order_by(desc(Message.created_at))
            .limit(limit)
        )
        result = await db.execute(stmt)
        msgs = result.scalars().all()
        return list(reversed(msgs))

    @staticmethod
    async def save_user_message(
        db: AsyncSession,
        conversation_id: str,
        content: str,
        image_path: Optional[str] = None
    ) -> Message:
        """Persist user message to the database."""
        user_msg = Message(
            conversation_id=conversation_id,
            role="user",
            content=content,
            image_path=image_path,
            sources=None
        )
        db.add(user_msg)
        await db.commit()
        await db.refresh(user_msg)
        return user_msg

    @staticmethod
    async def save_model_message(
        db: AsyncSession,
        conversation_id: str,
        content: str,
        sources: Optional[List[Dict[str, str]]] = None
    ) -> Message:
        """Persist AI model message to the database."""
        model_msg = Message(
            conversation_id=conversation_id,
            role="model",
            content=content,
            image_path=None,
            sources=sources if sources else None
        )
        db.add(model_msg)
        await db.commit()
        await db.refresh(model_msg)
        return model_msg

    @staticmethod
    async def list_conversations(
        db: AsyncSession, search_query: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        List conversations ordered newest first, with optional search query on title.
        Includes total message count and preview of last message.
        """
        stmt = select(Conversation)
        if search_query and search_query.strip():
            stmt = stmt.where(Conversation.title.ilike(f"%{search_query.strip()}%"))
        stmt = stmt.order_by(desc(Conversation.updated_at))

        result = await db.execute(stmt)
        conversations = result.scalars().all()

        output = []
        for conv in conversations:
            # Get message count
            count_stmt = (
                select(func.count(Message.id))
                .where(Message.conversation_id == conv.id)
            )
            count_res = await db.execute(count_stmt)
            msg_count = count_res.scalar() or 0

            # Get last message content
            last_msg_stmt = (
                select(Message.content)
                .where(Message.conversation_id == conv.id)
                .order_by(desc(Message.created_at))
                .limit(1)
            )
            last_msg_res = await db.execute(last_msg_stmt)
            last_msg = last_msg_res.scalar_one_or_none()

            output.append({
                "id": conv.id,
                "title": conv.title,
                "created_at": conv.created_at,
                "updated_at": conv.updated_at,
                "message_count": msg_count,
                "last_message": (last_msg[:100] + "...") if last_msg and len(last_msg) > 100 else last_msg
            })
        return output

    @staticmethod
    async def update_title(
        db: AsyncSession, conversation_id: str, new_title: str
    ) -> Optional[Conversation]:
        """Update conversation title."""
        stmt = select(Conversation).where(Conversation.id == conversation_id)
        result = await db.execute(stmt)
        conv = result.scalar_one_or_none()
        if conv:
            conv.title = new_title
            await db.commit()
            await db.refresh(conv)
        return conv

    @staticmethod
    async def delete_conversation(
        db: AsyncSession, conversation_id: str
    ) -> bool:
        """Delete conversation and cascade delete all its messages."""
        stmt = select(Conversation).where(Conversation.id == conversation_id)
        result = await db.execute(stmt)
        conv = result.scalar_one_or_none()
        if conv:
            await db.delete(conv)
            await db.commit()
            return True
        return False

    @staticmethod
    async def get_last_user_message(
        db: AsyncSession, conversation_id: str
    ) -> Optional[Message]:
        """Get the most recent user message in the conversation."""
        stmt = (
            select(Message)
            .where(Message.conversation_id == conversation_id, Message.role == "user")
            .order_by(desc(Message.created_at))
            .limit(1)
        )
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    @staticmethod
    async def remove_last_model_message(
        db: AsyncSession, conversation_id: str
    ) -> Optional[int]:
        """
        Removes the latest model message for the regenerate endpoint.
        """
        stmt = (
            select(Message)
            .where(Message.conversation_id == conversation_id, Message.role == "model")
            .order_by(desc(Message.created_at))
            .limit(1)
        )
        result = await db.execute(stmt)
        last_model = result.scalar_one_or_none()
        if last_model:
            model_id = last_model.id
            await db.delete(last_model)
            await db.commit()
            return model_id
        return None


conversation_service = ConversationService()
