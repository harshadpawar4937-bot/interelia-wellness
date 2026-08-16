"""Customer medicine requirement requests + in-app notifications."""

from __future__ import annotations

import secrets
from datetime import datetime, timezone
from decimal import Decimal
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models import MedicineRequest, MedicineRequestItem, Order, User, UserNotification
from app.schemas import (
    AttachOrderRequest,
    ChooseFulfillmentRequest,
    MedicineRequestCreate,
    MedicineRequestItemOut,
    MedicineRequestOut,
    UnreadCountOut,
    UserNotificationOut,
)
from app.services.notifications import notify_user

router = APIRouter()


def _request_number() -> str:
    return f"MR-{datetime.utcnow().year}-{secrets.token_hex(3).upper()}"


def _item_out(item: MedicineRequestItem) -> MedicineRequestItemOut:
    product = item.matched_product
    return MedicineRequestItemOut(
        id=item.id,
        medicine_name=item.medicine_name,
        brand_or_company=item.brand_or_company,
        quantity=item.quantity,
        pack_or_strength=item.pack_or_strength,
        notes=item.notes,
        matched_product_id=item.matched_product_id,
        matched_product_name=product.name if product else None,
        matched_product_slug=product.slug if product else None,
        unit_price_snapshot=item.unit_price_snapshot,
        matched_product_image_url=product.image_url if product else None,
        matched_product_requires_rx=product.requires_prescription if product else None,
        matched_product_in_stock=(product.stock_qty > 0) if product else None,
        matched_product_price=product.price if product else None,
        matched_product_mrp=product.mrp if product else None,
    )


def _request_out(req: MedicineRequest, *, include_user: bool = False) -> MedicineRequestOut:
    order_number = None
    if req.order_id and req.order:
        order_number = req.order.order_number
    out = MedicineRequestOut(
        id=req.id,
        request_number=req.request_number,
        status=req.status,
        customer_notes=req.customer_notes,
        admin_notes=req.admin_notes,
        rejection_reason=req.rejection_reason,
        fulfillment_method=req.fulfillment_method,
        order_id=req.order_id,
        order_number=order_number,
        reviewed_at=req.reviewed_at,
        available_at=req.available_at,
        created_at=req.created_at,
        updated_at=req.updated_at,
        items=[_item_out(i) for i in (req.items or [])],
        item_count=len(req.items or []),
    )
    if include_user and req.user:
        out.user_id = req.user_id
        out.user_name = req.user.full_name
        out.user_email = req.user.email
        out.user_phone = req.user.phone
    return out


def _load_request(db: Session, request_id: int) -> Optional[MedicineRequest]:
    return (
        db.query(MedicineRequest)
        .options(
            joinedload(MedicineRequest.items).joinedload(MedicineRequestItem.matched_product),
            joinedload(MedicineRequest.order),
            joinedload(MedicineRequest.user),
        )
        .filter(MedicineRequest.id == request_id)
        .first()
    )


@router.post("", response_model=MedicineRequestOut)
def create_medicine_request(
    body: MedicineRequestCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not body.items:
        raise HTTPException(400, "Add at least one medicine to your requirement list")

    req = MedicineRequest(
        request_number=_request_number(),
        user_id=user.id,
        status="submitted",
        customer_notes=(body.customer_notes or "").strip() or None,
    )
    db.add(req)
    db.flush()

    for row in body.items:
        name = row.medicine_name.strip()
        if not name:
            raise HTTPException(400, "Medicine name is required on every line")
        db.add(
            MedicineRequestItem(
                request_id=req.id,
                medicine_name=name,
                brand_or_company=(row.brand_or_company or "").strip() or None,
                quantity=row.quantity,
                pack_or_strength=(row.pack_or_strength or "").strip() or None,
                notes=(row.notes or "").strip() or None,
            )
        )

    notify_user(
        db,
        user_id=user.id,
        title="Requirement list submitted",
        body=f"We received {req.request_number}. Our pharmacy team will review it shortly.",
        notification_type="medicine_request",
        link_url=f"/account/medicine-requests/{req.id}",
    )
    db.commit()
    loaded = _load_request(db, req.id)
    assert loaded
    return _request_out(loaded)


@router.get("/mine", response_model=List[MedicineRequestOut])
def list_my_medicine_requests(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(MedicineRequest)
        .options(
            joinedload(MedicineRequest.items).joinedload(MedicineRequestItem.matched_product),
            joinedload(MedicineRequest.order),
        )
        .filter(MedicineRequest.user_id == user.id)
        .order_by(MedicineRequest.id.desc())
        .all()
    )
    return [_request_out(r) for r in rows]


@router.get("/{request_id}", response_model=MedicineRequestOut)
def get_my_medicine_request(
    request_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    req = _load_request(db, request_id)
    if not req or req.user_id != user.id:
        raise HTTPException(404, "Request not found")
    return _request_out(req)


@router.post("/{request_id}/choose-fulfillment", response_model=MedicineRequestOut)
def choose_fulfillment(
    request_id: int,
    body: ChooseFulfillmentRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    method = (body.method or "").strip().lower()
    if method not in {"pickup", "delivery"}:
        raise HTTPException(400, "method must be pickup or delivery")

    req = _load_request(db, request_id)
    if not req or req.user_id != user.id:
        raise HTTPException(404, "Request not found")
    if req.status != "available":
        raise HTTPException(400, "This request is not ready for fulfillment yet")

    unmatched = [i for i in req.items if not i.matched_product_id]
    if unmatched:
        raise HTTPException(400, "Some items are not matched to store products yet")

    if method == "pickup":
        req.status = "awaiting_pickup"
        req.fulfillment_method = "pickup"
        notify_user(
            db,
            user_id=user.id,
            title="Ready for store pickup",
            body=(
                f"{req.request_number} is reserved for you. "
                "Visit Interelia Wellness (Gota, Ahmedabad) to collect your medicines."
            ),
            notification_type="medicine_request",
            link_url=f"/account/medicine-requests/{req.id}",
        )
        db.commit()
        loaded = _load_request(db, req.id)
        assert loaded
        return _request_out(loaded)

    # Delivery: keep status available until order is attached; return matched cart payload
    req.fulfillment_method = "delivery"
    db.commit()
    loaded = _load_request(db, req.id)
    assert loaded
    return _request_out(loaded)


@router.post("/{request_id}/attach-order", response_model=MedicineRequestOut)
def attach_order(
    request_id: int,
    body: AttachOrderRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    req = _load_request(db, request_id)
    if not req or req.user_id != user.id:
        raise HTTPException(404, "Request not found")
    if req.status not in {"available", "ordered"}:
        raise HTTPException(400, "Cannot attach an order in the current status")
    if req.fulfillment_method and req.fulfillment_method != "delivery":
        raise HTTPException(400, "This request is set for store pickup")

    order = db.query(Order).filter(Order.id == body.order_id, Order.user_id == user.id).first()
    if not order:
        raise HTTPException(404, "Order not found")

    req.order_id = order.id
    req.fulfillment_method = "delivery"
    req.status = "ordered"
    notify_user(
        db,
        user_id=user.id,
        title="Delivery order placed",
        body=f"{req.request_number} is linked to order {order.order_number}. Track it under Orders.",
        notification_type="medicine_request",
        link_url="/account/orders",
    )
    db.commit()
    loaded = _load_request(db, req.id)
    assert loaded
    return _request_out(loaded)


# --- Notifications router mounted separately ---

notifications_router = APIRouter()


@notifications_router.get("/mine", response_model=List[UserNotificationOut])
def list_my_notifications(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    limit: int = 50,
):
    rows = (
        db.query(UserNotification)
        .filter(UserNotification.user_id == user.id)
        .order_by(UserNotification.id.desc())
        .limit(min(limit, 100))
        .all()
    )
    return [
        UserNotificationOut(
            id=r.id,
            title=r.title,
            body=r.body,
            notification_type=r.notification_type,
            link_url=r.link_url,
            read_at=r.read_at,
            created_at=r.created_at,
        )
        for r in rows
    ]


@notifications_router.get("/unread-count", response_model=UnreadCountOut)
def unread_count(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    count = (
        db.query(UserNotification)
        .filter(UserNotification.user_id == user.id, UserNotification.read_at.is_(None))
        .count()
    )
    return UnreadCountOut(count=count)


@notifications_router.post("/{notification_id}/read", response_model=UserNotificationOut)
def mark_notification_read(
    notification_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    row = (
        db.query(UserNotification)
        .filter(UserNotification.id == notification_id, UserNotification.user_id == user.id)
        .first()
    )
    if not row:
        raise HTTPException(404, "Notification not found")
    if not row.read_at:
        row.read_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(row)
    return UserNotificationOut(
        id=row.id,
        title=row.title,
        body=row.body,
        notification_type=row.notification_type,
        link_url=row.link_url,
        read_at=row.read_at,
        created_at=row.created_at,
    )


@notifications_router.post("/read-all")
def mark_all_read(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    now = datetime.now(timezone.utc)
    (
        db.query(UserNotification)
        .filter(UserNotification.user_id == user.id, UserNotification.read_at.is_(None))
        .update({"read_at": now}, synchronize_session=False)
    )
    db.commit()
    return {"ok": True}
