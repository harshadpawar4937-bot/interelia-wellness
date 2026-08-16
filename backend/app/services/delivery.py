"""Express delivery serviceability — 6 km radius, 30 min promise."""

from __future__ import annotations

import logging
import math
import re
from dataclasses import dataclass
from typing import Any, Dict, Optional, Tuple

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

# Approximate centroids for Ahmedabad-area PINs near Gota (offline fallback).
# Distances are relative to store hub; keep only serviceable / nearby codes.
AHMEDABAD_PIN_COORDS: Dict[str, Tuple[float, float]] = {
    "382481": (23.1016, 72.5402),  # Gota
    "380005": (23.0465, 72.5490),
    "380006": (23.0350, 72.5600),
    "380007": (23.0220, 72.5550),
    "380008": (23.0150, 72.5300),
    "380009": (23.0400, 72.5750),
    "380013": (23.0600, 72.5200),
    "380015": (23.0500, 72.5050),  # Satellite-ish
    "380051": (23.0800, 72.5600),
    "380052": (23.0900, 72.5500),
    "380054": (23.0700, 72.5050),
    "380058": (23.1100, 72.5200),
    "380059": (23.0950, 72.5750),
    "380060": (23.1200, 72.5550),
    "380061": (23.0850, 72.5350),
    "382345": (23.1300, 72.5600),
    "382350": (23.1400, 72.5400),
    "382421": (23.0700, 72.5800),
    "382424": (23.0550, 72.5900),
    "382440": (23.1150, 72.5050),
    "382445": (23.1250, 72.5250),
    "382470": (23.1500, 72.5500),
    "382475": (23.1600, 72.5300),
    "382480": (23.1000, 72.5600),
}


@dataclass
class ServiceabilityResult:
    eligible: bool
    distance_km: Optional[float]
    eta_minutes: Optional[int]
    message: str
    store_label: str
    radius_km: float
    geocode_source: str = "none"


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlmb = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlmb / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def normalize_pincode(raw: Any) -> str:
    digits = re.sub(r"\D", "", str(raw or ""))
    return digits[:6] if len(digits) >= 6 else digits


def _geocode_nominatim(query: str) -> Optional[Tuple[float, float]]:
    try:
        with httpx.Client(timeout=8.0) as client:
            resp = client.get(
                "https://nominatim.openstreetmap.org/search",
                params={"q": query, "format": "json", "limit": 1, "countrycodes": "in"},
                headers={"User-Agent": "IntereliaWellnessDelivery/1.0 (ops@interelia.com)"},
            )
            resp.raise_for_status()
            rows = resp.json()
            if not rows:
                return None
            return float(rows[0]["lat"]), float(rows[0]["lon"])
    except Exception as exc:  # noqa: BLE001
        logger.warning("Nominatim geocode failed: %s", exc)
        return None


def resolve_coordinates(address: Dict[str, Any]) -> Tuple[Optional[Tuple[float, float]], str]:
    pin = normalize_pincode(address.get("pincode") or address.get("pin") or "")
    if pin in AHMEDABAD_PIN_COORDS:
        return AHMEDABAD_PIN_COORDS[pin], "pin_map"

    line1 = str(address.get("line1") or "").strip()
    city = str(address.get("city") or "Ahmedabad").strip()
    state = str(address.get("state") or "Gujarat").strip()
    parts = [p for p in [line1, city, state, pin, "India"] if p]
    query = ", ".join(parts)
    coords = _geocode_nominatim(query)
    if coords:
        return coords, "nominatim"
    if pin:
        coords = _geocode_nominatim(f"{pin}, India")
        if coords:
            return coords, "nominatim_pin"
    return None, "none"


def check_serviceability(address: Dict[str, Any]) -> ServiceabilityResult:
    store_label = settings.store_address
    radius = float(settings.delivery_radius_km)
    eta = int(settings.delivery_eta_minutes)

    pin = normalize_pincode(address.get("pincode") or "")
    line1 = str(address.get("line1") or "").strip()
    if not pin or len(pin) != 6:
        return ServiceabilityResult(
            eligible=False,
            distance_km=None,
            eta_minutes=None,
            message="Enter a valid 6-digit pincode to check express delivery.",
            store_label=store_label,
            radius_km=radius,
        )
    if not line1:
        return ServiceabilityResult(
            eligible=False,
            distance_km=None,
            eta_minutes=None,
            message="Enter your full delivery address (street / society).",
            store_label=store_label,
            radius_km=radius,
        )

    coords, source = resolve_coordinates(address)
    if not coords:
        return ServiceabilityResult(
            eligible=False,
            distance_km=None,
            eta_minutes=None,
            message=(
                f"We could not locate that address. Express delivery is available within "
                f"{radius:g} km of {store_label}."
            ),
            store_label=store_label,
            radius_km=radius,
            geocode_source=source,
        )

    dist = haversine_km(settings.store_lat, settings.store_lng, coords[0], coords[1])
    dist_r = round(dist, 2)
    if dist <= radius + 1e-6:
        return ServiceabilityResult(
            eligible=True,
            distance_km=dist_r,
            eta_minutes=eta,
            message=(
                f"Eligible — express delivery within {eta} minutes "
                f"(~{dist_r} km from {store_label})."
            ),
            store_label=store_label,
            radius_km=radius,
            geocode_source=source,
        )

    return ServiceabilityResult(
        eligible=False,
        distance_km=dist_r,
        eta_minutes=None,
        message=(
            f"Outside our {radius:g} km express zone (~{dist_r} km from {store_label}). "
            f"We currently deliver only within {radius:g} km in about {eta} minutes."
        ),
        store_label=store_label,
        radius_km=radius,
        geocode_source=source,
    )


def delivery_fee_for_subtotal(subtotal) -> float:  # noqa: ANN001
    from decimal import Decimal

    s = Decimal(str(subtotal))
    free_min = Decimal(str(settings.free_delivery_min))
    fee = Decimal(str(settings.delivery_fee))
    return float(Decimal("0") if s >= free_min else fee)


def result_to_dict(r: ServiceabilityResult) -> Dict[str, Any]:
    return {
        "eligible": r.eligible,
        "distance_km": r.distance_km,
        "eta_minutes": r.eta_minutes,
        "message": r.message,
        "store_label": r.store_label,
        "radius_km": r.radius_km,
        "geocode_source": r.geocode_source,
    }
