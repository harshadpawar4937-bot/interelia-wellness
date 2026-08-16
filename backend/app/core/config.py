"""Application settings."""

from __future__ import annotations

import json
from typing import Annotated, List

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


def _normalize_database_url(url: str) -> str:
    """Railway/Heroku often provide postgres:// — SQLAlchemy needs postgresql://."""
    if url.startswith("postgres://"):
        return "postgresql://" + url[len("postgres://") :]
    return url


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "Interelia Wellness"
    environment: str = "development"
    secret_key: str = "change-me-in-production-interelia-pharmacy-secret"
    access_token_expire_minutes: int = 480  # 8 hours — admin sessions
    refresh_token_expire_days: int = 14
    # Default to local SQLite so the stack runs without Docker; override for Postgres.
    database_url: str = "sqlite:///./interelia_pharmacy.db"
    redis_url: str = "redis://localhost:6379/0"
    # NoDecode: allow comma-separated CORS_ORIGINS in .env (pydantic-settings otherwise JSON-parses lists)
    cors_origins: Annotated[List[str], NoDecode] = Field(
        default_factory=lambda: [
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "http://localhost:5174",
            "http://127.0.0.1:5174",
            "http://localhost:5175",
            "http://127.0.0.1:5175",
            "http://localhost:5176",
            "http://127.0.0.1:5176",
            "http://localhost",
            "http://127.0.0.1",
        ]
    )
    openai_api_key: str = ""
    openai_base_url: str = "https://api.groq.com/openai/v1"
    openai_chat_model: str = "llama-3.1-8b-instant"
    fine_tuned_model_id: str = ""
    embedding_dims: int = 64
    upload_dir: str = "./uploads"
    max_upload_bytes: int = 10 * 1024 * 1024
    max_media_upload_bytes: int = 40 * 1024 * 1024  # banners + reel videos
    ai_rate_limit_per_minute: int = 20
    enable_api_docs: bool = True
    # When true, seed admin + catalog on empty DB (safe for first Railway boot)
    auto_seed_on_empty: bool = False

    # Instagram Graph API (optional — sync creates draft SocialReel rows)
    instagram_access_token: str = ""
    # Comma-separated handle:ig_user_id pairs, e.g. interelia.pharmacy:1784...,interelialifescience:1784...
    instagram_accounts: str = (
        "interelia.pharmacy:,interelialifescience:,tata1mgwellness:"
    )

    # Express delivery hub — Interelia Wellness, Gota, Ahmedabad
    store_lat: float = 23.1016
    store_lng: float = 72.5402
    store_address: str = "Interelia Wellness, Gota, Ahmedabad 382481"
    delivery_radius_km: float = 6.0
    delivery_eta_minutes: int = 30
    delivery_fee: float = 49.0
    free_delivery_min: float = 499.0

    @field_validator("database_url", mode="before")
    @classmethod
    def normalize_db_url(cls, v):  # noqa: ANN001
        if not v:
            return v
        return _normalize_database_url(str(v))

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors(cls, v):  # noqa: ANN001
        if v is None or v == "":
            return [
                "http://localhost:5173",
                "http://127.0.0.1:5173",
                "http://localhost:5174",
                "http://127.0.0.1:5174",
            ]
        if isinstance(v, list):
            return v
        if isinstance(v, str):
            s = v.strip()
            if s.startswith("["):
                return json.loads(s)
            return [p.strip() for p in s.split(",") if p.strip()]
        return v

    def validate_for_boot(self) -> None:
        """Fail fast in production when secrets are unsafe."""
        if self.environment == "production":
            weak = self.secret_key.startswith("change-me") or len(self.secret_key) < 32
            if weak:
                raise RuntimeError(
                    "SECRET_KEY must be a strong random value (>=32 chars) when ENVIRONMENT=production"
                )
            if self.database_url.startswith("sqlite"):
                raise RuntimeError("SQLite is not allowed when ENVIRONMENT=production — use Postgres")


settings = Settings()
settings.validate_for_boot()
