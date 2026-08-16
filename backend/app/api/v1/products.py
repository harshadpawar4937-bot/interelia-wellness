"""Public product catalog."""

from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from app.db.session import get_db
from app.models import Brand, Category, Product
from app.schemas import CategoryOut, ProductListResponse, ProductOut
from app.services.serializers import product_to_out

router = APIRouter()


@router.get("/categories", response_model=List[CategoryOut])
def list_categories(db: Session = Depends(get_db)):
    cats = db.query(Category).all()
    out = []
    for c in cats:
        count = db.query(Product).filter(Product.category_id == c.id, Product.is_active.is_(True)).count()
        out.append(
            CategoryOut(id=c.id, name=c.name, slug=c.slug, description=c.description, product_count=count)
        )
    return out


@router.get("", response_model=ProductListResponse)
def list_products(
    q: Optional[str] = None,
    category: Optional[str] = None,
    brand: Optional[str] = None,
    brand_slug: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    query = (
        db.query(Product)
        .options(joinedload(Product.category), joinedload(Product.brand))
        .filter(Product.is_active.is_(True))
    )
    if q:
        like = f"%{q}%"
        from sqlalchemy import or_
        query = query.filter(or_(Product.name.ilike(like), Product.description.ilike(like)))
    if category:
        query = query.join(Category).filter(Category.slug == category)
    if brand_slug:
        query = query.join(Brand).filter(Brand.slug == brand_slug)
    elif brand:
        query = query.join(Brand).filter(Brand.name == brand)
    total = query.count()
    items = query.order_by(Product.review_count.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return ProductListResponse(
        items=[product_to_out(p) for p in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/{slug}", response_model=ProductOut)
def get_product(slug: str, db: Session = Depends(get_db)):
    p = (
        db.query(Product)
        .options(joinedload(Product.category), joinedload(Product.brand))
        .filter(Product.slug == slug, Product.is_active.is_(True))
        .first()
    )
    if not p:
        raise HTTPException(status_code=404, detail="Product not found")
    return product_to_out(p)
