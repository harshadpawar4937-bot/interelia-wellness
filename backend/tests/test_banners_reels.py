"""Banners, public media, and Instagram reels CMS tests."""

from __future__ import annotations

import io
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

os.environ.setdefault("DATABASE_URL", f"sqlite:///{ROOT / 'test_banners_reels.db'}")
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-banners-reels-32b+")
os.environ.setdefault("ENVIRONMENT", "development")
os.environ.setdefault("UPLOAD_DIR", str(ROOT / "test_uploads_banners"))

from app.db.session import SessionLocal, init_db  # noqa: E402
from app.main import app  # noqa: E402
from app.models import SocialReel  # noqa: E402
from app.services.instagram_sync import ensure_instagram_accounts, sync_instagram_reels  # noqa: E402
from scripts.seed_interelia import seed  # noqa: E402

TINY_PNG = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
    b"\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc\xf8\x0f\x00"
    b"\x00\x01\x01\x00\x05\x18\xd8N\x00\x00\x00\x00IEND\xaeB`\x82"
)


@pytest.fixture(scope="module", autouse=True)
def _seed_db():
    init_db()
    seed()
    yield


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture
def admin_token(client: TestClient):
    res = client.post(
        "/api/v1/auth/login",
        json={"email": "admin@interelia.com", "password": "Admin@123"},
    )
    assert res.status_code == 200, res.text
    return res.json()["access_token"]


def test_banner_upload_schedule_and_public(client: TestClient, admin_token: str):
    headers = {"Authorization": f"Bearer {admin_token}"}
    upload = client.post(
        "/api/v1/admin/content/banners/upload",
        headers=headers,
        files={"file": ("banner.png", io.BytesIO(TINY_PNG), "image/png")},
    )
    assert upload.status_code == 200, upload.text
    url = upload.json()["url"]
    assert url.startswith("/api/v1/media/public/banners/")

    create = client.post(
        "/api/v1/admin/content/banners",
        headers=headers,
        json={
            "title": "Monsoon Care",
            "image_url": url,
            "link_url": "/shop",
            "cta_label": "Shop Now",
            "placement": "home_promo",
            "sort_order": 1,
            "is_active": True,
        },
    )
    assert create.status_code == 200, create.text

    public = client.get("/api/v1/content/banners?placement=home_promo")
    assert public.status_code == 200
    assert any(b["title"] == "Monsoon Care" for b in public.json())

    media = client.get(url)
    assert media.status_code == 200
    assert "image" in media.headers.get("content-type", "")

    past = (datetime.now(timezone.utc) - timedelta(days=2)).isoformat()
    earlier = (datetime.now(timezone.utc) - timedelta(days=5)).isoformat()
    expired = client.post(
        "/api/v1/admin/content/banners",
        headers=headers,
        json={
            "title": "Expired Promo",
            "image_url": url,
            "link_url": "/shop",
            "placement": "home_promo",
            "is_active": True,
            "starts_at": earlier,
            "ends_at": past,
        },
    )
    assert expired.status_code == 200, expired.text
    titles = [b["title"] for b in client.get("/api/v1/content/banners").json()]
    assert "Expired Promo" not in titles
    assert "Monsoon Care" in titles


def test_reel_publish_filter(client: TestClient, admin_token: str):
    headers = {"Authorization": f"Bearer {admin_token}"}
    draft = client.post(
        "/api/v1/admin/content/reels",
        headers=headers,
        json={
            "instagram_handle": "interelia.pharmacy",
            "permalink": "https://www.instagram.com/reel/TESTDRAFT/",
            "display_mode": "instagram_embed",
            "is_published": False,
        },
    )
    assert draft.status_code == 200, draft.text

    live = client.post(
        "/api/v1/admin/content/reels",
        headers=headers,
        json={
            "instagram_handle": "interelialifescience",
            "permalink": "https://www.instagram.com/reel/TESTLIVE/",
            "display_mode": "instagram_embed",
            "thumbnail_url": "/api/v1/media/public/reels/demo.jpg",
            "is_published": True,
            "sort_order": 1,
        },
    )
    assert live.status_code == 200, live.text

    public = client.get("/api/v1/content/reels")
    assert public.status_code == 200
    perms = [r.get("permalink") or "" for r in public.json()]
    assert any("TESTLIVE" in p for p in perms)
    assert not any("TESTDRAFT" in p for p in perms)

    upload = client.post(
        "/api/v1/admin/content/reels/upload",
        headers=headers,
        files={"file": ("thumb.png", io.BytesIO(TINY_PNG), "image/png")},
    )
    assert upload.status_code == 200
    assert upload.json()["url"].startswith("/api/v1/media/public/reels/")


def test_instagram_sync_without_token(client: TestClient, admin_token: str):
    headers = {"Authorization": f"Bearer {admin_token}"}
    with patch("app.core.config.settings.instagram_access_token", ""):
        with patch("app.services.instagram_sync.settings") as mock_settings:
            mock_settings.instagram_access_token = ""
            mock_settings.instagram_accounts = (
                "interelia.pharmacy:,interelialifescience:,tata1mgwellness:"
            )
            res = client.post("/api/v1/admin/content/instagram/sync", headers=headers)
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["created"] == 0
    assert body["errors"]
    assert "INSTAGRAM_ACCESS_TOKEN" in body["errors"][0]


def test_instagram_sync_dedupe():
    db = SessionLocal()
    try:
        db.query(SocialReel).filter(SocialReel.external_media_id == "ig_media_1").delete()
        db.commit()

        def fake_graph(path: str, token: str, params=None):
            return {
                "data": [
                    {
                        "id": "ig_media_1",
                        "caption": "Hello Interelia",
                        "media_type": "VIDEO",
                        "media_product_type": "REELS",
                        "permalink": "https://www.instagram.com/reel/ABC/",
                        "thumbnail_url": None,
                    }
                ]
            }

        with (
            patch("app.services.instagram_sync.settings") as mock_settings,
            patch("app.services.instagram_sync._graph_get", side_effect=fake_graph),
            patch("app.services.instagram_sync._download_thumbnail", return_value=None),
        ):
            mock_settings.instagram_access_token = "test-token"
            mock_settings.instagram_accounts = "interelia.pharmacy:999001"

            ensure_instagram_accounts(db)
            for a in ensure_instagram_accounts(db):
                if a.handle == "interelia.pharmacy":
                    a.ig_user_id = "999001"
                    a.is_enabled = True
            db.commit()

            first = sync_instagram_reels(db)
            second = sync_instagram_reels(db)

        assert first["created"] >= 1
        assert second["created"] == 0
        assert second["updated"] >= 1
        rows = db.query(SocialReel).filter_by(external_media_id="ig_media_1").all()
        assert len(rows) == 1
        assert rows[0].is_published is False
        assert rows[0].source == "instagram_sync"
    finally:
        db.close()


def test_public_media_rejects_non_public_paths(client: TestClient):
    res = client.get("/api/v1/media/rx/1/secret.pdf")
    assert res.status_code == 404
