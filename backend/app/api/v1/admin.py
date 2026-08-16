"""Admin API — RBAC protected operations."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import Response
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.api.deps import require_permission, require_staff, user_permissions
from app.core.config import settings
from app.db.session import get_db
from app.models import (
    AIModelConfig,
    AdBanner,
    AuditLog,
    BlogPost,
    Brand,
    Category,
    CrmCustomer,
    CustomerNotification,
    Expert,
    InstagramAccountConfig,
    KnowledgeChunk,
    MedicineRequest,
    MedicineRequestItem,
    MerchRail,
    MerchRailItem,
    NotificationRecipient,
    Order,
    OrderItem,
    Prescription,
    Product,
    Role,
    SocialReel,
    User,
)
from app.schemas import (
    AIChatRequest,
    AIChatResponse,
    AIConfigOut,
    AdBannerCreate,
    AdBannerOut,
    AdBannerUpdate,
    BlogCreate,
    BlogOut,
    BrandCreate,
    BrandOut,
    BrandUpdate,
    ExpertCreate,
    ExpertOut,
    ExpertUpdate,
    CrmCustomerCreate,
    CrmCustomerListResponse,
    CrmCustomerOut,
    CrmCustomerUpdate,
    CrmStatsOut,
    DashboardOut,
    BulkIdsRequest,
    ImportResult,
    InstagramAccountOut,
    InstagramSyncResult,
    MedicineRequestAdminUpdate,
    MedicineRequestOut,
    MerchRailOut,
    MerchRailUpdate,
    NotificationCreate,
    NotificationOut,
    OrderOut,
    OrderStatusUpdate,
    PrescriptionOut,
    PrescriptionReview,
    ProductCreate,
    ProductListResponse,
    ProductOut,
    ProductUpdate,
    SocialReelCreate,
    SocialReelOut,
    SocialReelUpdate,
    ReelBulkIdsRequest,
    UserOut,
)
from app.services.imports import (
    customer_csv_template,
    export_customers_csv,
    export_products_csv,
    import_customer_from_coa_docx,
    import_customers_file,
    import_itemwise_products,
)
from app.services.rag import generate_chat_reply, rebuild_knowledge_index
from app.services.serializers import brand_to_out, product_to_out, slugify
from app.services.merchandising import (
    ensure_default_rails,
    products_to_out,
    resolve_rail_products,
)
from app.api.v1.health import banner_to_out, blog_to_out, reel_to_out

router = APIRouter()


def _unique_brand_slug(db: Session, base: str, exclude_id: Optional[int] = None) -> str:
    slug = slugify(base)
    candidate = slug
    n = 2
    while True:
        q = db.query(Brand).filter(Brand.slug == candidate)
        if exclude_id is not None:
            q = q.filter(Brand.id != exclude_id)
        if not q.first():
            return candidate
        candidate = f"{slug}-{n}"
        n += 1


def _get_or_create_brand_by_name(db: Session, name: str) -> Brand:
    brand = db.query(Brand).filter_by(name=name).first()
    if brand:
        if not brand.slug:
            brand.slug = _unique_brand_slug(db, brand.name, exclude_id=brand.id)
        return brand
    brand = Brand(
        name=name,
        slug=_unique_brand_slug(db, name),
        is_partner=True,
        is_active=True,
    )
    db.add(brand)
    db.flush()
    return brand


def audit(db: Session, actor_id: int, action: str, entity: str, entity_id: str, meta=None):
    db.add(
        AuditLog(
            actor_id=actor_id,
            action=action,
            entity=entity,
            entity_id=entity_id,
            metadata_json=json.dumps(meta or {}),
        )
    )


@router.get("/dashboard", response_model=DashboardOut)
def dashboard(user: User = Depends(require_staff), db: Session = Depends(get_db)):
    revenue = db.query(func.coalesce(func.sum(Order.total), 0)).filter(Order.status != "cancelled").scalar()
    top = (
        db.query(Product)
        .options(joinedload(Product.brand))
        .order_by(Product.review_count.desc())
        .limit(5)
        .all()
    )
    crm_count = db.query(CrmCustomer).filter(CrmCustomer.is_active.is_(True)).count()
    store_count = db.query(User).join(Role).filter(Role.name == "customer").count()
    return DashboardOut(
        revenue_mtd=Decimal(str(revenue or 0)),
        orders_count=db.query(Order).count(),
        customers_count=max(crm_count, store_count),
        products_count=db.query(Product).count(),
        pending_orders=db.query(Order).filter(Order.status == "pending").count(),
        pending_prescriptions=db.query(Prescription).filter(Prescription.status == "pending_review").count(),
        pending_medicine_requests=db.query(MedicineRequest)
        .filter(MedicineRequest.status == "submitted")
        .count(),
        low_stock=db.query(Product).filter(Product.stock_qty <= Product.low_stock_threshold).count(),
        top_products=[{"name": p.name, "slug": p.slug, "reviews": p.review_count} for p in top],
    )


@router.get("/products", response_model=ProductListResponse)
def admin_products(
    brand_id: Optional[int] = None,
    brand: Optional[str] = None,
    brand_slug: Optional[str] = Query(
        None,
        description="Filter by brand slug(s), comma-separated (e.g. fitness-wellness,interelia-melatonin)",
    ),
    q: Optional[str] = None,
    missing_image: Optional[bool] = None,
    is_active: Optional[bool] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    user: User = Depends(require_permission("products.read")),
    db: Session = Depends(get_db),
):
    query = (
        db.query(Product)
        .options(joinedload(Product.category), joinedload(Product.brand))
    )
    brand_joined = False
    if brand_id is not None:
        query = query.filter(Product.brand_id == brand_id)
    elif brand_slug:
        slugs = [s.strip() for s in brand_slug.split(",") if s.strip()]
        if slugs:
            query = query.join(Brand).filter(Brand.slug.in_(slugs))
            brand_joined = True
    elif brand:
        query = query.join(Brand).filter(Brand.name == brand)
        brand_joined = True
    if q:
        like = f"%{q.strip()}%"
        from sqlalchemy import or_

        if not brand_joined:
            query = query.outerjoin(Brand, Product.brand_id == Brand.id)
        query = query.filter(
            or_(
                Product.name.ilike(like),
                Product.sku.ilike(like),
                Product.slug.ilike(like),
                Brand.name.ilike(like),
            )
        )
    if missing_image is True:
        from sqlalchemy import or_

        query = query.filter(or_(Product.image_url.is_(None), Product.image_url == ""))
    elif missing_image is False:
        query = query.filter(Product.image_url.isnot(None), Product.image_url != "")
    if is_active is not None:
        query = query.filter(Product.is_active.is_(is_active))
    total = query.count()
    items = (
        query.order_by(Product.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return ProductListResponse(
        items=[product_to_out(p) for p in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.post("/products", response_model=ProductOut)
def create_product(
    body: ProductCreate,
    user: User = Depends(require_permission("products.write")),
    db: Session = Depends(get_db),
):
    if db.query(Product).filter_by(slug=body.slug).first():
        raise HTTPException(400, "Slug already exists")
    cat = db.query(Category).filter_by(slug=body.category_slug).first()
    if not cat:
        raise HTTPException(400, "Unknown category")
    brand = _get_or_create_brand_by_name(db, body.brand_name)
    p = Product(
        name=body.name,
        slug=body.slug,
        description=body.description,
        price=body.price,
        mrp=body.mrp,
        stock_qty=body.stock_qty,
        requires_prescription=body.requires_prescription,
        pack_size=body.pack_size,
        ingredients=body.ingredients,
        usage_text=body.usage_text,
        warnings=body.warnings,
        storage_text=body.storage_text,
        benefits_json=json.dumps(body.benefits),
        image_url=body.image_url,
        meta_title=body.meta_title or body.name,
        meta_description=body.meta_description,
        category_id=cat.id,
        brand_id=brand.id,
        is_active=body.is_active,
    )
    db.add(p)
    db.flush()
    audit(db, user.id, "create", "product", str(p.id))
    db.commit()
    rebuild_knowledge_index(db)
    p = db.query(Product).options(joinedload(Product.category), joinedload(Product.brand)).get(p.id)
    return product_to_out(p)


@router.patch("/products/{product_id}", response_model=ProductOut)
def update_product(
    product_id: int,
    body: ProductUpdate,
    user: User = Depends(require_permission("products.write")),
    db: Session = Depends(get_db),
):
    p = db.query(Product).options(joinedload(Product.category), joinedload(Product.brand)).get(product_id)
    if not p:
        raise HTTPException(404, "Product not found")
    data = body.model_dump(exclude_unset=True)
    if "benefits" in data:
        p.benefits_json = json.dumps(data.pop("benefits"))
    if "category_slug" in data:
        cat = db.query(Category).filter_by(slug=data.pop("category_slug")).first()
        if cat:
            p.category_id = cat.id
    if "brand_name" in data:
        name = data.pop("brand_name")
        brand = _get_or_create_brand_by_name(db, name)
        p.brand_id = brand.id
    for k, v in data.items():
        setattr(p, k, v)
    audit(db, user.id, "update", "product", str(p.id))
    db.commit()
    rebuild_knowledge_index(db)
    p = db.query(Product).options(joinedload(Product.category), joinedload(Product.brand)).get(product_id)
    return product_to_out(p)


@router.post("/products/upload-image")
async def admin_upload_product_image(
    file: UploadFile = File(...),
    user: User = Depends(require_permission("products.write")),
):
    from app.services.storage import save_public_media

    url = await save_public_media("products", file, allow_video=False)
    return {"url": url}


@router.get("/brands", response_model=list[BrandOut])
def admin_brands(
    curated: bool = Query(False, description="Only featured or story brands"),
    user: User = Depends(require_permission("products.read")),
    db: Session = Depends(get_db),
):
    query = db.query(Brand)
    if curated:
        from sqlalchemy import or_

        query = query.filter(
            or_(
                Brand.is_featured.is_(True),
                Brand.tagline.isnot(None),
                Brand.description.isnot(None),
            )
        )
    brands = query.order_by(Brand.sort_order.asc(), Brand.name.asc()).all()
    # Single grouped count query instead of N+1
    counts = dict(
        db.query(Product.brand_id, func.count(Product.id)).group_by(Product.brand_id).all()
    )
    return [brand_to_out(b, product_count=int(counts.get(b.id, 0))) for b in brands]


@router.post("/brands", response_model=BrandOut)
def create_brand(
    body: BrandCreate,
    user: User = Depends(require_permission("products.write")),
    db: Session = Depends(get_db),
):
    if db.query(Brand).filter_by(name=body.name).first():
        raise HTTPException(400, "Brand name already exists")
    slug = body.slug or slugify(body.name)
    slug = _unique_brand_slug(db, slug)
    brand = Brand(
        name=body.name,
        slug=slug,
        tagline=body.tagline,
        description=body.description,
        logo_url=body.logo_url,
        cover_image_url=body.cover_image_url,
        is_featured=body.is_featured,
        sort_order=body.sort_order,
        is_partner=body.is_partner,
        is_active=body.is_active,
        website_url=body.website_url,
    )
    db.add(brand)
    db.flush()
    audit(db, user.id, "create", "brand", str(brand.id))
    db.commit()
    return brand_to_out(brand, product_count=0)


@router.patch("/brands/{brand_id}", response_model=BrandOut)
def update_brand(
    brand_id: int,
    body: BrandUpdate,
    user: User = Depends(require_permission("products.write")),
    db: Session = Depends(get_db),
):
    brand = db.query(Brand).get(brand_id)
    if not brand:
        raise HTTPException(404, "Brand not found")
    data = body.model_dump(exclude_unset=True)
    if "name" in data:
        other = db.query(Brand).filter(Brand.name == data["name"], Brand.id != brand_id).first()
        if other:
            raise HTTPException(400, "Brand name already exists")
    if "slug" in data and data["slug"]:
        data["slug"] = _unique_brand_slug(db, data["slug"], exclude_id=brand_id)
    for k, v in data.items():
        setattr(brand, k, v)
    audit(db, user.id, "update", "brand", str(brand.id))
    db.commit()
    count = db.query(Product).filter(Product.brand_id == brand.id).count()
    return brand_to_out(brand, product_count=count)


@router.delete("/brands/{brand_id}")
def deactivate_brand(
    brand_id: int,
    user: User = Depends(require_permission("products.write")),
    db: Session = Depends(get_db),
):
    brand = db.query(Brand).get(brand_id)
    if not brand:
        raise HTTPException(404, "Brand not found")
    brand.is_active = False
    audit(db, user.id, "deactivate", "brand", str(brand.id))
    db.commit()
    return {"ok": True}


@router.post("/brands/upload-logo")
async def admin_upload_brand_logo(
    file: UploadFile = File(...),
    user: User = Depends(require_permission("products.write")),
):
    from app.services.storage import save_public_media

    url = await save_public_media("brands", file, allow_video=False)
    return {"url": url}


@router.delete("/products/{product_id}")
def delete_product(
    product_id: int,
    user: User = Depends(require_permission("products.write")),
    db: Session = Depends(get_db),
):
    p = db.query(Product).get(product_id)
    if not p:
        raise HTTPException(404, "Not found")
    p.is_active = False
    audit(db, user.id, "deactivate", "product", str(p.id))
    db.commit()
    rebuild_knowledge_index(db)
    return {"ok": True}


@router.post("/products/import", response_model=ImportResult)
async def import_products(
    file: UploadFile = File(...),
    limit: Optional[int] = Query(None, description="Optional row cap for testing"),
    user: User = Depends(require_permission("products.write")),
    db: Session = Depends(get_db),
):
    raw = await file.read()
    if not raw:
        raise HTTPException(400, "Empty file")
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = raw.decode("latin-1")
    try:
        result = import_itemwise_products(db, text, limit=limit)
    except Exception as e:  # noqa: BLE001
        db.rollback()
        raise HTTPException(400, f"Import failed: {e}") from e
    audit(
        db,
        user.id,
        "import",
        "product",
        "bulk",
        {"created": result.get("created"), "updated": result.get("updated"), "skipped": result.get("skipped")},
    )
    # Invalidate RAG index so next chat / Admin → Rebuild picks up new stock
    db.query(KnowledgeChunk).delete()
    db.commit()
    return ImportResult(
        created=result.get("created", 0),
        updated=result.get("updated", 0),
        skipped=result.get("skipped", 0),
        total=result.get("total", 0),
        detail=(result.get("detail") or "")
        + " AI index cleared — open Admin → AI Knowledge → Rebuild index (or ask the assistant once to auto-rebuild).",
        errors=result.get("errors") or [],
    )


@router.get("/products/export")
def export_products(
    user: User = Depends(require_permission("products.read")),
    db: Session = Depends(get_db),
):
    items = (
        db.query(Product)
        .options(joinedload(Product.category), joinedload(Product.brand))
        .order_by(Product.name.asc())
        .all()
    )
    csv_text = export_products_csv(items)
    return Response(
        content=csv_text,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=interelia_products.csv"},
    )


@router.get("/orders", response_model=list[OrderOut])
def admin_orders(
    status_filter: Optional[str] = Query(None, alias="status"),
    user: User = Depends(require_permission("orders.read")),
    db: Session = Depends(get_db),
):
    q = db.query(Order).options(joinedload(Order.items)).order_by(Order.id.desc())
    if status_filter:
        q = q.filter(Order.status == status_filter)
    out = []
    for o in q.limit(100).all():
        u = db.query(User).get(o.user_id)
        addr = None
        if o.shipping_address_json:
            try:
                addr = json.loads(o.shipping_address_json)
            except json.JSONDecodeError:
                addr = None
        out.append(
            OrderOut(
                id=o.id,
                order_number=o.order_number,
                status=o.status,
                total=o.total,
                subtotal=o.subtotal,
                delivery_fee=o.delivery_fee,
                payment_status=o.payment_status,
                user_email=u.email if u else None,
                user_name=u.full_name if u else None,
                created_at=o.created_at,
                items=[
                    {"product_id": i.product_id, "quantity": i.quantity, "unit_price": float(i.unit_price)}
                    for i in o.items
                ],
                distance_km=float(o.distance_km) if o.distance_km is not None else None,
                delivery_eta_minutes=o.delivery_eta_minutes,
                shipping_address=addr,
            )
        )
    return out


@router.patch("/orders/{order_id}", response_model=OrderOut)
def update_order_status(
    order_id: int,
    body: OrderStatusUpdate,
    user: User = Depends(require_permission("orders.write")),
    db: Session = Depends(get_db),
):
    allowed = {
        "pending",
        "processing",
        "approved",
        "packed",
        "shipped",
        "delivered",
        "returned",
        "cancelled",
        "refunded",
    }
    if body.status not in allowed:
        raise HTTPException(400, "Invalid status")
    o = db.query(Order).options(joinedload(Order.items)).get(order_id)
    if not o:
        raise HTTPException(404, "Order not found")

    previous = o.status
    restock_from = {"pending", "processing", "approved", "packed", "shipped", "delivered"}
    restock_to = {"cancelled", "returned"}
    if previous in restock_from and body.status in restock_to:
        for line in o.items:
            product = db.query(Product).filter(Product.id == line.product_id).with_for_update().first()
            if product:
                product.stock_qty = int(product.stock_qty or 0) + int(line.quantity or 0)

    o.status = body.status
    if body.status == "refunded":
        o.payment_status = "refunded"
    if body.status == "delivered":
        linked = (
            db.query(MedicineRequest)
            .filter(MedicineRequest.order_id == o.id, MedicineRequest.status == "ordered")
            .all()
        )
        for req in linked:
            req.status = "completed"
    audit(db, user.id, "status_change", "order", str(o.id), {"status": body.status, "from": previous})
    db.commit()
    u = db.query(User).get(o.user_id)
    addr = None
    if o.shipping_address_json:
        try:
            addr = json.loads(o.shipping_address_json)
        except json.JSONDecodeError:
            addr = None
    return OrderOut(
        id=o.id,
        order_number=o.order_number,
        status=o.status,
        total=o.total,
        subtotal=o.subtotal,
        delivery_fee=o.delivery_fee,
        payment_status=o.payment_status,
        user_email=u.email if u else None,
        user_name=u.full_name if u else None,
        created_at=o.created_at,
        items=[{"product_id": i.product_id, "quantity": i.quantity, "unit_price": float(i.unit_price)} for i in o.items],
        distance_km=float(o.distance_km) if o.distance_km is not None else None,
        delivery_eta_minutes=o.delivery_eta_minutes,
        shipping_address=addr,
    )


@router.get("/prescriptions", response_model=list[PrescriptionOut])
def admin_prescriptions(
    user: User = Depends(require_permission("prescriptions.review")),
    db: Session = Depends(get_db),
):
    rows = db.query(Prescription).order_by(Prescription.id.desc()).limit(100).all()
    return [
        PrescriptionOut(
            id=r.id,
            status=r.status,
            file_url=r.file_url,
            file_name=r.file_name,
            extracted_medicines=r.extracted_medicines,
            notes=r.notes,
            created_at=r.created_at,
            user_id=r.user_id,
        )
        for r in rows
    ]


@router.post("/prescriptions/{rx_id}/approve", response_model=PrescriptionOut)
def approve_rx(
    rx_id: int,
    body: PrescriptionReview,
    user: User = Depends(require_permission("prescriptions.review")),
    db: Session = Depends(get_db),
):
    r = db.query(Prescription).get(rx_id)
    if not r:
        raise HTTPException(404, "Not found")
    r.status = "approved"
    r.reviewed_by = user.id
    r.notes = body.notes or "Verified by pharmacist"
    audit(db, user.id, "approve", "prescription", str(r.id))
    db.commit()
    return PrescriptionOut(
        id=r.id,
        status=r.status,
        file_url=r.file_url,
        file_name=r.file_name,
        extracted_medicines=r.extracted_medicines,
        notes=r.notes,
        created_at=r.created_at,
        user_id=r.user_id,
    )


@router.post("/prescriptions/{rx_id}/reject", response_model=PrescriptionOut)
def reject_rx(
    rx_id: int,
    body: PrescriptionReview,
    user: User = Depends(require_permission("prescriptions.review")),
    db: Session = Depends(get_db),
):
    r = db.query(Prescription).get(rx_id)
    if not r:
        raise HTTPException(404, "Not found")
    r.status = "rejected"
    r.reviewed_by = user.id
    r.notes = body.notes or "Rejected — unclear image or invalid Rx"
    audit(db, user.id, "reject", "prescription", str(r.id))
    db.commit()
    return PrescriptionOut(
        id=r.id,
        status=r.status,
        file_url=r.file_url,
        file_name=r.file_name,
        extracted_medicines=r.extracted_medicines,
        notes=r.notes,
        created_at=r.created_at,
        user_id=r.user_id,
    )


@router.get("/users", response_model=list[UserOut])
def admin_users(user: User = Depends(require_permission("users.manage")), db: Session = Depends(get_db)):
    rows = db.query(User).options(joinedload(User.role)).all()
    return [
        UserOut(
            id=u.id,
            email=u.email,
            full_name=u.full_name,
            phone=u.phone,
            rewards_points=u.rewards_points,
            role=u.role.name if u.role else "customer",
            is_active=u.is_active,
        )
        for u in rows
    ]


@router.patch("/users/{user_id}/role")
def set_user_role(
    user_id: int,
    role: str = Query(...),
    user: User = Depends(require_permission("users.manage")),
    db: Session = Depends(get_db),
):
    target = db.query(User).get(user_id)
    r = db.query(Role).filter_by(name=role).first()
    if not target or not r:
        raise HTTPException(404, "User or role not found")
    target.role_id = r.id
    audit(db, user.id, "role_change", "user", str(user_id), {"role": role})
    db.commit()
    return {"ok": True, "role": role}


# ----- CRM Customers (separate from staff Users) -----


@router.get("/customers/stats", response_model=CrmStatsOut)
def customer_stats(
    user: User = Depends(require_permission("customers.manage")),
    db: Session = Depends(get_db),
):
    total = db.query(CrmCustomer).count()
    active = db.query(CrmCustomer).filter(CrmCustomer.is_active.is_(True)).count()
    opted = (
        db.query(CrmCustomer)
        .filter(CrmCustomer.is_active.is_(True), CrmCustomer.marketing_opt_in.is_(True))
        .count()
    )
    cities = (
        db.query(func.count(func.distinct(CrmCustomer.city)))
        .filter(CrmCustomer.city.isnot(None), CrmCustomer.city != "")
        .scalar()
        or 0
    )
    return CrmStatsOut(total=total, active=active, opted_in=opted, cities=int(cities))


@router.get("/customers/template")
def customers_template(user: User = Depends(require_permission("customers.manage"))):
    return Response(
        content=customer_csv_template(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=interelia_customers_template.csv"},
    )


@router.post("/customers/sync-store-accounts")
def sync_store_accounts(
    user: User = Depends(require_permission("customers.manage")),
    db: Session = Depends(get_db),
):
    """Backfill Admin → Customers from website accounts (role=customer)."""
    from app.services.crm_sync import sync_storefront_customers_to_crm

    result = sync_storefront_customers_to_crm(db)
    audit(db, user.id, "sync", "crm_customer", "storefront")
    db.commit()
    return result


@router.get("/customers", response_model=CrmCustomerListResponse)
def list_customers(
    q: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    opt_in: Optional[bool] = Query(None),
    is_active: Optional[bool] = Query(None),
    source: Optional[str] = Query(None),
    city: Optional[str] = Query(None),
    exclude_suppliers: bool = Query(True, description="Hide stock_csv supplier rows by default"),
    user: User = Depends(require_permission("customers.manage")),
    db: Session = Depends(get_db),
):
    # Pull in website registrations that were never written to CRM
    from app.services.crm_sync import sync_storefront_customers_to_crm

    sync_storefront_customers_to_crm(db)

    query = db.query(CrmCustomer)
    if q:
        like = f"%{q.strip()}%"
        query = query.filter(
            (CrmCustomer.full_name.ilike(like))
            | (CrmCustomer.email.ilike(like))
            | (CrmCustomer.phone.ilike(like))
            | (CrmCustomer.company.ilike(like))
            | (CrmCustomer.city.ilike(like))
            | (CrmCustomer.external_id.ilike(like))
        )
    if opt_in is not None:
        query = query.filter(CrmCustomer.marketing_opt_in.is_(opt_in))
    if is_active is not None:
        query = query.filter(CrmCustomer.is_active.is_(is_active))
    if source:
        query = query.filter(CrmCustomer.source == source)
    elif exclude_suppliers:
        query = query.filter(CrmCustomer.source != "stock_csv")
    if city:
        query = query.filter(CrmCustomer.city.ilike(f"%{city.strip()}%"))

    total = query.count()
    items = (
        query.order_by(CrmCustomer.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return CrmCustomerListResponse(items=items, total=total, page=page, page_size=page_size)


@router.post("/customers", response_model=CrmCustomerOut)
def create_customer(
    body: CrmCustomerCreate,
    user: User = Depends(require_permission("customers.manage")),
    db: Session = Depends(get_db),
):
    email = str(body.email).lower() if body.email else None
    if email and db.query(CrmCustomer).filter_by(email=email).first():
        raise HTTPException(400, "Customer email already exists")
    if body.external_id and db.query(CrmCustomer).filter_by(external_id=body.external_id).first():
        raise HTTPException(400, "external_id already exists")
    c = CrmCustomer(
        external_id=body.external_id,
        full_name=body.full_name,
        email=email,
        phone=body.phone,
        company=body.company,
        address=body.address,
        city=body.city,
        state=body.state,
        pincode=body.pincode,
        tags=body.tags,
        notes=body.notes,
        marketing_opt_in=body.marketing_opt_in,
        source="manual",
        is_active=True,
    )
    db.add(c)
    db.flush()
    audit(db, user.id, "create", "crm_customer", str(c.id))
    db.commit()
    db.refresh(c)
    return c


@router.patch("/customers/{customer_id}", response_model=CrmCustomerOut)
def update_customer(
    customer_id: int,
    body: CrmCustomerUpdate,
    user: User = Depends(require_permission("customers.manage")),
    db: Session = Depends(get_db),
):
    c = db.query(CrmCustomer).get(customer_id)
    if not c:
        raise HTTPException(404, "Customer not found")
    data = body.model_dump(exclude_unset=True)
    if "email" in data and data["email"]:
        data["email"] = str(data["email"]).lower()
        other = db.query(CrmCustomer).filter(CrmCustomer.email == data["email"], CrmCustomer.id != customer_id).first()
        if other:
            raise HTTPException(400, "Email already used by another customer")
    for k, v in data.items():
        setattr(c, k, v)
    audit(db, user.id, "update", "crm_customer", str(c.id))
    db.commit()
    db.refresh(c)
    return c


@router.delete("/customers/{customer_id}")
def deactivate_customer(
    customer_id: int,
    user: User = Depends(require_permission("customers.manage")),
    db: Session = Depends(get_db),
):
    c = db.query(CrmCustomer).get(customer_id)
    if not c:
        raise HTTPException(404, "Customer not found")
    c.is_active = False
    audit(db, user.id, "deactivate", "crm_customer", str(c.id))
    db.commit()
    return {"ok": True}


@router.post("/customers/{customer_id}/reactivate")
def reactivate_customer(
    customer_id: int,
    user: User = Depends(require_permission("customers.manage")),
    db: Session = Depends(get_db),
):
    c = db.query(CrmCustomer).get(customer_id)
    if not c:
        raise HTTPException(404, "Customer not found")
    c.is_active = True
    audit(db, user.id, "reactivate", "crm_customer", str(c.id))
    db.commit()
    return {"ok": True, "is_active": True}


@router.post("/customers/bulk-deactivate")
def bulk_deactivate_customers(
    body: BulkIdsRequest,
    user: User = Depends(require_permission("customers.manage")),
    db: Session = Depends(get_db),
):
    if not body.customer_ids:
        raise HTTPException(400, "customer_ids required")
    rows = db.query(CrmCustomer).filter(CrmCustomer.id.in_(body.customer_ids)).all()
    for c in rows:
        c.is_active = False
    audit(db, user.id, "bulk_deactivate", "crm_customer", "bulk", {"count": len(rows)})
    db.commit()
    return {"ok": True, "count": len(rows)}


@router.post("/customers/import", response_model=ImportResult)
async def import_customers(
    file: UploadFile = File(...),
    user: User = Depends(require_permission("customers.manage")),
    db: Session = Depends(get_db),
):
    raw = await file.read()
    if not raw:
        raise HTTPException(400, "Empty file")
    name = (file.filename or "").lower()
    if name.endswith(".docx"):
        try:
            result = import_customer_from_coa_docx(db, raw)
        except Exception as e:
            raise HTTPException(400, f"COA import failed: {e}") from e
        audit(db, user.id, "import", "crm_customer", "coa", {k: result.get(k) for k in ("created", "updated", "skipped")})
        db.commit()
        return ImportResult(
            created=result.get("created", 0),
            updated=result.get("updated", 0),
            skipped=result.get("skipped", 0),
            total=result.get("total", 0),
            detail=result.get("detail") or result.get("full_name"),
            errors=result.get("errors") or [],
        )
    try:
        result = import_customers_file(db, raw, file.filename or name)
    except Exception as e:  # noqa: BLE001
        db.rollback()
        raise HTTPException(400, f"Import failed: {e}") from e
    audit(
        db,
        user.id,
        "import",
        "crm_customer",
        "report",
        {"created": result.get("created"), "updated": result.get("updated"), "skipped": result.get("skipped")},
    )
    db.commit()
    return ImportResult(
        created=result.get("created", 0),
        updated=result.get("updated", 0),
        skipped=result.get("skipped", 0),
        total=result.get("total", 0),
        detail=result.get("detail"),
        errors=result.get("errors") or [],
    )


@router.get("/customers/export")
def export_customers(
    user: User = Depends(require_permission("customers.manage")),
    db: Session = Depends(get_db),
):
    rows = db.query(CrmCustomer).order_by(CrmCustomer.full_name.asc()).all()
    csv_text = export_customers_csv(rows)
    return Response(
        content=csv_text,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=interelia_customers.csv"},
    )


@router.patch("/customers/{customer_id}/opt-in")
def set_customer_opt_in(
    customer_id: int,
    opt_in: bool = Query(...),
    user: User = Depends(require_permission("customers.manage")),
    db: Session = Depends(get_db),
):
    c = db.query(CrmCustomer).get(customer_id)
    if not c:
        raise HTTPException(404, "Customer not found")
    c.marketing_opt_in = opt_in
    db.commit()
    return {"ok": True, "marketing_opt_in": opt_in}


@router.post("/notifications", response_model=NotificationOut)
def send_notification(
    body: NotificationCreate,
    user: User = Depends(require_permission("notifications.send")),
    db: Session = Depends(get_db),
):
    if body.audience == "selected":
        if not body.customer_ids:
            raise HTTPException(400, "customer_ids required for selected audience")
        targets = db.query(CrmCustomer).filter(CrmCustomer.id.in_(body.customer_ids), CrmCustomer.is_active.is_(True)).all()
    elif body.audience == "all":
        targets = (
            db.query(CrmCustomer)
            .filter(CrmCustomer.is_active.is_(True), CrmCustomer.source != "stock_csv")
            .all()
        )
    else:  # opted_in
        targets = (
            db.query(CrmCustomer)
            .filter(
                CrmCustomer.is_active.is_(True),
                CrmCustomer.marketing_opt_in.is_(True),
                CrmCustomer.source != "stock_csv",
            )
            .all()
        )

    if not targets:
        raise HTTPException(400, "No customers match this audience — import customers first")

    # Logged for outreach — SMS/WhatsApp providers can mark delivered later.
    # Do not pretend messages were sent.
    note = CustomerNotification(
        title=body.title,
        body=body.body,
        notification_type=body.notification_type,
        audience=body.audience,
        status="queued",
        sent_at=None,
        created_by_id=user.id,
        recipient_count=len(targets),
    )
    db.add(note)
    db.flush()
    for c in targets:
        db.add(NotificationRecipient(notification_id=note.id, customer_id=c.id, delivered_at=None))
        c.last_notified_at = datetime.now(timezone.utc)
    audit(
        db,
        user.id,
        "notify",
        "crm_customer",
        "bulk",
        {"notification_id": note.id, "recipients": len(targets), "type": body.notification_type, "status": "queued"},
    )
    db.commit()
    db.refresh(note)
    return note


@router.get("/notifications", response_model=list[NotificationOut])
def list_notifications(
    user: User = Depends(require_permission("notifications.send")),
    db: Session = Depends(get_db),
):
    return (
        db.query(CustomerNotification)
        .order_by(CustomerNotification.id.desc())
        .limit(100)
        .all()
    )


@router.post("/content/blogs", response_model=BlogOut)
def create_blog(
    body: BlogCreate,
    user: User = Depends(require_permission("content.write")),
    db: Session = Depends(get_db),
):
    if db.query(BlogPost).filter_by(slug=body.slug).first():
        raise HTTPException(400, "Slug exists")
    b = BlogPost(
        title=body.title,
        slug=body.slug,
        excerpt=body.excerpt,
        content=body.content,
        category=body.category,
        tags_json=json.dumps(body.tags),
        author_name=body.author_name,
        author_role=body.author_role,
        reading_time=body.reading_time,
        is_published=body.is_published,
        featured=body.featured,
        published_at=datetime.now(timezone.utc) if body.is_published else None,
        meta_title=body.title[:160],
        meta_description=(body.excerpt or "")[:160],
    )
    db.add(b)
    db.commit()
    rebuild_knowledge_index(db)
    return blog_to_out(b)


@router.get("/content/blogs", response_model=list[BlogOut])
def admin_blogs(user: User = Depends(require_permission("content.write")), db: Session = Depends(get_db)):
    return [blog_to_out(b) for b in db.query(BlogPost).order_by(BlogPost.id.desc()).all()]


@router.get("/content/experts", response_model=list[ExpertOut])
def admin_list_experts(
    user: User = Depends(require_permission("content.write")),
    db: Session = Depends(get_db),
):
    from app.services.experts import expert_to_out

    # Return stored maps_url (nullable) so admin edits don't freeze auto-built URLs.
    rows = db.query(Expert).order_by(Expert.sort_order.asc(), Expert.id.asc()).all()
    return [expert_to_out(e, resolve_maps=False) for e in rows]


@router.post("/content/experts", response_model=ExpertOut)
def admin_create_expert(
    body: ExpertCreate,
    user: User = Depends(require_permission("content.write")),
    db: Session = Depends(get_db),
):
    from app.services.experts import expert_to_out

    name = (body.name or "").strip()
    role = (body.role or "").strip()
    specialty = (body.specialty or "").strip()
    if not name or not role or not specialty:
        raise HTTPException(400, "Name, role, and specialty are required")
    slug = slugify(body.slug or name)
    if not slug or slug == "brand":
        raise HTTPException(400, "Valid slug is required")
    if db.query(Expert).filter_by(slug=slug).first():
        raise HTTPException(400, "Slug already exists")
    if not body.phone and body.accepting_calls:
        raise HTTPException(400, "Phone is required when accepting calls")
    e = Expert(
        name=name,
        slug=slug,
        role=role,
        specialty=specialty,
        quote=(body.quote or None),
        bio=(body.bio or None),
        image_url=(body.image_url or None),
        phone=(body.phone or None),
        whatsapp=(body.whatsapp or body.phone or None),
        email=(body.email or None),
        clinic_name=(body.clinic_name or None),
        address_line1=(body.address_line1 or None),
        address_line2=(body.address_line2 or None),
        city=(body.city or None),
        state=(body.state or None),
        pincode=(body.pincode or None),
        maps_url=(body.maps_url or None),
        availability_text=(body.availability_text or None),
        accepting_calls=body.accepting_calls,
        accepting_visits=body.accepting_visits,
        is_featured=body.is_featured,
        is_active=body.is_active,
        sort_order=body.sort_order,
    )
    db.add(e)
    db.flush()
    audit(db, user.id, "create", "expert", str(e.id))
    db.commit()
    db.refresh(e)
    return expert_to_out(e)


@router.patch("/content/experts/{expert_id}", response_model=ExpertOut)
def admin_update_expert(
    expert_id: int,
    body: ExpertUpdate,
    user: User = Depends(require_permission("content.write")),
    db: Session = Depends(get_db),
):
    from app.services.experts import expert_to_out

    e = db.query(Expert).filter_by(id=expert_id).first()
    if not e:
        raise HTTPException(404, "Expert not found")
    data = body.model_dump(exclude_unset=True)
    for key in list(data.keys()):
        if isinstance(data[key], str):
            data[key] = data[key].strip()
    address_keys = {
        "clinic_name",
        "address_line1",
        "address_line2",
        "city",
        "state",
        "pincode",
    }
    address_changed = any(k in data for k in address_keys)
    if "slug" in data:
        if not data["slug"]:
            data.pop("slug")
        else:
            data["slug"] = slugify(data["slug"])
            clash = db.query(Expert).filter(Expert.slug == data["slug"], Expert.id != expert_id).first()
            if clash:
                raise HTTPException(400, "Slug already exists")
    for required in ("name", "role", "specialty"):
        if required in data and not data[required]:
            raise HTTPException(400, f"{required.replace('_', ' ').title()} is required")
    for key, value in data.items():
        setattr(e, key, value)
    # Address edits invalidate a previously auto-persisted maps URL unless admin set a new override.
    if address_changed and "maps_url" not in data:
        e.maps_url = None
    if e.accepting_calls and not e.phone:
        raise HTTPException(400, "Phone is required when accepting calls")
    if not e.whatsapp and e.phone:
        e.whatsapp = e.phone
    audit(db, user.id, "update", "expert", str(e.id))
    db.commit()
    db.refresh(e)
    return expert_to_out(e)


@router.delete("/content/experts/{expert_id}")
def admin_deactivate_expert(
    expert_id: int,
    user: User = Depends(require_permission("content.write")),
    db: Session = Depends(get_db),
):
    e = db.query(Expert).filter_by(id=expert_id).first()
    if not e:
        raise HTTPException(404, "Expert not found")
    e.is_active = False
    audit(db, user.id, "deactivate", "expert", str(e.id))
    db.commit()
    return {"ok": True}


@router.post("/content/experts/upload-photo")
async def admin_upload_expert_photo(
    file: UploadFile = File(...),
    user: User = Depends(require_permission("content.write")),
):
    from app.services.storage import save_public_media

    url = await save_public_media("experts", file, allow_video=False)
    return {"url": url}


def _reel_to_out(r: SocialReel) -> SocialReelOut:
    return reel_to_out(r)


def _banner_to_out(b: AdBanner) -> AdBannerOut:
    return banner_to_out(b)


def _validate_banner_body(db: Session, data: dict) -> None:
    kind = data.get("banner_kind")
    if kind is not None and kind not in ("promo", "offer"):
        raise HTTPException(400, "banner_kind must be promo or offer")
    target = data.get("target_type")
    if target is not None and target not in ("product", "category", "url"):
        raise HTTPException(400, "target_type must be product, category, or url")
    pid = data.get("product_id")
    if pid is not None and not db.query(Product).filter_by(id=pid).first():
        raise HTTPException(400, "Product not found")
    if data.get("target_type") == "product" and not data.get("product_id") and "product_id" in data:
        raise HTTPException(400, "product_id required when target_type=product")


def _ig_account_out(a: InstagramAccountConfig) -> InstagramAccountOut:
    return InstagramAccountOut(
        id=a.id,
        handle=a.handle,
        ig_user_id=a.ig_user_id,
        is_enabled=a.is_enabled,
        last_synced_at=a.last_synced_at,
        last_error=a.last_error,
        token_configured=bool((settings.instagram_access_token or "").strip()),
    )


def _rail_admin_out(db: Session, rail: MerchRail) -> MerchRailOut:
    products = resolve_rail_products(db, rail)
    pin_ids = [
        i.product_id
        for i in db.query(MerchRailItem)
        .filter_by(rail_id=rail.id)
        .order_by(MerchRailItem.sort_order.asc())
        .all()
    ]
    return MerchRailOut(
        id=rail.id,
        key=rail.key,
        title=rail.title,
        subtitle=rail.subtitle,
        is_enabled=rail.is_enabled,
        source_mode=rail.source_mode,
        limit=rail.limit,
        sort_order=rail.sort_order,
        product_ids=pin_ids if rail.source_mode == "manual" else [p.id for p in products],
        items=products_to_out(products),
    )


@router.get("/content/banners", response_model=list[AdBannerOut])
def admin_list_banners(
    placement: Optional[str] = Query(None),
    user: User = Depends(require_permission("content.write")),
    db: Session = Depends(get_db),
):
    q = db.query(AdBanner).options(joinedload(AdBanner.product))
    if placement:
        q = q.filter(AdBanner.placement == placement)
    rows = q.order_by(AdBanner.sort_order.asc(), AdBanner.id.desc()).all()
    return [_banner_to_out(b) for b in rows]


@router.post("/content/banners", response_model=AdBannerOut)
def admin_create_banner(
    body: AdBannerCreate,
    user: User = Depends(require_permission("content.write")),
    db: Session = Depends(get_db),
):
    data = body.model_dump()
    _validate_banner_body(db, data)
    if data.get("target_type") == "product" and not data.get("product_id"):
        raise HTTPException(400, "product_id required when target_type=product")
    if data.get("placement") == "home_offer":
        data["banner_kind"] = data.get("banner_kind") or "offer"
    row = AdBanner(**data)
    db.add(row)
    db.flush()
    audit(db, user.id, "create", "ad_banner", str(row.id))
    db.commit()
    row = db.query(AdBanner).options(joinedload(AdBanner.product)).filter_by(id=row.id).first()
    return _banner_to_out(row)


@router.patch("/content/banners/{banner_id}", response_model=AdBannerOut)
def admin_update_banner(
    banner_id: int,
    body: AdBannerUpdate,
    user: User = Depends(require_permission("content.write")),
    db: Session = Depends(get_db),
):
    row = db.query(AdBanner).filter_by(id=banner_id).first()
    if not row:
        raise HTTPException(404, "Banner not found")
    data = body.model_dump(exclude_unset=True)
    _validate_banner_body(db, data)
    for k, v in data.items():
        setattr(row, k, v)
    audit(db, user.id, "update", "ad_banner", str(row.id))
    db.commit()
    row = db.query(AdBanner).options(joinedload(AdBanner.product)).filter_by(id=banner_id).first()
    return _banner_to_out(row)


@router.delete("/content/banners/{banner_id}")
def admin_delete_banner(
    banner_id: int,
    user: User = Depends(require_permission("content.write")),
    db: Session = Depends(get_db),
):
    row = db.query(AdBanner).filter_by(id=banner_id).first()
    if not row:
        raise HTTPException(404, "Banner not found")
    db.delete(row)
    audit(db, user.id, "delete", "ad_banner", str(banner_id))
    db.commit()
    return {"ok": True}


@router.post("/content/banners/upload")
async def admin_upload_banner_image(
    file: UploadFile = File(...),
    user: User = Depends(require_permission("content.write")),
):
    from app.services.storage import save_public_media

    url = await save_public_media("banners", file, allow_video=False)
    return {"url": url}


@router.get("/content/rails", response_model=list[MerchRailOut])
def admin_list_rails(
    user: User = Depends(require_permission("content.write")),
    db: Session = Depends(get_db),
):
    ensure_default_rails(db)
    rows = db.query(MerchRail).order_by(MerchRail.sort_order.asc(), MerchRail.id.asc()).all()
    return [_rail_admin_out(db, r) for r in rows]


@router.patch("/content/rails/{key}", response_model=MerchRailOut)
def admin_update_rail(
    key: str,
    body: MerchRailUpdate,
    user: User = Depends(require_permission("content.write")),
    db: Session = Depends(get_db),
):
    ensure_default_rails(db)
    rail = db.query(MerchRail).filter_by(key=key).first()
    if not rail:
        raise HTTPException(404, "Rail not found")
    data = body.model_dump(exclude_unset=True)
    product_ids = data.pop("product_ids", None)
    if "source_mode" in data and data["source_mode"] not in ("auto", "manual"):
        raise HTTPException(400, "source_mode must be auto or manual")
    for k, v in data.items():
        setattr(rail, k, v)
    if product_ids is not None:
        db.query(MerchRailItem).filter_by(rail_id=rail.id).delete()
        for i, pid in enumerate(product_ids):
            if not db.query(Product).filter_by(id=pid).first():
                raise HTTPException(400, f"Product {pid} not found")
            db.add(MerchRailItem(rail_id=rail.id, product_id=pid, sort_order=i))
        if rail.source_mode != "manual" and product_ids:
            rail.source_mode = "manual"
    audit(db, user.id, "update", "merch_rail", key)
    db.commit()
    rail = db.query(MerchRail).filter_by(key=key).first()
    return _rail_admin_out(db, rail)


@router.get("/content/reels", response_model=list[SocialReelOut])
def admin_list_reels(
    user: User = Depends(require_permission("content.write")),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(SocialReel)
        .options(joinedload(SocialReel.product))
        .order_by(SocialReel.sort_order.asc(), SocialReel.id.desc())
        .all()
    )
    return [_reel_to_out(r) for r in rows]


@router.post("/content/reels", response_model=SocialReelOut)
def admin_create_reel(
    body: SocialReelCreate,
    user: User = Depends(require_permission("content.write")),
    db: Session = Depends(get_db),
):
    if body.display_mode not in ("local_video", "instagram_embed"):
        raise HTTPException(400, "display_mode must be local_video or instagram_embed")
    handle = body.instagram_handle.strip().lstrip("@")
    if body.product_id and not db.query(Product).filter_by(id=body.product_id).first():
        raise HTTPException(400, "Product not found")
    row = SocialReel(
        instagram_handle=handle,
        permalink=body.permalink,
        caption=body.caption,
        display_mode=body.display_mode,
        thumbnail_url=body.thumbnail_url,
        video_url=body.video_url,
        product_id=body.product_id,
        source="manual",
        sort_order=body.sort_order,
        is_published=body.is_published,
    )
    db.add(row)
    db.flush()
    audit(db, user.id, "create", "social_reel", str(row.id))
    db.commit()
    row = (
        db.query(SocialReel)
        .options(joinedload(SocialReel.product))
        .filter_by(id=row.id)
        .first()
    )
    return _reel_to_out(row)


@router.patch("/content/reels/{reel_id}", response_model=SocialReelOut)
def admin_update_reel(
    reel_id: int,
    body: SocialReelUpdate,
    user: User = Depends(require_permission("content.write")),
    db: Session = Depends(get_db),
):
    row = db.query(SocialReel).filter_by(id=reel_id).first()
    if not row:
        raise HTTPException(404, "Reel not found")
    data = body.model_dump(exclude_unset=True)
    if "display_mode" in data and data["display_mode"] not in ("local_video", "instagram_embed"):
        raise HTTPException(400, "display_mode must be local_video or instagram_embed")
    if "instagram_handle" in data and data["instagram_handle"]:
        data["instagram_handle"] = data["instagram_handle"].strip().lstrip("@")
    if "product_id" in data and data["product_id"] is not None:
        if not db.query(Product).filter_by(id=data["product_id"]).first():
            raise HTTPException(400, "Product not found")
    for k, v in data.items():
        setattr(row, k, v)
    audit(db, user.id, "update", "social_reel", str(row.id))
    db.commit()
    row = (
        db.query(SocialReel)
        .options(joinedload(SocialReel.product))
        .filter_by(id=reel_id)
        .first()
    )
    return _reel_to_out(row)


@router.delete("/content/reels/{reel_id}")
def admin_delete_reel(
    reel_id: int,
    user: User = Depends(require_permission("content.write")),
    db: Session = Depends(get_db),
):
    row = db.query(SocialReel).filter_by(id=reel_id).first()
    if not row:
        raise HTTPException(404, "Reel not found")
    db.delete(row)
    audit(db, user.id, "delete", "social_reel", str(reel_id))
    db.commit()
    return {"ok": True}


@router.post("/content/reels/upload")
async def admin_upload_reel_media(
    file: UploadFile = File(...),
    user: User = Depends(require_permission("content.write")),
):
    from app.services.storage import save_public_media

    url = await save_public_media("reels", file, allow_video=True)
    return {"url": url}


@router.post("/content/reels/bulk-publish")
def admin_bulk_publish_reels(
    body: ReelBulkIdsRequest,
    user: User = Depends(require_permission("content.write")),
    db: Session = Depends(get_db),
):
    ids = body.reel_ids
    if not ids:
        raise HTTPException(400, "No reel ids provided")
    q = db.query(SocialReel).filter(SocialReel.id.in_(ids))
    n = 0
    for row in q.all():
        row.is_published = True
        n += 1
    audit(db, user.id, "bulk_publish", "social_reel", ",".join(map(str, ids)))
    db.commit()
    return {"published": n}


@router.get("/content/instagram/accounts", response_model=list[InstagramAccountOut])
def admin_instagram_accounts(
    user: User = Depends(require_permission("content.write")),
    db: Session = Depends(get_db),
):
    from app.services.instagram_sync import ensure_instagram_accounts

    rows = ensure_instagram_accounts(db)
    return [_ig_account_out(a) for a in rows]


@router.post("/content/instagram/sync", response_model=InstagramSyncResult)
def admin_instagram_sync(
    user: User = Depends(require_permission("content.write")),
    db: Session = Depends(get_db),
):
    from app.services.instagram_sync import sync_instagram_reels

    result = sync_instagram_reels(db)
    audit(db, user.id, "sync", "instagram", "reels", {"created": result["created"]})
    db.commit()
    return InstagramSyncResult(
        created=result["created"],
        updated=result["updated"],
        skipped=result["skipped"],
        errors=result["errors"],
        accounts=[_ig_account_out(a) for a in result["accounts"]],
    )


@router.get("/ai/config", response_model=AIConfigOut)
def ai_config(user: User = Depends(require_permission("ai.manage")), db: Session = Depends(get_db)):
    cfg = db.query(AIModelConfig).first()
    chunks = db.query(KnowledgeChunk).count()
    return AIConfigOut(
        fine_tuned_model_id=cfg.fine_tuned_model_id if cfg else settings.fine_tuned_model_id or None,
        base_model=cfg.base_model if cfg else settings.openai_chat_model,
        last_train_job_id=cfg.last_train_job_id if cfg else None,
        last_train_status=cfg.last_train_status if cfg else "idle",
        chunk_count=chunks,
    )


@router.post("/ai/reindex")
def ai_reindex(user: User = Depends(require_permission("ai.manage")), db: Session = Depends(get_db)):
    n = rebuild_knowledge_index(db)
    audit(db, user.id, "reindex", "knowledge", "all", {"chunks": n})
    db.commit()
    return {"ok": True, "chunks": n}


@router.post("/ai/chat-test", response_model=AIChatResponse)
async def ai_chat_test(
    body: AIChatRequest,
    user: User = Depends(require_permission("ai.manage")),
    db: Session = Depends(get_db),
):
    result = await generate_chat_reply(db, body.message)
    return AIChatResponse(**result)


@router.post("/ai/set-model")
def set_model(
    model_id: str = Query(...),
    user: User = Depends(require_permission("ai.manage")),
    db: Session = Depends(get_db),
):
    cfg = db.query(AIModelConfig).first()
    if not cfg:
        cfg = AIModelConfig()
        db.add(cfg)
    cfg.fine_tuned_model_id = model_id
    cfg.last_train_status = "active"
    db.commit()
    return {"ok": True, "fine_tuned_model_id": model_id}


@router.get("/me")
def admin_me(user: User = Depends(require_staff), db: Session = Depends(get_db)):
    return {
        "id": user.id,
        "email": user.email,
        "full_name": user.full_name,
        "role": user.role.name if user.role else None,
        "permissions": user_permissions(db, user),
    }


@router.get("/medicine-requests", response_model=list[MedicineRequestOut])
def admin_list_medicine_requests(
    status: Optional[str] = None,
    user: User = Depends(require_permission("medicine_requests.read")),
    db: Session = Depends(get_db),
):
    from app.api.v1.medicine_requests import _request_out

    q = (
        db.query(MedicineRequest)
        .options(
            joinedload(MedicineRequest.items).joinedload(MedicineRequestItem.matched_product),
            joinedload(MedicineRequest.order),
            joinedload(MedicineRequest.user),
        )
        .order_by(MedicineRequest.id.desc())
    )
    if status and status != "all":
        q = q.filter(MedicineRequest.status == status)
    return [_request_out(r, include_user=True) for r in q.all()]


@router.get("/medicine-requests/{request_id}", response_model=MedicineRequestOut)
def admin_get_medicine_request(
    request_id: int,
    user: User = Depends(require_permission("medicine_requests.read")),
    db: Session = Depends(get_db),
):
    from app.api.v1.medicine_requests import _load_request, _request_out

    req = _load_request(db, request_id)
    if not req:
        raise HTTPException(404, "Request not found")
    return _request_out(req, include_user=True)


@router.patch("/medicine-requests/{request_id}", response_model=MedicineRequestOut)
def admin_update_medicine_request(
    request_id: int,
    body: MedicineRequestAdminUpdate,
    user: User = Depends(require_permission("medicine_requests.write")),
    db: Session = Depends(get_db),
):
    from app.api.v1.medicine_requests import _load_request, _request_out
    from app.services.notifications import notify_user

    req = _load_request(db, request_id)
    if not req:
        raise HTTPException(404, "Request not found")

    action = (body.action or "").strip().lower()
    now = datetime.now(timezone.utc)

    if body.admin_notes is not None:
        req.admin_notes = body.admin_notes.strip() or None

    if action == "accept":
        if req.status != "submitted":
            raise HTTPException(400, "Only submitted requests can be accepted")
        req.status = "accepted"
        req.reviewed_by_id = user.id
        req.reviewed_at = now
        notify_user(
            db,
            user_id=req.user_id,
            title="Request accepted",
            body=f"{req.request_number} was accepted. We are sourcing your medicines.",
            notification_type="medicine_request",
            link_url=f"/account/medicine-requests/{req.id}",
        )
    elif action == "reject":
        if req.status not in {"submitted", "accepted"}:
            raise HTTPException(400, "Cannot reject in the current status")
        reason = (body.rejection_reason or "").strip()
        if not reason:
            raise HTTPException(400, "rejection_reason is required")
        req.status = "rejected"
        req.rejection_reason = reason
        req.reviewed_by_id = user.id
        req.reviewed_at = now
        notify_user(
            db,
            user_id=req.user_id,
            title="Request could not be fulfilled",
            body=f"{req.request_number}: {reason}",
            notification_type="medicine_request",
            link_url=f"/account/medicine-requests/{req.id}",
        )
    elif action == "mark_available":
        if req.status not in {"accepted", "available"}:
            raise HTTPException(400, "Accept the request before marking available")
        matches = body.item_matches or []
        if not matches:
            raise HTTPException(400, "Match each line item to a product")
        by_id = {i.id: i for i in req.items}
        for m in matches:
            item = by_id.get(m.item_id)
            if not item:
                raise HTTPException(400, f"Unknown item_id {m.item_id}")
            product = db.query(Product).filter(Product.id == m.matched_product_id).first()
            if not product:
                raise HTTPException(400, f"Product {m.matched_product_id} not found")
            item.matched_product_id = product.id
            item.unit_price_snapshot = product.mrp if product.mrp and product.mrp > 0 else product.price
        unmatched = [i for i in req.items if not i.matched_product_id]
        if unmatched:
            raise HTTPException(400, "All line items must be matched to products")
        req.status = "available"
        req.available_at = now
        notify_user(
            db,
            user_id=req.user_id,
            title="Your medicines are available",
            body=(
                f"{req.request_number} is ready. Choose Visit store or Delivery "
                "from your Medicine requests page."
            ),
            notification_type="medicine_request",
            link_url=f"/account/medicine-requests/{req.id}",
        )
    elif action == "mark_picked_up":
        if req.status != "awaiting_pickup":
            raise HTTPException(400, "Request is not awaiting pickup")
        req.status = "completed"
        notify_user(
            db,
            user_id=req.user_id,
            title="Pickup completed",
            body=f"{req.request_number} was marked as collected. Thank you for visiting Interelia.",
            notification_type="medicine_request",
            link_url=f"/account/medicine-requests/{req.id}",
        )
    elif action == "complete":
        if req.status not in {"ordered", "awaiting_pickup", "available"}:
            raise HTTPException(400, "Cannot complete in the current status")
        req.status = "completed"
    elif action == "cancel":
        if req.status in {"completed", "ordered"}:
            raise HTTPException(400, "Cannot cancel a completed or ordered request")
        req.status = "cancelled"
    else:
        raise HTTPException(400, f"Unknown action: {action}")

    audit(db, user.id, action, "medicine_request", str(req.id), {"status": req.status})
    db.commit()
    loaded = _load_request(db, req.id)
    assert loaded
    return _request_out(loaded, include_user=True)
