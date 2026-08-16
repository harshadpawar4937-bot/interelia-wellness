"""Customer order placement with express delivery radius enforcement."""

from __future__ import annotations

import json
import secrets
from datetime import datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from app.api.deps import get_current_user
from app.core.config import settings
from app.db.session import get_db
from app.models import Order, OrderItem, Prescription, Product, User
from app.schemas import OrderOut
from app.services.delivery import check_serviceability, delivery_fee_for_subtotal, normalize_pincode

router = APIRouter()

PAYMENT_METHODS = {"cod", "upi", "card", "netbanking", "wallet"}


class OrderItemIn(BaseModel):
    product_id: int
    quantity: int = Field(ge=1, le=99)


class PlaceOrderRequest(BaseModel):
    items: List[OrderItemIn]
    shipping_address: dict
    payment_method: str = "cod"
    prescription_id: Optional[int] = None


def _order_number() -> str:
    return f"IP-{datetime.utcnow().year}-{secrets.token_hex(3).upper()}"


def _parse_address(raw: Dict[str, Any]) -> Dict[str, Any]:
    if not isinstance(raw, dict):
        raise HTTPException(400, "Shipping address required")
    name = str(raw.get("name") or "").strip()
    phone = str(raw.get("phone") or "").strip()
    line1 = str(raw.get("line1") or "").strip()
    city = str(raw.get("city") or "Ahmedabad").strip()
    state = str(raw.get("state") or "Gujarat").strip()
    pincode = normalize_pincode(raw.get("pincode"))
    if not name or not phone:
        raise HTTPException(400, "Name and phone are required on shipping address")
    if not line1:
        raise HTTPException(400, "Street address (line1) is required")
    if len(pincode) != 6:
        raise HTTPException(400, "Valid 6-digit pincode is required")
    return {
        "name": name,
        "phone": phone,
        "email": str(raw.get("email") or "").strip() or None,
        "line1": line1,
        "line2": str(raw.get("line2") or "").strip() or None,
        "city": city,
        "state": state,
        "pincode": pincode,
    }


def _to_out(order: Order, user: User) -> OrderOut:
    addr = None
    if order.shipping_address_json:
        try:
            addr = json.loads(order.shipping_address_json)
        except json.JSONDecodeError:
            addr = None
    return OrderOut(
        id=order.id,
        order_number=order.order_number,
        status=order.status,
        total=order.total,
        subtotal=order.subtotal,
        delivery_fee=order.delivery_fee,
        payment_status=order.payment_status,
        user_email=user.email,
        user_name=user.full_name,
        created_at=order.created_at,
        items=[
            {"product_id": i.product_id, "quantity": i.quantity, "unit_price": float(i.unit_price)}
            for i in order.items
        ],
        distance_km=float(order.distance_km) if order.distance_km is not None else None,
        delivery_eta_minutes=order.delivery_eta_minutes,
        shipping_address=addr,
    )


@router.post("", response_model=OrderOut)
def place_order(body: PlaceOrderRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not body.items:
        raise HTTPException(400, "Cart empty")
    method = (body.payment_method or "cod").lower().strip()
    if method not in PAYMENT_METHODS:
        raise HTTPException(400, "Invalid payment method")

    address = _parse_address(body.shipping_address)
    svc = check_serviceability(address)
    if not svc.eligible:
        raise HTTPException(400, svc.message)

    # Lock product rows for the duration of this transaction to avoid oversell races.
    product_ids = [it.product_id for it in body.items]
    locked = (
        db.query(Product)
        .filter(Product.id.in_(product_ids))
        .with_for_update()
        .all()
    )
    by_id = {p.id: p for p in locked}

    subtotal = Decimal("0")
    line_items: list[tuple[Product, int]] = []
    needs_rx = False
    for it in body.items:
        p = by_id.get(it.product_id)
        if not p or not p.is_active:
            raise HTTPException(400, f"Invalid product {it.product_id}")
        if p.stock_qty < it.quantity:
            raise HTTPException(400, f"Insufficient stock for {p.name}")
        if p.requires_prescription:
            needs_rx = True
        # B2C storefront charges MRP; PTR (`price`) is internal/admin only.
        unit = p.mrp if p.mrp and p.mrp > 0 else p.price
        subtotal += unit * it.quantity
        line_items.append((p, it.quantity))

    if needs_rx:
        if not body.prescription_id:
            raise HTTPException(
                400,
                "Prescription required for Rx medicines. Upload and get pharmacist approval first.",
            )
        rx = (
            db.query(Prescription)
            .filter(
                Prescription.id == body.prescription_id,
                Prescription.user_id == user.id,
            )
            .first()
        )
        if not rx:
            raise HTTPException(400, "Prescription not found")
        if rx.status != "approved":
            raise HTTPException(400, "Prescription must be approved by a pharmacist before ordering Rx items")

    delivery = Decimal(str(delivery_fee_for_subtotal(subtotal)))
    payment_status = "pending" if method == "cod" else "awaiting_payment"

    order = Order(
        order_number=_order_number(),
        user_id=user.id,
        status="pending",
        subtotal=subtotal,
        delivery_fee=delivery,
        total=subtotal + delivery,
        payment_status=payment_status,
        payment_method=method,
        shipping_address_json=json.dumps(address),
        prescription_id=body.prescription_id if needs_rx else None,
        distance_km=svc.distance_km,
        delivery_eta_minutes=svc.eta_minutes or settings.delivery_eta_minutes,
    )
    db.add(order)
    try:
        db.flush()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(500, "Could not allocate order number") from exc

    for p, qty in line_items:
        if p.stock_qty < qty:
            db.rollback()
            raise HTTPException(400, f"Insufficient stock for {p.name}")
        unit = p.mrp if p.mrp and p.mrp > 0 else p.price
        db.add(OrderItem(order_id=order.id, product_id=p.id, quantity=qty, unit_price=unit))
        p.stock_qty -= qty
    db.commit()
    order = db.query(Order).options(joinedload(Order.items)).filter(Order.id == order.id).first()
    return _to_out(order, user)


@router.get("/mine", response_model=list[OrderOut])
def my_orders(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = (
        db.query(Order)
        .options(joinedload(Order.items))
        .filter(Order.user_id == user.id)
        .order_by(Order.id.desc())
        .all()
    )
    return [_to_out(o, user) for o in rows]
