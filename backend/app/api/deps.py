import os
import uuid
import aiofiles
from typing import Optional, Tuple
from fastapi import UploadFile, HTTPException, status
from app.core.config import settings


async def process_and_save_image(file: Optional[UploadFile]) -> Optional[Tuple[str, bytes, str]]:
    """
    Validates uploaded image file:
    - Content-Type must be image/png, image/jpeg, or image/webp.
    - Size must be <= MAX_FILE_SIZE_MB (5 MB).
    Saves file to upload directory and returns (saved_path, file_bytes, mime_type).
    """
    if file is None or not file.filename:
        return None

    # Validate MIME type
    content_type = file.content_type or ""
    if content_type.lower() not in settings.ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid image type '{content_type}'. Allowed types: PNG, JPEG, WEBP."
        )

    # Read and validate size
    content = await file.read()
    max_bytes = settings.MAX_FILE_SIZE_MB * 1024 * 1024
    if len(content) > max_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Image size exceeds the maximum allowed limit of {settings.MAX_FILE_SIZE_MB}MB."
        )

    # Ensure upload directory exists
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)

    # Generate unique filename
    extension = os.path.splitext(file.filename)[1].lower()
    if not extension:
        if "png" in content_type:
            extension = ".png"
        elif "webp" in content_type:
            extension = ".webp"
        else:
            extension = ".jpg"

    safe_filename = f"{uuid.uuid4().hex}{extension}"
    file_path = os.path.join(settings.UPLOAD_DIR, safe_filename)

    async with aiofiles.open(file_path, "wb") as f:
        await f.write(content)

    return file_path, content, content_type
