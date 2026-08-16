"""Homepage merchandising helpers — banners, rails, quick-view."""

from __future__ import annotations

from sqlalchemy import desc
from sqlalchemy.orm import Session, joinedload

from app.models import MerchRail, MerchRailItem, Product
from app.schemas import ReelProductSnippet
from app.services.serializers import product_to_out

DEFAULT_RAILS = (
    ("latest", "Latest arrivals", "New & upcoming care essentials", 0),
    ("trending", "Trending near you", "Most loved picks from Interelia", 1),
)


def ensure_default_rails(db: Session) -> list[MerchRail]:
    rows: list[MerchRail] = []
    for key, title, subtitle, sort_order in DEFAULT_RAILS:
        row = db.query(MerchRail).filter_by(key=key).first()
        if not row:
            row = MerchRail(
                key=key,
                title=title,
                subtitle=subtitle,
                is_enabled=True,
                source_mode="auto",
                limit=8,
                sort_order=sort_order,
            )
            db.add(row)
            db.flush()
        rows.append(row)
    db.commit()
    return rows


def product_snippet(p: Product | None) -> ReelProductSnippet | None:
    if not p:
        return None
    return ReelProductSnippet(
        id=p.id,
        slug=p.slug,
        name=p.name,
        price=p.price,
        mrp=p.mrp,
        image_url=p.image_url,
        in_stock=bool(p.stock_qty and p.stock_qty > 0),
        requires_prescription=bool(p.requires_prescription),
    )


def resolve_rail_products(db: Session, rail: MerchRail) -> list[Product]:
    limit = max(1, min(rail.limit or 8, 24))
    if rail.source_mode == "manual":
        items = (
            db.query(MerchRailItem)
            .options(
                joinedload(MerchRailItem.product).joinedload(Product.category),
                joinedload(MerchRailItem.product).joinedload(Product.brand),
            )
            .filter(MerchRailItem.rail_id == rail.id)
            .order_by(MerchRailItem.sort_order.asc(), MerchRailItem.id.asc())
            .all()
        )
        return [i.product for i in items if i.product and i.product.is_active][:limit]

    q = (
        db.query(Product)
        .options(joinedload(Product.category), joinedload(Product.brand))
        .filter(Product.is_active.is_(True), Product.stock_qty > 0)
    )
    if rail.key == "trending":
        q = q.order_by(
            desc(Product.review_count),
            desc(Product.total_sale_qty),
            desc(Product.b2c_sale_qty),
            desc(Product.id),
        )
    else:
        # latest
        q = q.order_by(desc(Product.id))
    return q.limit(limit).all()


def related_products(db: Session, product: Product, *, limit: int = 8) -> list[Product]:
    """Category-first related products, then name keyword fallback."""
    q = (
        db.query(Product)
        .options(joinedload(Product.category), joinedload(Product.brand))
        .filter(
            Product.is_active.is_(True),
            Product.stock_qty > 0,
            Product.id != product.id,
        )
    )
    rows = []
    if product.category_id:
        rows = (
            q.filter(Product.category_id == product.category_id)
            .order_by(desc(Product.review_count), desc(Product.id))
            .limit(limit)
            .all()
        )
    if len(rows) < limit:
        token = (product.name or "").split()[0] if product.name else ""
        if token and len(token) > 2:
            more = (
                q.filter(Product.name.ilike(f"%{token}%"))
                .order_by(desc(Product.review_count))
                .limit(limit)
                .all()
            )
            seen = {p.id for p in rows}
            for p in more:
                if p.id not in seen:
                    rows.append(p)
                    seen.add(p.id)
                if len(rows) >= limit:
                    break
    return rows[:limit]


def products_to_out(products: list[Product]):
    return [product_to_out(p) for p in products]
