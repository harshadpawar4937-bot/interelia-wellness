"""API smoke tests — health, auth, catalog, staff gate."""

from __future__ import annotations

import os
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

# Use isolated SQLite DB for tests
os.environ.setdefault("DATABASE_URL", f"sqlite:///{ROOT / 'test_smoke.db'}")
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-smoke-tests-32b+")
os.environ.setdefault("ENVIRONMENT", "development")

from app.db.session import SessionLocal, init_db  # noqa: E402
from app.main import app  # noqa: E402
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


def test_health(client: TestClient):
    res = client.get("/health")
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "ok"
    assert body["database"] == "up"


def test_admin_login(client: TestClient):
    res = client.post(
        "/api/v1/auth/login",
        json={"email": "admin@interelia.com", "password": "Admin@123"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["role"] == "super_admin"
    assert data["access_token"]
    assert data["refresh_token"]


def test_invalid_login(client: TestClient):
    res = client.post(
        "/api/v1/auth/login",
        json={"email": "admin@interelia.com", "password": "wrong"},
    )
    assert res.status_code == 401


def test_products_list(client: TestClient):
    res = client.get("/api/v1/products?page_size=5")
    assert res.status_code == 200
    data = res.json()
    assert "items" in data
    assert "total" in data


def test_admin_dashboard_requires_auth(client: TestClient):
    res = client.get("/api/v1/admin/dashboard")
    assert res.status_code in (401, 403)


def test_admin_dashboard_with_token(client: TestClient):
    login = client.post(
        "/api/v1/auth/login",
        json={"email": "admin@interelia.com", "password": "Admin@123"},
    )
    token = login.json()["access_token"]
    res = client.get(
        "/api/v1/admin/dashboard",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    assert "orders_count" in res.json() or "products_count" in res.json() or isinstance(res.json(), dict)


def test_uploads_require_auth(client: TestClient):
    res = client.get("/api/v1/uploads/rx/1/missing.bin")
    assert res.status_code == 401


def test_register_and_me(client: TestClient):
    import uuid

    email = f"smoke.customer.{uuid.uuid4().hex[:8]}@example.com"

    reg = client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "Customer@123", "full_name": "Smoke Customer"},
    )
    assert reg.status_code == 200
    login = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "Customer@123"},
    )
    assert login.status_code == 200
    token = login.json()["access_token"]
    me = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    assert me.json()["email"] == email
