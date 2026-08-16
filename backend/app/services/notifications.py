"""In-app user notification helpers."""

from __future__ import annotations

from typing import Optional

from sqlalchemy.orm import Session

from app.models import UserNotification


def notify_user(
    db: Session,
    *,
    user_id: int,
    title: str,
    body: str,
    notification_type: str = "general",
    link_url: Optional[str] = None,
    commit: bool = False,
) -> UserNotification:
    row = UserNotification(
        user_id=user_id,
        title=title,
        body=body,
        notification_type=notification_type,
        link_url=link_url,
    )
    db.add(row)
    if commit:
        db.commit()
        db.refresh(row)
    else:
        db.flush()
    return row
