"""Auth dependencies and RBAC helpers."""

from __future__ import annotations

from typing import List, Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session, joinedload

from app.core.security import decode_token
from app.db.session import get_db
from app.models import Permission, RolePermission, User

bearer = HTTPBearer(auto_error=False)

STAFF_ROLES = {"super_admin", "pharmacist", "content_manager", "support_agent"}


def get_current_user(
    creds: Optional[HTTPAuthorizationCredentials] = Depends(bearer),
    db: Session = Depends(get_db),
) -> User:
    if not creds:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    try:
        payload = decode_token(creds.credentials)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=401, detail="Invalid token") from exc
    if payload.get("type") != "access":
        raise HTTPException(status_code=401, detail="Invalid token type")
    user = (
        db.query(User)
        .options(joinedload(User.role))
        .filter(User.id == int(payload["sub"]))
        .first()
    )
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User inactive or missing")
    return user


def get_optional_user(
    creds: Optional[HTTPAuthorizationCredentials] = Depends(bearer),
    db: Session = Depends(get_db),
) -> Optional[User]:
    if not creds:
        return None
    try:
        return get_current_user(creds, db)
    except HTTPException:
        return None


def require_staff(user: User = Depends(get_current_user)) -> User:
    role = user.role.name if user.role else ""
    if role not in STAFF_ROLES:
        raise HTTPException(status_code=403, detail="Staff access required")
    return user


def user_permissions(db: Session, user: User) -> List[str]:
    if not user.role:
        return []
    if user.role.name == "super_admin":
        return [p.code for p in db.query(Permission).all()]
    rows = (
        db.query(Permission.code)
        .join(RolePermission, RolePermission.permission_id == Permission.id)
        .filter(RolePermission.role_id == user.role_id)
        .all()
    )
    return [r[0] for r in rows]


def require_permission(code: str):
    def _dep(user: User = Depends(require_staff), db: Session = Depends(get_db)) -> User:
        perms = user_permissions(db, user)
        if code not in perms and user.role.name != "super_admin":
            raise HTTPException(status_code=403, detail=f"Missing permission: {code}")
        return user

    return _dep
