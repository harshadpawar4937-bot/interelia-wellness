"""Delivery radius + CRM smoke tests."""

from __future__ import annotations

import os
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

os.environ.setdefault("DATABASE_URL", f"sqlite:///{ROOT / 'test_delivery_crm.db'}")
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-delivery-crm-32b+")
os.environ.setdefault("ENVIRONMENT", "development")

from app.db.session import SessionLocal, init_db  # noqa: E402
from app.main import app  # noqa: E402
from app.models import CrmCustomer  # noqa: E402
from app.services.delivery import check_serviceability, haversine_km  # noqa: E402
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


@pytest.fixture
def admin_token(client: TestClient):
    res = client.post(
        "/api/v1/auth/login",
        json={"email": "admin@interelia.com", "password": "Admin@123"},
    )
    assert res.status_code == 200
    return res.json()["access_token"]


def test_haversine_zero():
    assert haversine_km(23.1, 72.54, 23.1, 72.54) == pytest.approx(0.0, abs=1e-6)


def test_gota_pin_eligible():
    r = check_serviceability(
        {"line1": "Near Gota Circle", "city": "Ahmedabad", "state": "Gujarat", "pincode": "382481"}
    )
    assert r.eligible is True
    assert r.distance_km is not None
    assert r.distance_km <= 6.0
    assert r.eta_minutes == 30


def test_far_pin_ineligible():
    # Delhi PIN — far from Gota
    r = check_serviceability(
        {"line1": "Connaught Place", "city": "New Delhi", "state": "Delhi", "pincode": "110001"}
    )
    # May geocode via nominatim or fail locate; either way should not be eligible within 6km of Gota
    if r.distance_km is not None:
        assert r.eligible is False
        assert r.distance_km > 6.0
    else:
        assert r.eligible is False


def test_delivery_config(client: TestClient):
    res = client.get("/api/v1/delivery/config")
    assert res.status_code == 200
    body = res.json()
    assert body["radius_km"] == 6
    assert body["eta_minutes"] == 30


def test_delivery_check_endpoint(client: TestClient):
    res = client.post(
        "/api/v1/delivery/check",
        json={
            "shipping_address": {
                "line1": "Gota",
                "city": "Ahmedabad",
                "state": "Gujarat",
                "pincode": "382481",
            }
        },
    )
    assert res.status_code == 200
    assert res.json()["eligible"] is True


def test_crm_create_list_opt_in(client: TestClient, admin_token: str):
    headers = {"Authorization": f"Bearer {admin_token}"}
    create = client.post(
        "/api/v1/admin/customers",
        headers=headers,
        json={
            "full_name": "CRM Test Patient",
            "phone": "9999900001",
            "city": "Ahmedabad",
            "marketing_opt_in": False,
        },
    )
    assert create.status_code == 200
    cid = create.json()["id"]
    assert create.json()["marketing_opt_in"] is False

    listed = client.get("/api/v1/admin/customers?q=CRM Test Patient", headers=headers)
    assert listed.status_code == 200
    assert any(i["id"] == cid for i in listed.json()["items"])

    opt = client.patch(f"/api/v1/admin/customers/{cid}/opt-in?opt_in=true", headers=headers)
    assert opt.status_code == 200
    assert opt.json()["marketing_opt_in"] is True

    deact = client.delete(f"/api/v1/admin/customers/{cid}", headers=headers)
    assert deact.status_code == 200
    react = client.post(f"/api/v1/admin/customers/{cid}/reactivate", headers=headers)
    assert react.status_code == 200
    assert react.json()["is_active"] is True


def test_storefront_register_appears_in_crm(client: TestClient, admin_token: str):
    import uuid

    email = f"storefront.crm.sync.{uuid.uuid4().hex[:8]}@example.com"
    reg = client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "password": "TestPass123!",
            "full_name": "Storefront CRM User",
            "phone": "9111122233",
        },
    )
    assert reg.status_code in (200, 201)
    headers = {"Authorization": f"Bearer {admin_token}"}
    listed = client.get(f"/api/v1/admin/customers?q={email}", headers=headers)
    assert listed.status_code == 200
    items = listed.json()["items"]
    assert any((i.get("email") or "").lower() == email for i in items)
    match = next(i for i in items if (i.get("email") or "").lower() == email)
    assert match["source"] == "storefront"
    assert match["full_name"] == "Storefront CRM User"

    dup = client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "password": "TestPass123!",
            "full_name": "Storefront CRM User",
        },
    )
    assert dup.status_code == 400
    assert "sign in" in dup.json()["detail"].lower()


def test_crm_notification_queued(client: TestClient, admin_token: str):
    headers = {"Authorization": f"Bearer {admin_token}"}
    db = SessionLocal()
    try:
        if not db.query(CrmCustomer).filter(CrmCustomer.marketing_opt_in.is_(True), CrmCustomer.is_active.is_(True)).first():
            db.add(
                CrmCustomer(
                    full_name="Opted In Test",
                    phone="9888877777",
                    marketing_opt_in=True,
                    is_active=True,
                    source="manual",
                )
            )
            db.commit()
    finally:
        db.close()

    res = client.post(
        "/api/v1/admin/notifications",
        headers=headers,
        json={
            "title": "Test offer",
            "body": "10% off wellness",
            "notification_type": "offer",
            "audience": "opted_in",
        },
    )
    assert res.status_code == 200
    assert res.json()["status"] == "queued"
    assert res.json()["recipient_count"] >= 1
