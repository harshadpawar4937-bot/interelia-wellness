"""AI chat and recommendations."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session, joinedload

from app.core.config import settings
from app.db.session import get_db
from app.models import Product
from app.schemas import AIChatRequest, AIChatResponse
from app.services.rate_limit import check_rate_limit, client_key
from app.services.rag import generate_chat_reply
from app.services.serializers import product_to_out

router = APIRouter()


@router.post("/chat", response_model=AIChatResponse)
async def chat(body: AIChatRequest, request: Request, db: Session = Depends(get_db)):
    if not body.message or not body.message.strip():
        raise HTTPException(400, "Message required")
    if len(body.message) > 2000:
        raise HTTPException(400, "Message too long")

    ip = request.client.host if request.client else "unknown"
    allowed, remaining = check_rate_limit(
        client_key("ai-chat", ip),
        settings.ai_rate_limit_per_minute,
        60,
    )
    if not allowed:
        raise HTTPException(
            status_code=429,
            detail="Too many AI requests. Please wait a minute and try again.",
            headers={"X-RateLimit-Remaining": "0"},
        )

    result = await generate_chat_reply(db, body.message.strip())
    resp = AIChatResponse(**result)
    return resp


@router.get("/recommendations")
def recommendations(db: Session = Depends(get_db)):
    """Return available (active + in-stock) catalog products for UI recommendations."""
    items = (
        db.query(Product)
        .options(joinedload(Product.category), joinedload(Product.brand))
        .filter(Product.is_active.is_(True), Product.stock_qty > 0)
        .order_by(Product.review_count.desc(), Product.rating.desc())
        .limit(8)
        .all()
    )
    return {
        "products": [product_to_out(p) for p in items],
        "reason": "Available wellness picks from the live Interelia catalog",
    }
