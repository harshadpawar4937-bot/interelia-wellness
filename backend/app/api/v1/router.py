"""API v1 router aggregation."""

from __future__ import annotations

from fastapi import APIRouter

from app.api.v1 import (
    admin,
    ai,
    auth,
    brands,
    delivery,
    health,
    media,
    medicine_requests,
    orders,
    prescriptions,
    products,
    uploads,
)

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["Auth"])
api_router.include_router(products.router, prefix="/products", tags=["Products"])
api_router.include_router(brands.router, prefix="/brands", tags=["Brands"])
api_router.include_router(prescriptions.router, prefix="/prescriptions", tags=["Prescriptions"])
api_router.include_router(orders.router, prefix="/orders", tags=["Orders"])
api_router.include_router(delivery.router, prefix="/delivery", tags=["Delivery"])
api_router.include_router(ai.router, prefix="/ai", tags=["AI"])
api_router.include_router(health.router, prefix="/content", tags=["Content"])
api_router.include_router(
    medicine_requests.router, prefix="/medicine-requests", tags=["Medicine Requests"]
)
api_router.include_router(
    medicine_requests.notifications_router, prefix="/notifications", tags=["Notifications"]
)
api_router.include_router(admin.router, prefix="/admin", tags=["Admin"])
api_router.include_router(uploads.router, prefix="/uploads", tags=["Uploads"])
api_router.include_router(media.router, prefix="/media", tags=["Media"])
