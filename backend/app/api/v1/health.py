"""Public content — blogs, FAQs, banners, rails, reels, quick-view."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from app.db.session import get_db
from app.models import AdBanner, BlogPost, Expert, FAQ, MerchRail, Product, SocialReel
from app.schemas import (
    AdBannerOut,
    BlogOut,
    ExpertOut,
    FAQOut,
    MerchRailOut,
    ProductQuickViewOut,
    SocialReelOut,
)
from app.services.merchandising import (
    ensure_default_rails,
    product_snippet,
    products_to_out,
    related_products,
    resolve_rail_products,
)
from app.services.serializers import product_to_out

router = APIRouter()


def blog_to_out(b: BlogPost) -> BlogOut:
    tags = []
    if b.tags_json:
        try:
            tags = json.loads(b.tags_json)
        except json.JSONDecodeError:
            tags = []
    return BlogOut(
        id=b.id,
        title=b.title,
        slug=b.slug,
        excerpt=b.excerpt,
        content=b.content,
        category=b.category,
        tags=tags,
        author_name=b.author_name,
        author_role=b.author_role,
        reading_time=b.reading_time,
        image_url=b.image_url,
        published_at=b.published_at,
        featured=b.featured,
    )


def reel_to_out(r: SocialReel) -> SocialReelOut:
    return SocialReelOut(
        id=r.id,
        instagram_handle=r.instagram_handle,
        permalink=r.permalink,
        caption=r.caption,
        display_mode=r.display_mode,
        thumbnail_url=r.thumbnail_url,
        video_url=r.video_url,
        product_id=r.product_id,
        product=product_snippet(r.product if r.product_id else None),
        external_media_id=r.external_media_id,
        source=r.source,
        sort_order=r.sort_order,
        is_published=r.is_published,
        created_at=r.created_at,
    )


def banner_to_out(b: AdBanner) -> AdBannerOut:
    return AdBannerOut(
        id=b.id,
        title=b.title,
        alt_text=b.alt_text,
        image_url=b.image_url,
        link_url=b.link_url or "/shop",
        cta_label=b.cta_label,
        placement=b.placement,
        banner_kind=getattr(b, "banner_kind", None) or "promo",
        target_type=getattr(b, "target_type", None) or "url",
        product_id=getattr(b, "product_id", None),
        category_slug=getattr(b, "category_slug", None),
        brand_slug=getattr(b, "brand_slug", None),
        badge_text=getattr(b, "badge_text", None),
        product=product_snippet(b.product) if getattr(b, "product_id", None) else None,
        sort_order=b.sort_order,
        is_active=b.is_active,
        starts_at=b.starts_at,
        ends_at=b.ends_at,
        created_at=b.created_at,
    )


@router.get("/blogs", response_model=List[BlogOut])
def list_blogs(category: Optional[str] = None, db: Session = Depends(get_db)):
    q = db.query(BlogPost).filter(BlogPost.is_published.is_(True))
    if category:
        q = q.filter(BlogPost.category == category)
    return [blog_to_out(b) for b in q.order_by(BlogPost.published_at.desc()).all()]


@router.get("/blogs/{slug}", response_model=BlogOut)
def get_blog(slug: str, db: Session = Depends(get_db)):
    b = db.query(BlogPost).filter(BlogPost.slug == slug, BlogPost.is_published.is_(True)).first()
    if not b:
        raise HTTPException(status_code=404, detail="Article not found")
    return blog_to_out(b)


@router.get("/faqs", response_model=List[FAQOut])
def list_faqs(db: Session = Depends(get_db)):
    return [
        FAQOut(id=f.id, question=f.question, answer=f.answer, category=f.category)
        for f in db.query(FAQ).order_by(FAQ.sort_order).all()
    ]


@router.get("/experts", response_model=List[ExpertOut])
def list_experts(
    featured: Optional[bool] = Query(None),
    specialty: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    from app.services.experts import expert_to_out

    q = db.query(Expert).filter(Expert.is_active.is_(True))
    if featured is True:
        q = q.filter(Expert.is_featured.is_(True))
    if specialty:
        q = q.filter(Expert.specialty == specialty)
    rows = q.order_by(Expert.sort_order.asc(), Expert.id.asc()).all()
    return [expert_to_out(e) for e in rows]


@router.get("/experts/{slug}", response_model=ExpertOut)
def get_expert(slug: str, db: Session = Depends(get_db)):
    from app.services.experts import expert_to_out

    e = db.query(Expert).filter(Expert.slug == slug, Expert.is_active.is_(True)).first()
    if not e:
        raise HTTPException(status_code=404, detail="Expert not found")
    return expert_to_out(e)


def _as_utc(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


@router.get("/banners", response_model=List[AdBannerOut])
def list_banners(
    placement: str = Query("home_promo"),
    db: Session = Depends(get_db),
):
    now = datetime.now(timezone.utc)
    rows = (
        db.query(AdBanner)
        .options(joinedload(AdBanner.product))
        .filter(AdBanner.is_active.is_(True), AdBanner.placement == placement)
        .order_by(AdBanner.sort_order.asc(), AdBanner.id.desc())
        .all()
    )
    out: list[AdBannerOut] = []
    for b in rows:
        starts = _as_utc(b.starts_at)
        ends = _as_utc(b.ends_at)
        if starts and starts > now:
            continue
        if ends and ends < now:
            continue
        out.append(banner_to_out(b))
    return out


@router.get("/reels", response_model=List[SocialReelOut])
def list_reels(db: Session = Depends(get_db)):
    rows = (
        db.query(SocialReel)
        .options(joinedload(SocialReel.product))
        .filter(SocialReel.is_published.is_(True))
        .order_by(SocialReel.sort_order.asc(), SocialReel.id.desc())
        .all()
    )
    return [reel_to_out(r) for r in rows]


@router.get("/rails/{key}", response_model=MerchRailOut)
def get_rail(key: str, db: Session = Depends(get_db)):
    ensure_default_rails(db)
    rail = db.query(MerchRail).filter_by(key=key).first()
    if not rail or not rail.is_enabled:
        raise HTTPException(404, "Rail not found")
    products = resolve_rail_products(db, rail)
    return MerchRailOut(
        id=rail.id,
        key=rail.key,
        title=rail.title,
        subtitle=rail.subtitle,
        is_enabled=rail.is_enabled,
        source_mode=rail.source_mode,
        limit=rail.limit,
        sort_order=rail.sort_order,
        product_ids=[p.id for p in products],
        items=products_to_out(products),
    )


@router.get("/products/{product_id}/quick-view", response_model=ProductQuickViewOut)
def product_quick_view(product_id: int, db: Session = Depends(get_db)):
    # Allow inactive products so CMS-linked reels/banners still open a preview
    # (storefront ATC/PDP may still treat them as unavailable via is_active / stock).
    p = (
        db.query(Product)
        .options(joinedload(Product.category), joinedload(Product.brand))
        .filter(Product.id == product_id)
        .first()
    )
    if not p:
        raise HTTPException(404, "Product not found")
    related = related_products(db, p, limit=8)
    return ProductQuickViewOut(product=product_to_out(p), related=products_to_out(related))
