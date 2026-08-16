"""SQLAlchemy session — SQLite or PostgreSQL."""

from __future__ import annotations

from collections.abc import Generator

from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import settings


class Base(DeclarativeBase):
    pass


connect_args = {}
if settings.database_url.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

engine = create_engine(settings.database_url, pool_pre_ping=True, connect_args=connect_args)

if settings.database_url.startswith("sqlite"):

    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_connection, _connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()


SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    """Create tables from ORM models and apply lightweight additive migrations."""
    import app.models  # noqa: F401

    Base.metadata.create_all(bind=engine)
    _ensure_sqlite_columns()
    _backfill_brand_slugs()
    _ensure_permissions()
    _ensure_default_experts()
    _ensure_default_hero_banners()


def _ensure_default_hero_banners() -> None:
    """Seed homepage hero trust slides; refresh stock Unsplash URLs to local trust photos."""
    from app.data.hero_banners_seed import DEFAULT_HERO_BANNERS
    from app.models import AdBanner

    db = SessionLocal()
    try:
        rows = db.query(AdBanner).filter(AdBanner.placement == "home_hero").all()
        if not rows:
            for row in DEFAULT_HERO_BANNERS:
                db.add(AdBanner(**row))
            db.commit()
            return

        by_title = {b["title"]: b for b in DEFAULT_HERO_BANNERS}
        changed = False
        for row in rows:
            seed = by_title.get(row.title)
            # Also migrate previous third-slide title
            if seed is None and row.title == "Feel better. Live well.":
                seed = by_title.get("Medicine you can trust")
                if seed:
                    row.title = seed["title"]
                    row.alt_text = seed["alt_text"]
                    row.badge_text = seed["badge_text"]
                    row.cta_label = seed["cta_label"]
                    row.link_url = seed["link_url"]
                    changed = True
            if not seed:
                continue
            url = row.image_url or ""
            if (
                "images.unsplash.com" in url
                or url.startswith("/images/hero/")
                or not url
            ):
                if row.image_url != seed["image_url"]:
                    row.image_url = seed["image_url"]
                    row.alt_text = seed.get("alt_text") or row.alt_text
                    changed = True
        if changed:
            db.commit()
    finally:
        db.close()


def _ensure_default_experts() -> None:
    """Seed Expert Corner profiles once so the storefront is never empty."""
    from app.data.experts_seed import DEFAULT_EXPERTS
    from app.models import Expert

    db = SessionLocal()
    try:
        if db.query(Expert).count() > 0:
            return
        for row in DEFAULT_EXPERTS:
            db.add(Expert(**row, is_active=True))
        db.commit()
    finally:
        db.close()


def _ensure_permissions() -> None:
    """Upsert seeded permissions/role maps so new features work without a full re-seed."""
    from app.data.seed_catalog import PERMISSIONS, ROLE_PERMS
    from app.models import Permission, Role, RolePermission

    db = SessionLocal()
    try:
        perm_map = {}
        for code, desc in PERMISSIONS:
            p = db.query(Permission).filter_by(code=code).first()
            if not p:
                p = Permission(code=code, description=desc)
                db.add(p)
                db.flush()
            perm_map[code] = p
        for role_name, codes in ROLE_PERMS.items():
            role = db.query(Role).filter_by(name=role_name).first()
            if not role:
                continue
            for code in codes:
                p = perm_map.get(code)
                if not p:
                    continue
                exists = (
                    db.query(RolePermission)
                    .filter_by(role_id=role.id, permission_id=p.id)
                    .first()
                )
                if not exists:
                    db.add(RolePermission(role_id=role.id, permission_id=p.id))
        db.commit()
    finally:
        db.close()


def _ensure_sqlite_columns() -> None:
    """Add new columns on existing SQLite DBs without full Alembic for local/dev."""
    if not settings.database_url.startswith("sqlite"):
        return
    from sqlalchemy import text

    alters = [
        ("orders", "payment_method", "ALTER TABLE orders ADD COLUMN payment_method VARCHAR(32) DEFAULT 'cod'"),
        ("orders", "prescription_id", "ALTER TABLE orders ADD COLUMN prescription_id INTEGER"),
        ("orders", "distance_km", "ALTER TABLE orders ADD COLUMN distance_km NUMERIC(8,2)"),
        ("orders", "delivery_eta_minutes", "ALTER TABLE orders ADD COLUMN delivery_eta_minutes INTEGER"),
        ("products", "sku", "ALTER TABLE products ADD COLUMN sku VARCHAR(120)"),
        ("products", "rack", "ALTER TABLE products ADD COLUMN rack VARCHAR(64)"),
        ("products", "supplier_name", "ALTER TABLE products ADD COLUMN supplier_name VARCHAR(255)"),
        ("products", "current_strip_qty", "ALTER TABLE products ADD COLUMN current_strip_qty INTEGER DEFAULT 0"),
        ("products", "current_loose_qty", "ALTER TABLE products ADD COLUMN current_loose_qty INTEGER DEFAULT 0"),
        ("products", "b2c_strip_qty", "ALTER TABLE products ADD COLUMN b2c_strip_qty INTEGER DEFAULT 0"),
        ("products", "b2c_loose_qty", "ALTER TABLE products ADD COLUMN b2c_loose_qty INTEGER DEFAULT 0"),
        ("products", "b2c_sale_qty", "ALTER TABLE products ADD COLUMN b2c_sale_qty INTEGER DEFAULT 0"),
        ("products", "b2b_sale_qty", "ALTER TABLE products ADD COLUMN b2b_sale_qty INTEGER DEFAULT 0"),
        ("products", "stk_transfer_qty", "ALTER TABLE products ADD COLUMN stk_transfer_qty INTEGER DEFAULT 0"),
        ("products", "total_strip_qty", "ALTER TABLE products ADD COLUMN total_strip_qty INTEGER DEFAULT 0"),
        ("products", "total_loose_qty", "ALTER TABLE products ADD COLUMN total_loose_qty INTEGER DEFAULT 0"),
        ("products", "total_sale_qty", "ALTER TABLE products ADD COLUMN total_sale_qty INTEGER DEFAULT 0"),
        ("products", "purchase_qty", "ALTER TABLE products ADD COLUMN purchase_qty VARCHAR(64)"),
        ("products", "purchase_margin_pct", "ALTER TABLE products ADD COLUMN purchase_margin_pct NUMERIC(8,2) DEFAULT 0"),
        ("crm_customers", "external_id", "ALTER TABLE crm_customers ADD COLUMN external_id VARCHAR(120)"),
        ("crm_customers", "company", "ALTER TABLE crm_customers ADD COLUMN company VARCHAR(150)"),
        ("crm_customers", "state", "ALTER TABLE crm_customers ADD COLUMN state VARCHAR(100)"),
        ("crm_customers", "pincode", "ALTER TABLE crm_customers ADD COLUMN pincode VARCHAR(20)"),
        ("crm_customers", "tags", "ALTER TABLE crm_customers ADD COLUMN tags VARCHAR(500)"),
        ("crm_customers", "last_notified_at", "ALTER TABLE crm_customers ADD COLUMN last_notified_at DATETIME"),
        ("crm_customers", "discount_pct", "ALTER TABLE crm_customers ADD COLUMN discount_pct NUMERIC(8,2) DEFAULT 0"),
        ("crm_customers", "profile_name", "ALTER TABLE crm_customers ADD COLUMN profile_name VARCHAR(120)"),
        ("crm_customers", "doctor_name", "ALTER TABLE crm_customers ADD COLUMN doctor_name VARCHAR(150)"),
        ("crm_customers", "family_name", "ALTER TABLE crm_customers ADD COLUMN family_name VARCHAR(150)"),
        ("crm_customers", "payment_mode", "ALTER TABLE crm_customers ADD COLUMN payment_mode VARCHAR(64)"),
        ("crm_customers", "vouchers", "ALTER TABLE crm_customers ADD COLUMN vouchers INTEGER DEFAULT 0"),
        ("crm_customers", "bills_count", "ALTER TABLE crm_customers ADD COLUMN bills_count INTEGER DEFAULT 0"),
        ("crm_customers", "last_billed_on", "ALTER TABLE crm_customers ADD COLUMN last_billed_on VARCHAR(64)"),
        ("crm_customers", "net_total_amount", "ALTER TABLE crm_customers ADD COLUMN net_total_amount NUMERIC(12,2) DEFAULT 0"),
        ("crm_customers", "total_due_amount", "ALTER TABLE crm_customers ADD COLUMN total_due_amount NUMERIC(12,2) DEFAULT 0"),
        ("ad_banners", "banner_kind", "ALTER TABLE ad_banners ADD COLUMN banner_kind VARCHAR(32) DEFAULT 'promo'"),
        ("ad_banners", "target_type", "ALTER TABLE ad_banners ADD COLUMN target_type VARCHAR(32) DEFAULT 'url'"),
        ("ad_banners", "product_id", "ALTER TABLE ad_banners ADD COLUMN product_id INTEGER"),
        ("ad_banners", "category_slug", "ALTER TABLE ad_banners ADD COLUMN category_slug VARCHAR(120)"),
        ("ad_banners", "brand_slug", "ALTER TABLE ad_banners ADD COLUMN brand_slug VARCHAR(120)"),
        ("ad_banners", "badge_text", "ALTER TABLE ad_banners ADD COLUMN badge_text VARCHAR(64)"),
        ("brands", "slug", "ALTER TABLE brands ADD COLUMN slug VARCHAR(120) DEFAULT ''"),
        ("brands", "tagline", "ALTER TABLE brands ADD COLUMN tagline VARCHAR(255)"),
        ("brands", "description", "ALTER TABLE brands ADD COLUMN description TEXT"),
        ("brands", "logo_url", "ALTER TABLE brands ADD COLUMN logo_url VARCHAR(1000)"),
        ("brands", "cover_image_url", "ALTER TABLE brands ADD COLUMN cover_image_url VARCHAR(1000)"),
        ("brands", "is_featured", "ALTER TABLE brands ADD COLUMN is_featured BOOLEAN DEFAULT 0"),
        ("brands", "sort_order", "ALTER TABLE brands ADD COLUMN sort_order INTEGER DEFAULT 0"),
        ("brands", "is_partner", "ALTER TABLE brands ADD COLUMN is_partner BOOLEAN DEFAULT 1"),
        ("brands", "is_active", "ALTER TABLE brands ADD COLUMN is_active BOOLEAN DEFAULT 1"),
        ("brands", "website_url", "ALTER TABLE brands ADD COLUMN website_url VARCHAR(1000)"),
    ]
    with engine.begin() as conn:
        for table, column, ddl in alters:
            rows = conn.execute(text(f"PRAGMA table_info({table})")).fetchall()
            names = {r[1] for r in rows}
            if column not in names:
                conn.execute(text(ddl))


def _backfill_brand_slugs() -> None:
    """Ensure every brand has a unique slug after additive migrations."""
    from app.models import Brand
    from app.services.serializers import slugify

    db = SessionLocal()
    try:
        brands = db.query(Brand).all()
        used = {b.slug for b in brands if b.slug}
        changed = False
        for b in brands:
            if b.slug:
                continue
            base = slugify(b.name)
            slug = base
            n = 2
            while slug in used:
                slug = f"{base}-{n}"
                n += 1
            b.slug = slug
            used.add(slug)
            changed = True
        if changed:
            db.commit()
    finally:
        db.close()
