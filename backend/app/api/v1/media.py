"""Public marketing media — banners & reels only (not prescriptions)."""

from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from app.core.config import settings

router = APIRouter()

MIME_BY_EXT = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".mp4": "video/mp4",
    ".webm": "video/webm",
}


@router.get("/{file_path:path}")
def serve_public_media(file_path: str):
    """
    Unauthenticated serve for marketing assets under uploads/public/ only.
    Expected paths: public/banners/... or public/reels/...
    """
    # Normalize leading "public/" — clients use /api/v1/media/public/...
    parts = Path(file_path).parts
    if not parts or parts[0] != "public":
        raise HTTPException(404, "File not found")
    if len(parts) < 3 or parts[1] not in ("banners", "reels"):
        raise HTTPException(404, "File not found")

    root = Path(settings.upload_dir).resolve()
    target = (root / file_path).resolve()
    if not str(target).startswith(str(root / "public")) or not target.is_file():
        raise HTTPException(404, "File not found")

    media = MIME_BY_EXT.get(target.suffix.lower(), "application/octet-stream")
    return FileResponse(target, media_type=media)
