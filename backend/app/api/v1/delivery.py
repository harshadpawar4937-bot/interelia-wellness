"""Public delivery config and serviceability check."""

from __future__ import annotations

from typing import Any, Dict, Optional

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.core.config import settings
from app.services.delivery import check_serviceability, result_to_dict

router = APIRouter()


class DeliveryAddressIn(BaseModel):
    line1: str = Field(min_length=1, max_length=255)
    line2: Optional[str] = None
    city: str = Field(default="Ahmedabad", max_length=100)
    state: str = Field(default="Gujarat", max_length=100)
    pincode: str = Field(min_length=6, max_length=10)


class DeliveryCheckRequest(BaseModel):
    shipping_address: DeliveryAddressIn


@router.get("/config")
def delivery_config() -> Dict[str, Any]:
    return {
        "store_label": settings.store_address,
        "store_lat": settings.store_lat,
        "store_lng": settings.store_lng,
        "radius_km": settings.delivery_radius_km,
        "eta_minutes": settings.delivery_eta_minutes,
        "delivery_fee": settings.delivery_fee,
        "free_delivery_min": settings.free_delivery_min,
        "promise": f"Express delivery within {settings.delivery_radius_km:g} km · {settings.delivery_eta_minutes} min",
    }


@router.post("/check")
def delivery_check(body: DeliveryCheckRequest) -> Dict[str, Any]:
    result = check_serviceability(body.shipping_address.model_dump())
    return result_to_dict(result)
