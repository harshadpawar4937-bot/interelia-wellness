"""Database seed — roles, admin, categories, featured partner brands & products."""

from __future__ import annotations

import json
import sys
from decimal import Decimal
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.core.security import hash_password  # noqa: E402
from app.data.partner_brands_seed import (  # noqa: E402
    FEATURED_BRAND_PRODUCTS,
    FEATURED_BRANDS,
    LEGACY_BRAND_SLUGS,
)
from app.data.seed_catalog import PERMISSIONS, ROLE_PERMS  # noqa: E402
from app.db.session import SessionLocal, init_db  # noqa: E402
from app.models import (  # noqa: E402
    AIModelConfig,
    Brand,
    Category,
    Permission,
    Product,
    Role,
    RolePermission,
    User,
)


def seed() -> None:
    init_db()
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

        role_map = {}
        for name, desc in [
            ("super_admin", "Full platform access"),
            ("pharmacist", "Prescription verification"),
            ("content_manager", "Content CMS"),
            ("support_agent", "Support"),
            ("customer", "Customer"),
        ]:
            r = db.query(Role).filter_by(name=name).first()
            if not r:
                r = Role(name=name, description=desc)
                db.add(r)
                db.flush()
            role_map[name] = r

        for role_name, codes in ROLE_PERMS.items():
            role = role_map[role_name]
            for code in codes:
                if code not in perm_map:
                    continue
                exists = (
                    db.query(RolePermission)
                    .filter_by(role_id=role.id, permission_id=perm_map[code].id)
                    .first()
                )
                if not exists:
                    db.add(RolePermission(role_id=role.id, permission_id=perm_map[code].id))

        admin = db.query(User).filter_by(email="admin@interelia.com").first()
        if not admin:
            db.add(
                User(
                    email="admin@interelia.com",
                    full_name="Interelia Admin",
                    phone="+91 90000 00001",
                    hashed_password=hash_password("Admin@123"),
                    role_id=role_map["super_admin"].id,
                    rewards_points=0,
                )
            )
        else:
            admin.role_id = role_map["super_admin"].id
            admin.full_name = "Interelia Admin"

        for name, slug in [
            ("Medicines", "medicines"),
            ("Medicine", "medicine"),
            ("Nutrition", "nutrition"),
            ("Wellness", "wellness"),
            ("Personal Care", "personal-care"),
            ("Ayurveda", "ayurveda"),
            ("Medical Devices", "medical-devices"),
            ("Diabetes Care", "diabetes-care"),
            ("Heart Health", "heart-health"),
            ("Immunity", "immunity"),
            ("Senior Care", "senior-care"),
        ]:
            if not db.query(Category).filter_by(slug=slug).first():
                db.add(Category(name=name, slug=slug, description=None))

        if not db.query(AIModelConfig).first():
            db.add(AIModelConfig(base_model="gpt-4o-mini", last_train_status="idle"))

        db.flush()

        # Hide legacy demo hubs (wrong brand names from first seed)
        for slug in LEGACY_BRAND_SLUGS:
            legacy = db.query(Brand).filter_by(slug=slug).first()
            if legacy:
                legacy.is_active = False
                legacy.is_featured = False
                for p in db.query(Product).filter_by(brand_id=legacy.id).all():
                    p.is_active = False

        brand_by_name: dict[str, Brand] = {}
        for row in FEATURED_BRANDS:
            brand = db.query(Brand).filter_by(slug=row["slug"]).first()
            if not brand:
                brand = db.query(Brand).filter_by(name=row["name"]).first()
            if not brand:
                brand = Brand(name=row["name"], slug=row["slug"])
                db.add(brand)
                db.flush()
            brand.name = row["name"]
            brand.slug = row["slug"]
            brand.tagline = row.get("tagline")
            brand.description = row.get("description")
            brand.logo_url = row.get("logo_url")
            brand.cover_image_url = row.get("cover_image_url")
            brand.website_url = row.get("website_url")
            brand.is_featured = bool(row.get("is_featured", True))
            brand.is_partner = bool(row.get("is_partner", True))
            brand.sort_order = int(row.get("sort_order", 0))
            brand.is_active = True
            brand_by_name[brand.name] = brand

        db.flush()

        keep_slugs = {row["slug"] for row in FEATURED_BRAND_PRODUCTS}
        # Deactivate previous demo SKUs not in the new catalog
        for old_prefix in ("hw-", "ins-", "mel-"):
            for p in db.query(Product).filter(Product.slug.like(f"{old_prefix}%")).all():
                if p.slug not in keep_slugs:
                    p.is_active = False

        created = 0
        updated = 0
        for row in FEATURED_BRAND_PRODUCTS:
            cat = db.query(Category).filter_by(slug=row["category"]).first()
            if not cat:
                cat = Category(name=row["category"].replace("-", " ").title(), slug=row["category"])
                db.add(cat)
                db.flush()
            brand = brand_by_name.get(row["brand"])
            if not brand:
                brand = db.query(Brand).filter_by(name=row["brand"]).first()
            if not brand:
                continue
            p = db.query(Product).filter_by(slug=row["slug"]).first()
            fields = dict(
                name=row["name"],
                description=row.get("description"),
                price=Decimal(str(row["price"])),
                mrp=Decimal(str(row["mrp"])),
                stock_qty=int(row.get("stock_qty", 0)),
                pack_size=row.get("pack_size"),
                ingredients=row.get("ingredients"),
                usage_text=row.get("usage_text"),
                warnings=row.get("warnings"),
                storage_text=row.get("storage_text"),
                benefits_json=json.dumps(row.get("benefits") or []),
                image_url=row.get("image_url"),
                rating=Decimal(str(row.get("rating", 0))),
                review_count=int(row.get("review_count", 0)),
                meta_title=row["name"],
                category_id=cat.id,
                brand_id=brand.id,
                is_active=True,
            )
            if not p:
                db.add(Product(slug=row["slug"], **fields))
                created += 1
            else:
                for k, v in fields.items():
                    setattr(p, k, v)
                updated += 1

        db.commit()
        print("Seed complete — AccuSure, Dr. Morepen, Fitness & Wellness, Melatonin.")
        print(f"Brands: {len(FEATURED_BRANDS)}, products created: {created}, updated: {updated}")
        print("Admin login: admin@interelia.com / Admin@123")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
