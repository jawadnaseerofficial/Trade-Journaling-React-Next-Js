import hashlib
import json
import logging
import os
from typing import Any

try:
    import redis.asyncio as aioredis
except Exception:
    aioredis = None


logger = logging.getLogger(__name__)

_redis: Any = None
_enabled = False


def _prefix() -> str:
    return (os.getenv("REDIS_PREFIX") or "tj").strip() or "tj"


def _schema_version() -> str:
    return (os.getenv("CACHE_SCHEMA_VERSION") or "v1").strip() or "v1"


def _default_ttl() -> int:
    try:
        return max(5, int(os.getenv("REDIS_DEFAULT_TTL") or "60"))
    except Exception:
        return 60


def make_key(*parts: Any) -> str:
    clean = [str(p) for p in parts if p is not None and str(p) != ""]
    return ":".join([_prefix(), _schema_version(), *clean])


def stable_hash(obj: Any) -> str:
    try:
        payload = json.dumps(
            obj,
            sort_keys=True,
            separators=(",", ":"),
            default=str,
        )
    except Exception:
        payload = repr(obj)

    return hashlib.sha256(payload.encode("utf-8")).hexdigest()[:16]


async def start_redis() -> None:
    """
    Start Redis if REDIS_URL is set.

    Fail-open:
    - no REDIS_URL => disabled
    - Redis unreachable => disabled
    - backend must still boot
    """
    global _redis, _enabled

    _redis = None
    _enabled = False

    url = (os.getenv("REDIS_URL") or "").strip()

    if not url:
        logger.info("Redis cache disabled: REDIS_URL not set")
        return

    if aioredis is None:
        logger.warning("Redis cache disabled: redis package not available")
        return

    try:
        _redis = aioredis.Redis.from_url(
            url,
            decode_responses=True,
            socket_connect_timeout=1,
            socket_timeout=1,
            health_check_interval=30,
        )

        await _redis.ping()
        _enabled = True
        logger.info("Redis cache enabled")
    except Exception as exc:
        logger.warning("Redis cache disabled fail-open: %s", exc)

        try:
            if _redis is not None:
                if hasattr(_redis, "aclose"):
                    await _redis.aclose()
                else:
                    await _redis.close()
        except Exception:
            pass

        _redis = None
        _enabled = False


async def stop_redis() -> None:
    global _redis, _enabled

    if _redis is None:
        return

    try:
        if hasattr(_redis, "aclose"):
            await _redis.aclose()
        else:
            await _redis.close()
    except Exception:
        pass
    finally:
        _redis = None
        _enabled = False


def is_enabled() -> bool:
    return bool(_enabled and _redis is not None)


async def get_json(key: str) -> Any | None:
    if not is_enabled():
        return None

    try:
        raw = await _redis.get(key)
        if raw is None:
            return None

        return json.loads(raw)
    except Exception:
        return None


async def set_json(key: str, value: Any, ttl: int | None = None) -> bool:
    if not is_enabled():
        return False

    try:
        raw = json.dumps(value, separators=(",", ":"), default=str)
        await _redis.set(key, raw, ex=int(ttl or _default_ttl()))
        return True
    except Exception:
        return False


async def delete_prefix(prefix: str) -> int:
    """
    Safe prefix delete using SCAN, not KEYS.
    """
    if not is_enabled():
        return 0

    deleted = 0

    try:
        pattern = f"{prefix}*"
        async for key in _redis.scan_iter(match=pattern, count=100):
            await _redis.delete(key)
            deleted += 1
    except Exception:
        pass

    return deleted


async def bump_data_version(tenant_id: str) -> int | None:
    """
    Invalidate tenant-scoped caches by increasing version.

    Call this after trade create/update/delete/import.
    """
    if not is_enabled():
        return None

    key = make_key("data_version", tenant_id)

    try:
        return int(await _redis.incr(key))
    except Exception:
        return None


async def get_data_version(tenant_id: str) -> int:
    if not is_enabled():
        return 1

    key = make_key("data_version", tenant_id)

    try:
        raw = await _redis.get(key)
        return int(raw) if raw is not None else 1
    except Exception:
        return 1