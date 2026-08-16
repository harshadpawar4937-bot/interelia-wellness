"""Serialize ORM product/brand to API shape."""

from __future__ import annotations

import json
import re
from decimal import Decimal
from typing import List, Optional

from app.models import Brand, Product
from app.schemas import BrandOut, ProductOut


def slugify(value: str) -> str:
    text = (value or "").strip().lower()
    text = re.sub(r"[^a-z0-9]+", "-", text)
    text = re.sub(r"-+", "-", text).strip("-")
    return text[:120] or "brand"


def brand_to_out(b: Brand, product_count: Optional[int] = None) -> BrandOut:
    count = product_count
    if count is None:
        count = len(b.products) if b.products is not None else 0
    return BrandOut(
        id=b.id,
        name=b.name,
        slug=b.slug or slugify(b.name),
        tagline=b.tagline,
        description=b.description,
        logo_url=b.logo_url,
        cover_image_url=b.cover_image_url,
        is_featured=bool(b.is_featured),
        sort_order=b.sort_order or 0,
        is_partner=bool(getattr(b, "is_partner", True)),
        is_active=bool(getattr(b, "is_active", True)),
        website_url=b.website_url,
        product_count=count,
    )


def product_to_out(p: Product) -> ProductOut:
    benefits: List[str] = []
    if p.benefits_json:
        try:
            benefits = json.loads(p.benefits_json)
        except json.JSONDecodeError:
            benefits = []
    return ProductOut(
        id=p.id,
        sku=p.sku,
        name=p.name,
        slug=p.slug,
        description=p.description,
        price=p.price,
        mrp=p.mrp,
        stock_qty=p.stock_qty,
        current_strip_qty=getattr(p, "current_strip_qty", 0) or 0,
        current_loose_qty=getattr(p, "current_loose_qty", 0) or 0,
        b2c_strip_qty=getattr(p, "b2c_strip_qty", 0) or 0,
        b2c_loose_qty=getattr(p, "b2c_loose_qty", 0) or 0,
        b2c_sale_qty=getattr(p, "b2c_sale_qty", 0) or 0,
        b2b_sale_qty=getattr(p, "b2b_sale_qty", 0) or 0,
        stk_transfer_qty=getattr(p, "stk_transfer_qty", 0) or 0,
        total_strip_qty=getattr(p, "total_strip_qty", 0) or 0,
        total_loose_qty=getattr(p, "total_loose_qty", 0) or 0,
        total_sale_qty=getattr(p, "total_sale_qty", 0) or 0,
        purchase_qty=getattr(p, "purchase_qty", None),
        purchase_margin_pct=getattr(p, "purchase_margin_pct", None) or Decimal("0"),
        requires_prescription=p.requires_prescription,
        pack_size=p.pack_size,
        rack=getattr(p, "rack", None),
        supplier_name=getattr(p, "supplier_name", None),
        ingredients=p.ingredients,
        usage_text=p.usage_text,
        warnings=p.warnings,
        storage_text=p.storage_text,
        benefits=benefits,
        image_url=p.image_url,
        rating=p.rating or 0,
        review_count=p.review_count or 0,
        category=p.category.name if p.category else None,
        brand=p.brand.name if p.brand else None,
        brand_slug=(
            p.brand.slug
            if p.brand and p.brand.slug
            else (slugify(p.brand.name) if p.brand else None)
        ),
        meta_title=p.meta_title,
        meta_description=p.meta_description,
        is_active=p.is_active,
        in_stock=p.stock_qty > 0,
    )
