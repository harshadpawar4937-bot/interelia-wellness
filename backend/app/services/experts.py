"""Expert Corner serializers and helpers."""

from __future__ import annotations

from typing import Optional
from urllib.parse import quote_plus

from app.models import Expert
from app.schemas import ExpertOut


def _digits(phone: Optional[str]) -> Optional[str]:
    if not phone:
        return None
    digits = "".join(c for c in phone if c.isdigit())
    return digits or None


def build_maps_url(expert: Expert, *, prefer_stored: bool = True) -> Optional[str]:
    if prefer_stored and expert.maps_url:
        return expert.maps_url
    parts = [
        expert.clinic_name,
        expert.address_line1,
        expert.address_line2,
        expert.city,
        expert.state,
        expert.pincode,
    ]
    query = ", ".join(p for p in parts if p)
    if not query:
        return None
    return f"https://www.google.com/maps/search/?api=1&query={quote_plus(query)}"


def expert_to_out(e: Expert, *, resolve_maps: bool = True) -> ExpertOut:
    return ExpertOut(
        id=e.id,
        name=e.name,
        slug=e.slug,
        role=e.role,
        specialty=e.specialty,
        quote=e.quote,
        bio=e.bio,
        image_url=e.image_url,
        phone=e.phone,
        whatsapp=e.whatsapp or e.phone,
        email=e.email,
        clinic_name=e.clinic_name,
        address_line1=e.address_line1,
        address_line2=e.address_line2,
        city=e.city,
        state=e.state,
        pincode=e.pincode,
        maps_url=build_maps_url(e) if resolve_maps else e.maps_url,
        availability_text=e.availability_text,
        accepting_calls=bool(e.accepting_calls),
        accepting_visits=bool(e.accepting_visits),
        is_featured=bool(e.is_featured),
        is_active=bool(e.is_active),
        sort_order=e.sort_order or 0,
    )


def tel_href(phone: Optional[str]) -> Optional[str]:
    digits = _digits(phone)
    return f"tel:+{digits}" if digits else None


def wa_href(phone: Optional[str]) -> Optional[str]:
    digits = _digits(phone)
    if not digits:
        return None
    if not digits.startswith("91") and len(digits) == 10:
        digits = f"91{digits}"
    return f"https://wa.me/{digits}"
