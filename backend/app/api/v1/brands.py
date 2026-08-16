"""Public brand directory & hubs."""

from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from app.db.session import get_db
from app.models import Brand, Product
from app.schemas import BrandDetailOut, BrandOut
from app.services.serializers import brand_to_out, product_to_out

router = APIRouter()


@router.get("", response_model=List[BrandOut])
def list_brands(
    featured: Optional[bool] = None,
    all: bool = Query(False, description="Include every manufacturer (stock import)"),
    db: Session = Depends(get_db),
):
    query = db.query(Brand).filter(Brand.is_active.is_(True))
    if featured is True:
        query = query.filter(Brand.is_featured.is_(True))
    elif not all:
        # Curated hubs only — not raw ITEMWISE manufacturer names
        query = query.filter(
            or_(
                Brand.is_featured.is_(True),
                Brand.tagline.isnot(None),
                Brand.description.isnot(None),
            )
        )
    brands = query.order_by(Brand.sort_order.asc(), Brand.name.asc()).all()
    out: List[BrandOut] = []
    for b in brands:
        count = (
            db.query(Product)
            .filter(Product.brand_id == b.id, Product.is_active.is_(True))
            .count()
        )
        out.append(brand_to_out(b, product_count=count))
    return out


@router.get("/{slug}", response_model=BrandDetailOut)
def get_brand(
    slug: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(24, ge=1, le=100),
    db: Session = Depends(get_db),
):
    brand = db.query(Brand).filter(Brand.slug == slug, Brand.is_active.is_(True)).first()
    if not brand:
        raise HTTPException(status_code=404, detail="Brand not found")
    pq = (
        db.query(Product)
        .options(joinedload(Product.category), joinedload(Product.brand))
        .filter(Product.brand_id == brand.id, Product.is_active.is_(True))
    )
    total = pq.count()
    items = (
        pq.order_by(Product.review_count.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    base = brand_to_out(brand, product_count=total)
    return BrandDetailOut(
        **base.model_dump(),
        products=[product_to_out(p) for p in items],
        total=total,
        page=page,
        page_size=page_size,
    )
