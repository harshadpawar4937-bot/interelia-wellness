"""Experts CMS + storefront public API + order restock."""

from __future__ import annotations

import os
import sys
import uuid
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

# Prefer a dedicated DB when this file loads first; do not override other suites.
os.environ.setdefault("DATABASE_URL", f"sqlite:///{ROOT / 'test_experts.db'}")
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-experts-tests-32b+")
os.environ.setdefault("ENVIRONMENT", "development")

from app.db.session import SessionLocal, init_db  # noqa: E402
from app.main import app  # noqa: E402
from app.models import Product  # noqa: E402
from scripts.seed_interelia import seed  # noqa: E402


@pytest.fixture(scope="module", autouse=True)
def _seed_db():
    init_db()
    seed()
    yield


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="module")
def admin_token(client: TestClient):
    res = client.post(
        "/api/v1/auth/login",
        json={"email": "admin@interelia.com", "password": "Admin@123"},
    )
    assert res.status_code == 200
    return res.json()["access_token"]


def test_public_experts_list(client: TestClient):
    res = client.get("/api/v1/content/experts")
    assert res.status_code == 200
    rows = res.json()
    assert isinstance(rows, list)
    assert len(rows) >= 1
    first = rows[0]
    assert first["phone"]
    assert first["address_line1"]
    assert first["maps_url"]
    assert "google.com/maps" in first["maps_url"]


def test_admin_expert_address_edit_rebuilds_maps(client: TestClient, admin_token: str):
    headers = {"Authorization": f"Bearer {admin_token}"}
    listed = client.get("/api/v1/admin/content/experts", headers=headers)
    assert listed.status_code == 200
    expert_id = listed.json()[0]["id"]

    patch = client.patch(
        f"/api/v1/admin/content/experts/{expert_id}",
        headers=headers,
        json={"address_line1": "99 QA Street", "city": "Ahmedabad", "maps_url": None},
    )
    assert patch.status_code == 200

    public = client.get("/api/v1/content/experts")
    assert public.status_code == 200
    match = next(e for e in public.json() if e["id"] == expert_id)
    assert "99" in match["maps_url"] and "QA" in match["maps_url"].replace("+", " ")


def test_cancel_order_restocks(client: TestClient, admin_token: str):
    headers_admin = {"Authorization": f"Bearer {admin_token}"}
    email = f"restock.qa.{uuid.uuid4().hex[:8]}@example.com"

    client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "Customer@123", "full_name": "Restock QA"},
    )
    login = client.post("/api/v1/auth/login", json={"email": email, "password": "Customer@123"})
    assert login.status_code == 200
    token = login.json()["access_token"]

    products = client.get("/api/v1/products?page_size=1").json()["items"]
    assert products
    pid = products[0]["id"]

    db = SessionLocal()
    try:
        p = db.get(Product, pid)
        assert p is not None
        p.stock_qty = max(int(p.stock_qty or 0), 5)
        db.commit()
        before = int(p.stock_qty)
    finally:
        db.close()

    order = client.post(
        "/api/v1/orders",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "items": [{"product_id": pid, "quantity": 1}],
            "payment_method": "cod",
            "shipping_address": {
                "name": "Restock QA",
                "phone": "9876543210",
                "line1": "Near Gota Circle",
                "city": "Ahmedabad",
                "state": "Gujarat",
                "pincode": "382481",
            },
        },
    )
    assert order.status_code == 200, order.text
    oid = order.json()["id"]

    db = SessionLocal()
    try:
        mid = int(db.get(Product, pid).stock_qty)
        assert mid == before - 1
    finally:
        db.close()

    cancel = client.patch(
        f"/api/v1/admin/orders/{oid}",
        headers=headers_admin,
        json={"status": "cancelled"},
    )
    assert cancel.status_code == 200, cancel.text

    db = SessionLocal()
    try:
        after = int(db.get(Product, pid).stock_qty)
        assert after == before
    finally:
        db.close()
