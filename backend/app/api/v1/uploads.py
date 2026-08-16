"""Serve uploaded files with auth — prescriptions are private."""

from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.api.deps import STAFF_ROLES, get_current_user
from app.core.config import settings
from app.db.session import get_db
from app.models import User

router = APIRouter()


@router.get("/{file_path:path}")
def serve_upload(
    file_path: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Authenticated file download.
    Paths under rx/{user_id}/ are only visible to that user or staff.
    """
    del db  # reserved for future ACL lookups
    # Prevent path traversal
    root = Path(settings.upload_dir).resolve()
    target = (root / file_path).resolve()
    if not str(target).startswith(str(root)) or not target.is_file():
        raise HTTPException(404, "File not found")

    parts = Path(file_path).parts
    role = user.role.name if user.role else ""
    is_staff = role in STAFF_ROLES

    if len(parts) >= 2 and parts[0] == "rx":
        try:
            owner_id = int(parts[1])
        except ValueError as exc:
            raise HTTPException(404, "File not found") from exc
        if user.id != owner_id and not is_staff:
            raise HTTPException(403, "Not allowed to access this file")
    elif not is_staff:
        raise HTTPException(403, "Not allowed to access this file")

    return FileResponse(target)
