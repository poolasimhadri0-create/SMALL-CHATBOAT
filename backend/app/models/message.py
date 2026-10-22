from datetime import datetime
from typing import Optional, Any, TYPE_CHECKING
from sqlalchemy import (
    BigInteger,
    Integer,
    String,
    Text,
    DateTime,
    Enum,
    JSON,
    ForeignKey,
    Index,
    func,
)
from sqlalchemy.dialects.mysql import CHAR, LONGTEXT
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base

if TYPE_CHECKING:
    from app.models.conversation import Conversation


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[int] = mapped_column(
        BigInteger().with_variant(Integer, "sqlite"),
        primary_key=True,
        autoincrement=True
    )
    conversation_id: Mapped[str] = mapped_column(
        String(36).with_variant(CHAR(36), "mysql"),
        ForeignKey("conversations.id", ondelete="CASCADE"),
        nullable=False
    )
    role: Mapped[str] = mapped_column(
        Enum("user", "model", name="message_role"),
        nullable=False
    )
    content: Mapped[str] = mapped_column(
        Text().with_variant(LONGTEXT, "mysql"),
        nullable=False
    )
    image_path: Mapped[Optional[str]] = mapped_column(
        String(500),
        nullable=True
    )
    sources: Mapped[Optional[Any]] = mapped_column(
        JSON,
        nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        server_default=func.now(),
        nullable=False
    )

    # Relationships
    conversation: Mapped["Conversation"] = relationship(
        "Conversation",
        back_populates="messages"
    )

    __table_args__ = (
        Index("idx_messages_conversation_created", "conversation_id", "created_at"),
    )
