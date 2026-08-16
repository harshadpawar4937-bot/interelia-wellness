"""Authentication endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload

from app.api.deps import STAFF_ROLES, get_current_user, user_permissions
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.db.session import get_db
from app.models import Role, User
from app.schemas import LoginRequest, RegisterRequest, TokenResponse, UserOut
from app.services.crm_sync import upsert_crm_from_user
from app.services.rate_limit import check_rate_limit, client_key

router = APIRouter()

LOGIN_LIMIT = 20
LOGIN_WINDOW = 60
REGISTER_LIMIT = 10
REGISTER_WINDOW = 3600


class RefreshRequest(BaseModel):
    refresh_token: str


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


@router.post("/register", response_model=UserOut)
def register(body: RegisterRequest, request: Request, db: Session = Depends(get_db)):
    allowed, _ = check_rate_limit(client_key("register", _client_ip(request)), REGISTER_LIMIT, REGISTER_WINDOW)
    if not allowed:
        raise HTTPException(status_code=429, detail="Too many registration attempts — try again later")
    email = body.email.lower().strip()
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(
            status_code=400,
            detail="Email already registered — please sign in instead",
        )
    role = db.query(Role).filter_by(name="customer").first()
    if not role:
        raise HTTPException(status_code=500, detail="Roles not seeded")
    user = User(
        email=email,
        full_name=body.full_name.strip(),
        phone=(body.phone or "").strip() or None,
        hashed_password=hash_password(body.password),
        role_id=role.id,
    )
    db.add(user)
    db.flush()
    # Mirror into Admin → Customers so website signups are visible in CRM
    upsert_crm_from_user(db, user)
    db.commit()
    db.refresh(user)
    return UserOut(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        phone=user.phone,
        rewards_points=user.rewards_points,
        role="customer",
        is_active=user.is_active,
    )


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, request: Request, db: Session = Depends(get_db)):
    ip = _client_ip(request)
    allowed, _ = check_rate_limit(client_key("login", ip), LOGIN_LIMIT, LOGIN_WINDOW)
    if not allowed:
        raise HTTPException(status_code=429, detail="Too many login attempts — try again later")
    # Also limit per-email to slow credential stuffing
    allowed_email, _ = check_rate_limit(
        client_key("login-email", body.email.lower().strip()), LOGIN_LIMIT, LOGIN_WINDOW
    )
    if not allowed_email:
        raise HTTPException(status_code=429, detail="Too many login attempts — try again later")

    user = (
        db.query(User)
        .options(joinedload(User.role))
        .filter(User.email == body.email.lower().strip())
        .first()
    )
    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account disabled")
    role = user.role.name if user.role else "customer"
    token = create_access_token(
        str(user.id),
        {"email": user.email, "role": role, "perms": user_permissions(db, user)},
    )
    return TokenResponse(
        access_token=token,
        refresh_token=create_refresh_token(str(user.id)),
        role=role,
        full_name=user.full_name,
    )


@router.post("/refresh", response_model=TokenResponse)
def refresh(body: RefreshRequest, db: Session = Depends(get_db)):
    try:
        payload = decode_token(body.refresh_token)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=401, detail="Invalid refresh token") from exc
    if payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid token type")
    user = (
        db.query(User)
        .options(joinedload(User.role))
        .filter(User.id == int(payload["sub"]))
        .first()
    )
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User inactive or missing")
    role = user.role.name if user.role else "customer"
    return TokenResponse(
        access_token=create_access_token(
            str(user.id),
            {"email": user.email, "role": role, "perms": user_permissions(db, user)},
        ),
        refresh_token=create_refresh_token(str(user.id)),
        role=role,
        full_name=user.full_name,
    )


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return UserOut(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        phone=user.phone,
        rewards_points=user.rewards_points,
        role=user.role.name if user.role else "customer",
        is_active=user.is_active,
    )


@router.get("/staff-check")
def staff_check(user: User = Depends(get_current_user)):
    role = user.role.name if user.role else ""
    return {"is_staff": role in STAFF_ROLES, "role": role}
