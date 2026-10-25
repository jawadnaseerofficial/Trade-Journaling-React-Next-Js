import base64
import hashlib
import hmac
import time
import urllib.parse
from datetime import datetime, timedelta, timezone

import httpx

from app.core.crypto import decrypt_dict
from app.core.errors import DomainError
from app.db.models import BrokerConnection
from app.services.csv_import import group_by_symbol
from app.services.trade_service import Exec

# Live sync is enabled ONLY for brokers with a public "all fills" API.
# Everything else is supported through the CSV import path (see frontend catalog).
PROVIDERS = {"alpaca", "kraken"}


def _aware(dt: datetime) -> datetime:
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


async def _fetch_alpaca(creds: dict) -> list[Exec]:
    base = "https://api.alpaca.markets" if creds.get("live") else "https://paper-api.alpaca.markets"
    key, secret = str(creds.get("apiKey", "")).strip(), str(creds.get("secretKey", "")).strip()
    if not key or not secret:
        raise DomainError("Alpaca API key and secret are required")
    since = (datetime.now(timezone.utc) - timedelta(days=365)).strftime("%Y-%m-%dT%H:%M:%SZ")
    until = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    url = f"{base}/v2/account/activities?activity_types=FILL,FILL_LIQUIDATION&since={since}&until={until}&direction=desc&page_size=100"
    async with httpx.AsyncClient(timeout=20.0) as client:
        r = await client.get(url, headers={"APCA-API-KEY-ID": key, "APCA-API-SECRET-KEY": secret})
        if r.status_code in (401, 403):
            raise DomainError("Alpaca rejected the credentials", code="invalid_credentials")
        r.raise_for_status()
        rows = r.json()
    execs: list[Exec] = []
    for a in rows:
        sym = str(a.get("symbol") or "").strip().upper()
        side_raw = str(a.get("side") or "").lower()
        qty = abs(float(a.get("qty") or 0))
        price = abs(float(a.get("price") or 0))
        if not sym or qty <= 0 or price <= 0:
            continue
        execs.append(Exec(
            symbol=sym,
            side="buy" if side_raw.startswith("buy") else "sell",
            qty=qty, price=price,
            commission=abs(float(a.get("commission") or 0)), fee=0.0,
            executed_at=_aware(datetime.fromisoformat(str(a.get("timestamp") or a.get("date")).replace("Z", "+00:00"))),
        ))
    return execs


async def _fetch_kraken(creds: dict) -> list[Exec]:
    key, secret = str(creds.get("apiKey", "")).strip(), str(creds.get("secretKey", "")).strip()
    if not key or not secret:
        raise DomainError("Kraken API key and secret are required")
    urlpath = "/0/private/TradesHistory"
    now = int(time.time())
    start = now - 365 * 86400
    seen: set[str] = set()
    ofs = 0
    execs: list[Exec] = []
    async with httpx.AsyncClient(timeout=25.0) as client:
        while True:
            postdata = urllib.parse.urlencode({"type": "all", "start": start, "end": now, "ofs": ofs})
            nonce = str(int(time.time() * 1_000_000))  # microseconds -> strictly increasing
            message = urlpath.encode() + hashlib.sha256((nonce + postdata).encode()).digest()
            signature = base64.b64encode(
                hmac.new(base64.b64decode(secret), message, hashlib.sha512).digest()
            ).decode()
            headers = {"API-Key": key, "API-Sign": signature, "Content-Type": "application/x-www-form-urlencoded"}
            r = await client.post(f"https://api.kraken.com{urlpath}", data=postdata, headers=headers)
            if r.status_code in (401, 403):
                raise DomainError("Kraken rejected the credentials", code="invalid_credentials")
            r.raise_for_status()
            j = r.json()
            if j.get("error"):
                raise DomainError("Kraken: " + "; ".join(map(str, j["error"])))
            trades = (j.get("result") or {}).get("trades") or {}
            ids = set(trades.keys())
            if not ids or ids <= seen:  # guard against servers that ignore ofs
                break
            seen |= ids
            ofs += len(trades)
            for t in trades.values():
                sym = str(t.get("pair") or "").strip().upper()  # kraken-native code, e.g. XXBTZUSD
                qty = abs(float(t.get("volume") or 0))
                price = abs(float(t.get("price") or 0))
                if not sym or qty <= 0 or price <= 0:
                    continue
                execs.append(Exec(
                    symbol=sym,
                    side="buy" if str(t.get("type", "")).lower().startswith("b") else "sell",
                    qty=qty, price=price,
                    commission=abs(float(t.get("fee") or 0)), fee=0.0,
                    executed_at=datetime.fromtimestamp(float(t.get("time") or now), tz=timezone.utc),
                ))
    return execs


async def fetch_activities(conn: BrokerConnection) -> list[Exec]:
    creds = decrypt_dict(conn.credentials_encrypted)
    if conn.broker == "alpaca":
        return await _fetch_alpaca(creds)
    if conn.broker == "kraken":
        return await _fetch_kraken(creds)
    raise DomainError(
        f"No live API for '{conn.broker}'. Use the File Upload tab with that broker's exported CSV."
    )


def group(execs: list[Exec]) -> dict[str, list[Exec]]:
    return group_by_symbol(execs)