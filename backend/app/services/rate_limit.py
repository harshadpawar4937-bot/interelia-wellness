"""Simple rate limiter — Redis when available, otherwise in-memory."""

from __future__ import annotations

import logging
import time
from collections import defaultdict
from threading import Lock
from typing import Optional, Tuple

from app.core.config import settings

logger = logging.getLogger(__name__)

_lock = Lock()
_buckets: dict[str, list[float]] = defaultdict(list)
_redis = None
_redis_failed = False


def _get_redis():
    global _redis, _redis_failed
    if _redis_failed:
        return None
    if _redis is not None:
        return _redis
    try:
        import redis

        client = redis.from_url(settings.redis_url, decode_responses=True, socket_connect_timeout=0.5)
        client.ping()
        _redis = client
        return _redis
    except Exception as exc:  # noqa: BLE001
        logger.warning("Redis unavailable for rate limiting (%s); using memory", exc)
        _redis_failed = True
        return None


def check_rate_limit(key: str, limit: int, window_seconds: int = 60) -> Tuple[bool, int]:
    """
    Return (allowed, remaining).
    Uses a sliding window of timestamps.
    """
    client = _get_redis()
    now = time.time()
    if client is not None:
        try:
            rkey = f"rl:{key}"
            pipe = client.pipeline()
            pipe.zremrangebyscore(rkey, 0, now - window_seconds)
            pipe.zadd(rkey, {str(now): now})
            pipe.zcard(rkey)
            pipe.expire(rkey, window_seconds + 1)
            _, _, count, _ = pipe.execute()
            remaining = max(0, limit - int(count))
            return int(count) <= limit, remaining
        except Exception as exc:  # noqa: BLE001
            logger.warning("Redis rate limit error: %s", exc)

    with _lock:
        stamps = [t for t in _buckets[key] if t > now - window_seconds]
        stamps.append(now)
        _buckets[key] = stamps
        remaining = max(0, limit - len(stamps))
        return len(stamps) <= limit, remaining


def client_key(prefix: str, identifier: Optional[str]) -> str:
    return f"{prefix}:{identifier or 'anon'}"
