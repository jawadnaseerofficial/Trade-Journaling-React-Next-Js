import csv
import io
import re
from datetime import datetime, timedelta, timezone

from app.services.trade_service import Exec

# canonical field -> accepted header aliases (lowercased, punctuation-normalized)
ALIASES = {
    "date": ["date", "trade date", "filled date", "execution date", "trans date", "settlement date",
             "time", "timestamp", "datetime", "date/time", "executed at", "filled at", "trade time"],
    "time": ["time", "filled time", "execution time", "trans time", "trade time", "clock time"],
    "symbol": ["symbol", "ticker", "instrument", "contract", "security", "underlying",
               "pair", "market", "product", "asset", "currency pair", "base currency", "base"],
    "side": ["side", "buy/sell", "buy sell", "action", "direction", "long/short", "type",
             "transaction type", "order type", "position effect", "b/s"],
    "qty": ["qty", "quantity", "shares", "filled qty", "cum qty", "cumulative qty", "contracts",
            "size", "amount", "filled amount", "executed qty", "volume", "units", "lots"],
    "price": ["price", "avg fill price", "fill price", "order price", "execution price",
              "trade price", "last price", "average price", "market price", "unit price"],
    "commission": ["commission", "comm", "commissions", "broker commission", "fee usd", "trading fee"],
    "fee": ["fee", "fees", "contract fees", "delivery fee", "regulatory fee", "sec fee",
            "total fees", "network fee", "transaction fee", "taker fee", "maker fee"],
}

_SIDE_BUY = {"buy", "b", "l", "long", "to open", "open long", "close short", "bid", "purchase"}
_SIDE_SELL = {"sell", "s", "sh", "short", "to close", "open short", "close long", "ask", "sale", "sold"}


def _norm(h: str) -> str:
    return re.sub(r"[\s_\-/]+", " ", (h or "").strip().lower())


def build_header_map(fieldnames: list[str]) -> dict[str, str]:
    mapping: dict[str, str] = {}
    for col in fieldnames:
        n = _norm(col)
        for field, aliases in ALIASES.items():
            if field in mapping:
                continue
            if n in aliases or any(a in n for a in aliases):
                mapping[field] = col
                break
    return mapping


def _parse_side(raw: str) -> str | None:
    s = _norm(raw).replace(" ", "")
    if not s:
        return None
    if s in _SIDE_BUY or "buy" in s or "long" in s:
        return "buy"
    if s in _SIDE_SELL or "sell" in s or "short" in s:
        return "sell"
    return None


def _num(raw) -> float:
    if raw is None:
        return 0.0
    t = str(raw).strip().replace(",", "").replace("$", "").replace("(", "-").replace(")", "")
    if not t or t in {"-", "--", "n/a", "na"}:
        return 0.0
    try:
        return float(t)
    except ValueError:
        return 0.0


def _dt(date_str: str, time_str: str, tz_offset_hours: float) -> datetime:
    """Returns a tz-aware UTC datetime. Handles epoch, ISO-8601, and broker-local date+time."""
    d = (date_str or "").strip()
    t = (time_str or "").strip()
    # epoch seconds / millis in the date column
    if d.isdigit() and len(d) in (10, 13):
        ts = int(d)
        if len(d) == 13:
            ts //= 1000
        return datetime.fromtimestamp(ts, tz=timezone.utc)
    combined = f"{d} {t}".strip()
    # ISO-8601 (crypto / modern exports)
    if "T" in combined or "Z" in combined or re.search(r"\+\d{2}:\d{2}$", combined):
        try:
            parsed = datetime.fromisoformat(combined.replace("Z", "+00:00"))
            if parsed.tzinfo:
                return parsed.astimezone(timezone.utc)
            return parsed.replace(tzinfo=timezone.utc)
        except ValueError:
            pass
    # broker-local date + time -> normalize to UTC using the chosen timezone offset
    if len(t) == 5:
        t += ":00"
    for fmt_d in ("%Y-%m-%d", "%m/%d/%Y", "%d/%m/%Y", "%m-%d-%Y", "%Y/%m/%d", "%d-%m-%Y", "%b %d, %Y", "%d %b %Y"):
        for fmt_t in ("%H:%M:%S", "%H:%M", "%I:%M:%S %p", "%I:%M %p", ""):
            try:
                naive = datetime.strptime(f"{d} {t}".strip(), f"{fmt_d} {fmt_t}".strip())
                return (naive - timedelta(hours=tz_offset_hours)).replace(tzinfo=timezone.utc)
            except ValueError:
                continue
    raise ValueError(f"Unparseable date/time: {date_str!r} {time_str!r}")


def parse_csv(content: str, tz_offset_hours: float = -4.0) -> tuple[list[Exec], int]:
    reader = csv.DictReader(io.StringIO(content.strip()))
    if not reader.fieldnames:
        return [], 0
    hmap = build_header_map(list(reader.fieldnames))
    if "symbol" not in hmap or "qty" not in hmap or "price" not in hmap:
        return [], 0  # not a recognizable trade CSV

    execs: list[Exec] = []
    skipped = 0
    for row in reader:
        try:
            symbol = str(row.get(hmap["symbol"]) or "").strip().upper()
            raw_qty = _num(row.get(hmap["qty"], ""))
            price = abs(_num(row.get(hmap["price"], "")))
            side = _parse_side(row.get(hmap.get("side", ""), ""))
            if side is None:  # some exports encode direction by sign of qty
                side = "sell" if raw_qty < 0 else "buy"
            qty = abs(raw_qty)
            if not symbol or qty <= 0 or price <= 0:
                skipped += 1
                continue
            date_col = hmap.get("date", "")
            time_col = hmap.get("time", "")
            executed_at = _dt(row.get(date_col, ""), row.get(time_col, ""), tz_offset_hours)
            execs.append(Exec(
                symbol=symbol, side=side, qty=qty, price=price,
                commission=abs(_num(row.get(hmap.get("commission", ""), ""))),
                fee=abs(_num(row.get(hmap.get("fee", ""), ""))),
                executed_at=executed_at,
            ))
        except Exception:
            skipped += 1
    return execs, skipped


def group_by_symbol(execs: list[Exec]) -> dict[str, list[Exec]]:
    out: dict[str, list[Exec]] = {}
    for e in execs:
        out.setdefault(e.symbol, []).append(e)
    return out