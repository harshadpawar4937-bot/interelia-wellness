"""Local file storage for prescriptions and public marketing media."""

from __future__ import annotations

import re
import secrets
import uuid
from pathlib import Path

from fastapi import HTTPException, UploadFile

from app.core.config import settings

ALLOWED_MIME = {
    "image/jpeg",
    "image/png",
    "image/webp",
    "application/pdf",
}
ALLOWED_EXT = {".jpg", ".jpeg", ".png", ".webp", ".pdf"}

PUBLIC_KINDS = frozenset({"banners", "reels", "brands", "products"})
PUBLIC_IMAGE_MIME = {"image/jpeg", "image/png", "image/webp", "image/gif"}
PUBLIC_IMAGE_EXT = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
PUBLIC_VIDEO_MIME = {"video/mp4", "video/webm"}
PUBLIC_VIDEO_EXT = {".mp4", ".webm"}


def _safe_name(name: str) -> str:
    base = Path(name or "upload.bin").name
    base = re.sub(r"[^A-Za-z0-9._-]", "_", base)[:120]
    return base or "upload.bin"


async def save_prescription_file(user_id: int, file: UploadFile) -> tuple[str, str]:
    """
    Persist upload under upload_dir/rx/{user_id}/...
    Returns (relative_url_path, stored_filename).
    """
    content_type = (file.content_type or "").split(";")[0].strip().lower()
    orig = _safe_name(file.filename or "rx.pdf")
    ext = Path(orig).suffix.lower()
    if ext not in ALLOWED_EXT and content_type not in ALLOWED_MIME:
        raise HTTPException(400, "Only JPG, PNG, WEBP, or PDF prescriptions are allowed")
    if content_type and content_type not in ALLOWED_MIME and ext not in ALLOWED_EXT:
        raise HTTPException(400, "Invalid prescription file type")

    data = await file.read()
    if not data:
        raise HTTPException(400, "Empty file")
    if len(data) > settings.max_upload_bytes:
        raise HTTPException(400, f"File too large (max {settings.max_upload_bytes // (1024 * 1024)}MB)")

    dest_dir = Path(settings.upload_dir) / "rx" / str(user_id)
    dest_dir.mkdir(parents=True, exist_ok=True)
    stored = f"{uuid.uuid4().hex}_{secrets.token_hex(4)}{ext or '.bin'}"
    path = dest_dir / stored
    path.write_bytes(data)

    relative = f"/api/v1/uploads/rx/{user_id}/{stored}"
    return relative, orig


async def save_public_media(kind: str, file: UploadFile, *, allow_video: bool = False) -> str:
    """
    Persist marketing asset under upload_dir/public/{kind}/...
    Returns public URL path /api/v1/media/public/{kind}/{filename}.
    """
    if kind not in PUBLIC_KINDS:
        raise HTTPException(400, f"Invalid media kind — use {', '.join(sorted(PUBLIC_KINDS))}")

    content_type = (file.content_type or "").split(";")[0].strip().lower()
    orig = _safe_name(file.filename or "asset.bin")
    ext = Path(orig).suffix.lower()

    allowed_mime = set(PUBLIC_IMAGE_MIME)
    allowed_ext = set(PUBLIC_IMAGE_EXT)
    if allow_video:
        allowed_mime |= PUBLIC_VIDEO_MIME
        allowed_ext |= PUBLIC_VIDEO_EXT

    if ext not in allowed_ext and content_type not in allowed_mime:
        hint = "JPG, PNG, WEBP, GIF" + (", MP4, WEBM" if allow_video else "")
        raise HTTPException(400, f"Only {hint} files are allowed")
    if content_type and content_type not in allowed_mime and ext not in allowed_ext:
        raise HTTPException(400, "Invalid media file type")

    data = await file.read()
    if not data:
        raise HTTPException(400, "Empty file")
    limit = settings.max_media_upload_bytes
    if len(data) > limit:
        raise HTTPException(400, f"File too large (max {limit // (1024 * 1024)}MB)")

    if not ext:
        if content_type in PUBLIC_VIDEO_MIME:
            ext = ".mp4" if "mp4" in content_type else ".webm"
        else:
            ext = ".jpg"

    dest_dir = Path(settings.upload_dir) / "public" / kind
    dest_dir.mkdir(parents=True, exist_ok=True)
    stored = f"{uuid.uuid4().hex}_{secrets.token_hex(4)}{ext}"
    path = dest_dir / stored
    path.write_bytes(data)

    return f"/api/v1/media/public/{kind}/{stored}"


def save_public_bytes(kind: str, data: bytes, filename: str) -> str:
    """Write raw bytes (e.g. downloaded Instagram thumbnail) into public media."""
    if kind not in PUBLIC_KINDS:
        raise ValueError(f"Invalid media kind: {kind}")
    if not data:
        raise ValueError("Empty data")
    orig = _safe_name(filename)
    ext = Path(orig).suffix.lower() or ".jpg"
    if ext not in PUBLIC_IMAGE_EXT | PUBLIC_VIDEO_EXT:
        ext = ".jpg"
    dest_dir = Path(settings.upload_dir) / "public" / kind
    dest_dir.mkdir(parents=True, exist_ok=True)
    stored = f"{uuid.uuid4().hex}_{secrets.token_hex(4)}{ext}"
    (dest_dir / stored).write_bytes(data)
    return f"/api/v1/media/public/{kind}/{stored}"
