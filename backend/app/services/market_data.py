import time
from datetime import date, datetime, timedelta, timezone

import httpx

from app.core.errors import DomainError

# Unofficial but standard Yahoo chart endpoint (same one the `yfinance` lib uses).
# Called server-side -> no CORS, one place to swap for a licensed feed in prod.
_YAHOO = "https://query1.finance.yahoo.com/v8/finance/chart/{symbol}"
_UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) tradeJournaling/1.0"}
_INTERVALS = {"1m", "5m", "15m", "1h", "1d"}

# tiny in-proc TTL cache (dev). Swap body for Redis when we wire it -> same signature.
_cache: dict[tuple[str, str, str], tuple[float, list[dict]]] = {}
_CACHE_TTL = 300


def _day_window(day: date) -> tuple[int, int]:
    start = datetime.combine(day, datetime.min.time(), tzinfo=timezone.utc)
    end = start + timedelta(days=1)
    return int(start.timestamp()), int(end.timestamp())


async def get_candles(symbol: str, day: date, interval: str = "1m") -> list[dict]:
    sym = (symbol or "").strip().upper()
    if not sym:
        raise DomainError("Symbol is required")
    if interval not in _INTERVALS:
        interval = "1m"
    key = (sym, day.isoformat(), interval)
    now = time.time()
    hit = _cache.get(key)
    if hit and hit[0] > now:
        return hit[1]

    p1, p2 = _day_window(day)
    url = _YAHOO.format(symbol=sym)
    params = {"interval": interval, "period1": p1, "period2": p2, "includePrePost": "true", "events": "div,splits"}
    try:
        async with httpx.AsyncClient(timeout=15.0, headers=_UA) as client:
            r = await client.get(url, params=params)
    except httpx.HTTPError as e:
        raise DomainError(f"Market data network error: {e.__class__.__name__}")

    if r.status_code == 404:
        raise DomainError(f"No market data for '{sym}' (unknown symbol)")
    if r.status_code == 429:
        raise DomainError("Yahoo rate-limited this request. Try again in a minute or widen the interval.")
    if r.status_code != 200:
        raise DomainError(f"Market data unavailable (HTTP {r.status_code})")

    data = r.json()
    result = (data.get("chart") or {}).get("result")
    if not result:
        err = (data.get("chart") or {}).get("error") or {}
        raise DomainError(err.get("description") or f"No candles for {sym} on {day.isoformat()}")

    res0 = result[0]
    ts = res0.get("timestamp") or []
    quote = (res0.get("indicators") or {}).get("quote") or [{}]
    q0 = quote[0] if quote else {}
    o, h, l, c, v = q0.get("open") or [], q0.get("high") or [], q0.get("low") or [], q0.get("close") or [], q0.get("volume") or []

    candles: list[dict] = []
    for i, t in enumerate(ts):
        try:
            _o, _h, _l, _c = o[i], h[i], l[i], c[i]
        except IndexError:
            break
        if _o is None or _h is None or _l is None or _c is None:
            continue  # skip empty pre/post gaps
        candles.append({
            "time": int(t),
            "open": round(float(_o), 4),
            "high": round(float(_h), 4),
            "low": round(float(_l), 4),
            "close": round(float(_c), 4),
            "volume": int(v[i] or 0) if i < len(v) else 0,
        })
    candles.sort(key=lambda x: x["time"])
    _cache[key] = (now + _CACHE_TTL, candles)
    return candles