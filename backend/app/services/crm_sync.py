"""Keep CRM contacts in sync with storefront User accounts."""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.models import CrmCustomer, Role, User


def upsert_crm_from_user(db: Session, user: User) -> CrmCustomer:
    """Create or update a CRM contact for a storefront customer account."""
    email = (user.email or "").lower().strip() or None
    phone = (user.phone or "").strip() or None

    existing = None
    if user.id:
        existing = db.query(CrmCustomer).filter(CrmCustomer.user_id == user.id).first()
    if not existing and email:
        existing = db.query(CrmCustomer).filter(CrmCustomer.email == email).first()
    if not existing and phone:
        existing = (
            db.query(CrmCustomer)
            .filter(CrmCustomer.phone == phone, CrmCustomer.user_id.is_(None))
            .first()
        )

    if existing:
        existing.user_id = user.id
        existing.full_name = user.full_name or existing.full_name
        if email:
            existing.email = email
        if phone and not existing.phone:
            existing.phone = phone
        existing.is_active = bool(user.is_active)
        if existing.source in (None, "", "manual"):
            existing.source = "storefront"
        db.flush()
        return existing

    row = CrmCustomer(
        full_name=user.full_name or (email or "Customer"),
        email=email,
        phone=phone,
        source="storefront",
        marketing_opt_in=False,
        is_active=bool(user.is_active),
        user_id=user.id,
        notes="Registered on Interelia Wellness website",
    )
    db.add(row)
    db.flush()
    return row


def sync_storefront_customers_to_crm(db: Session) -> dict:
    """Backfill CRM rows for existing customer-role users missing from CRM."""
    customer_role = db.query(Role).filter_by(name="customer").first()
    if not customer_role:
        return {"created": 0, "linked": 0, "total_users": 0}

    users = db.query(User).filter(User.role_id == customer_role.id).all()
    created = 0
    linked = 0
    for u in users:
        email = (u.email or "").lower().strip() or None
        already = db.query(CrmCustomer).filter(CrmCustomer.user_id == u.id).first()
        if not already and email:
            already = db.query(CrmCustomer).filter(CrmCustomer.email == email).first()
        is_create = already is None
        upsert_crm_from_user(db, u)
        if is_create:
            created += 1
        else:
            linked += 1
    db.commit()
    return {"created": created, "linked": linked, "total_users": len(users)}
