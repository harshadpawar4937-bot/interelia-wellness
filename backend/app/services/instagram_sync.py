"""Instagram Graph API sync → draft SocialReel rows."""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Optional
from urllib.request import Request, urlopen

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models import InstagramAccountConfig, SocialReel
from app.services.storage import save_public_bytes

logger = logging.getLogger("interelia.instagram")

GRAPH_BASE = "https://graph.facebook.com/v21.0"

DEFAULT_HANDLES = (
    "interelia.pharmacy",
    "interelialifescience",
    "tata1mgwellness",
)


def parse_instagram_accounts_env() -> dict[str, str]:
    """Parse INSTAGRAM_ACCOUNTS=handle:id,handle:id into a map."""
    out: dict[str, str] = {}
    raw = (settings.instagram_accounts or "").strip()
    if not raw:
        return out
    for part in raw.split(","):
        part = part.strip()
        if not part:
            continue
        if ":" in part:
            handle, ig_id = part.split(":", 1)
            handle = handle.strip().lstrip("@")
            ig_id = ig_id.strip()
            if handle:
                out[handle] = ig_id
        else:
            out[part.lstrip("@")] = ""
    return out


def ensure_instagram_accounts(db: Session) -> list[InstagramAccountConfig]:
    """Seed default Interelia IG account rows if missing; merge env ig_user_ids."""
    env_map = parse_instagram_accounts_env()
    handles = list(dict.fromkeys([*DEFAULT_HANDLES, *env_map.keys()]))
    rows: list[InstagramAccountConfig] = []
    for handle in handles:
        row = db.query(InstagramAccountConfig).filter_by(handle=handle).first()
        if not row:
            row = InstagramAccountConfig(
                handle=handle,
                ig_user_id=env_map.get(handle) or None,
                is_enabled=True,
            )
            db.add(row)
            db.flush()
        elif env_map.get(handle) and not row.ig_user_id:
            row.ig_user_id = env_map[handle]
        rows.append(row)
    db.commit()
    return rows


def _graph_get(path: str, token: str, params: Optional[dict] = None) -> dict:
    from urllib.parse import urlencode
    import json

    q = {"access_token": token, **(params or {})}
    url = f"{GRAPH_BASE}/{path.lstrip('/')}?{urlencode(q)}"
    req = Request(url, headers={"User-Agent": "IntereliaWellness/1.0"})
    with urlopen(req, timeout=30) as resp:  # noqa: S310 — admin-configured Graph URL
        return json.loads(resp.read().decode("utf-8"))


def _download_thumbnail(url: str) -> Optional[str]:
    if not url:
        return None
    try:
        req = Request(url, headers={"User-Agent": "IntereliaWellness/1.0"})
        with urlopen(req, timeout=20) as resp:  # noqa: S310
            data = resp.read()
        if not data:
            return None
        return save_public_bytes("reels", data, "ig_thumb.jpg")
    except Exception as exc:  # noqa: BLE001
        logger.warning("Thumbnail download failed: %s", exc)
        return None


def sync_instagram_reels(db: Session, *, limit_per_account: int = 12) -> dict:
    """
    Pull recent media from enabled IG accounts.
    Creates/updates SocialReel drafts (is_published=False) keyed by external_media_id.
    """
    token = (settings.instagram_access_token or "").strip()
    accounts = ensure_instagram_accounts(db)
    created = updated = skipped = 0
    errors: list[str] = []

    if not token:
        for acc in accounts:
            acc.last_error = "INSTAGRAM_ACCESS_TOKEN not configured"
        db.commit()
        return {
            "created": 0,
            "updated": 0,
            "skipped": 0,
            "errors": [
                "INSTAGRAM_ACCESS_TOKEN is not set. Add a Meta long-lived token to backend/.env — "
                "see docs/instagram-setup.md"
            ],
            "accounts": accounts,
        }

    for acc in accounts:
        if not acc.is_enabled:
            skipped += 1
            continue
        if not acc.ig_user_id:
            acc.last_error = "Missing ig_user_id — set INSTAGRAM_ACCOUNTS=handle:IG_USER_ID"
            errors.append(f"@{acc.handle}: missing ig_user_id")
            continue
        try:
            data = _graph_get(
                f"{acc.ig_user_id}/media",
                token,
                {
                    "fields": "id,caption,media_type,media_product_type,permalink,thumbnail_url,media_url,timestamp",
                    "limit": str(limit_per_account),
                },
            )
            items = data.get("data") or []
            for item in items:
                media_type = (item.get("media_type") or "").upper()
                product_type = (item.get("media_product_type") or "").upper()
                # Prefer reels; also accept VIDEO
                if product_type and product_type not in ("REELS", "FEED") and media_type not in ("VIDEO", "REELS"):
                    continue
                if media_type not in ("VIDEO", "IMAGE", "CAROUSEL_ALBUM") and product_type != "REELS":
                    continue
                if media_type == "IMAGE" and product_type != "REELS":
                    continue

                ext_id = str(item.get("id") or "")
                if not ext_id:
                    continue
                permalink = item.get("permalink")
                caption = item.get("caption")
                thumb_remote = item.get("thumbnail_url") or item.get("media_url")

                existing = db.query(SocialReel).filter_by(external_media_id=ext_id).first()
                local_thumb = None
                if thumb_remote and (not existing or not existing.thumbnail_url):
                    local_thumb = _download_thumbnail(thumb_remote)

                if existing:
                    existing.permalink = permalink or existing.permalink
                    existing.caption = caption if caption is not None else existing.caption
                    if local_thumb:
                        existing.thumbnail_url = local_thumb
                    elif thumb_remote and not existing.thumbnail_url:
                        existing.thumbnail_url = thumb_remote
                    existing.instagram_handle = acc.handle
                    existing.source = "instagram_sync"
                    if not existing.display_mode:
                        existing.display_mode = "instagram_embed"
                    updated += 1
                else:
                    row = SocialReel(
                        instagram_handle=acc.handle,
                        permalink=permalink,
                        caption=caption,
                        display_mode="instagram_embed",
                        thumbnail_url=local_thumb or thumb_remote,
                        video_url=None,
                        external_media_id=ext_id,
                        source="instagram_sync",
                        sort_order=0,
                        is_published=False,
                    )
                    db.add(row)
                    created += 1

            acc.last_synced_at = datetime.now(timezone.utc)
            acc.last_error = None
        except Exception as exc:  # noqa: BLE001
            msg = str(exc)[:500]
            acc.last_error = msg
            errors.append(f"@{acc.handle}: {msg}")
            logger.exception("IG sync failed for %s", acc.handle)

    db.commit()
    return {
        "created": created,
        "updated": updated,
        "skipped": skipped,
        "errors": errors,
        "accounts": accounts,
    }
