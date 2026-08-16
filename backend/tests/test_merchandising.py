"""Merchandising — product banners, rails, quick-view, enriched reels."""

from __future__ import annotations

import io
import os
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

os.environ.setdefault("DATABASE_URL", f"sqlite:///{ROOT / 'test_merch.db'}")
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-merch-ux-32bytes+")
os.environ.setdefault("ENVIRONMENT", "development")
os.environ.setdefault("UPLOAD_DIR", str(ROOT / "test_uploads_merch"))

from app.db.session import SessionLocal, init_db  # noqa: E402
from app.main import app  # noqa: E402
from app.models import AdBanner, Brand, Category, MerchRail, Product, SocialReel  # noqa: E402
from app.services.merchandising import ensure_default_rails  # noqa: E402
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
    db = SessionLocal()
    try:
        ensure_default_rails(db)
        cat = db.query(Category).first()
        brand = db.query(Brand).first()
        if not cat:
            cat = Category(name="Wellness", slug="wellness")
            db.add(cat)
            db.flush()
        if not brand:
            brand = Brand(name="Interelia", slug="interelia", is_active=True)
            db.add(brand)
            db.flush()
        if db.query(Product).count() == 0:
            for i in range(3):
                db.add(
                    Product(
                        name=f"Merch Product {i+1}",
                        slug=f"merch-product-{i+1}",
                        price=199 + i * 50,
                        mrp=299 + i * 50,
                        stock_qty=20,
                        category_id=cat.id,
                        brand_id=brand.id,
                        is_active=True,
                        review_count=10 - i,
                    )
                )
            db.commit()
    finally:
        db.close()
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
    assert res.status_code == 200
    return res.json()["access_token"]


@pytest.fixture
def product_id():
    db = SessionLocal()
    try:
        p = db.query(Product).filter(Product.is_active.is_(True)).first()
        assert p
        return p.id
    finally:
        db.close()


def test_product_linked_banner_payload(client: TestClient, admin_token: str, product_id: int):
    headers = {"Authorization": f"Bearer {admin_token}"}
    upload = client.post(
        "/api/v1/admin/content/banners/upload",
        headers=headers,
        files={"file": ("b.png", io.BytesIO(TINY_PNG), "image/png")},
    )
    assert upload.status_code == 200
    url = upload.json()["url"]

    create = client.post(
        "/api/v1/admin/content/banners",
        headers=headers,
        json={
            "title": "Linked Offer",
            "image_url": url,
            "placement": "home_offer",
            "banner_kind": "offer",
            "target_type": "product",
            "product_id": product_id,
            "badge_text": "50% OFF",
            "cta_label": "Shop Now",
            "is_active": True,
        },
    )
    assert create.status_code == 200, create.text
    body = create.json()
    assert body["product_id"] == product_id
    assert body["product"]["id"] == product_id
    assert body["badge_text"] == "50% OFF"

    public = client.get("/api/v1/content/banners?placement=home_offer")
    assert public.status_code == 200
    assert any(b["title"] == "Linked Offer" and b.get("product") for b in public.json())


def test_rails_auto_and_manual(client: TestClient, admin_token: str, product_id: int):
    headers = {"Authorization": f"Bearer {admin_token}"}
    latest = client.get("/api/v1/content/rails/latest")
    assert latest.status_code == 200
    assert latest.json()["key"] == "latest"
    assert len(latest.json()["items"]) >= 1

    pin = client.patch(
        "/api/v1/admin/content/rails/trending",
        headers=headers,
        json={"source_mode": "manual", "product_ids": [product_id], "title": "Bestsellers"},
    )
    assert pin.status_code == 200, pin.text
    assert pin.json()["source_mode"] == "manual"
    assert pin.json()["product_ids"] == [product_id]

    trending = client.get("/api/v1/content/rails/trending")
    assert trending.status_code == 200
    assert trending.json()["title"] == "Bestsellers"
    assert any(i["id"] == product_id for i in trending.json()["items"])


def test_reel_enriched_product_and_quick_view(client: TestClient, admin_token: str, product_id: int):
    headers = {"Authorization": f"Bearer {admin_token}"}
    reel = client.post(
        "/api/v1/admin/content/reels",
        headers=headers,
        json={
            "instagram_handle": "interelia.pharmacy",
            "permalink": "https://www.instagram.com/reel/MERCH1/",
            "display_mode": "instagram_embed",
            "product_id": product_id,
            "is_published": True,
        },
    )
    assert reel.status_code == 200, reel.text
    assert reel.json()["product"]["in_stock"] is True
    assert "image_url" in reel.json()["product"]

    listed = client.get("/api/v1/content/reels")
    assert any(r.get("product") and r["product"]["id"] == product_id for r in listed.json())

    qv = client.get(f"/api/v1/content/products/{product_id}/quick-view")
    assert qv.status_code == 200
    assert qv.json()["product"]["id"] == product_id
    assert isinstance(qv.json()["related"], list)


def test_disabled_rail_hidden(client: TestClient, admin_token: str):
    headers = {"Authorization": f"Bearer {admin_token}"}
    client.patch(
        "/api/v1/admin/content/rails/latest",
        headers=headers,
        json={"is_enabled": False},
    )
    assert client.get("/api/v1/content/rails/latest").status_code == 404
    client.patch(
        "/api/v1/admin/content/rails/latest",
        headers=headers,
        json={"is_enabled": True},
    )
    assert client.get("/api/v1/content/rails/latest").status_code == 200
