from datetime import datetime
from typing import Optional, Any, List
from pydantic import BaseModel, ConfigDict, Field


class SourceItem(BaseModel):
    title: Optional[str] = None
    uri: Optional[str] = None


class MessageResponse(BaseModel):
    id: int
    conversation_id: str
    role: str
    content: str
    image_path: Optional[str] = None
    sources: Optional[Any] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ChatRequestValidation(BaseModel):
    conversation_id: Optional[str] = None
    message: str = Field(..., min_length=1, max_length=8000)


class RegenerateRequest(BaseModel):
    pass
