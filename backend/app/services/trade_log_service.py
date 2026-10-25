import asyncio
import uuid
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import NotFoundError
from app.db.models import Account, Execution, Playbook, Trade
from app.services.market_data import get_candles

_SEM = asyncio.Semaphore(6)  # cap concurrent Yahoo pulls per batch


def _f(v) -> float:
    return round(float(v), 2)


def _status(t: Trade) -> str:
    if t.status == "open":
        return "open"
    p = float(t.net_pnl)
    return "win" if p > 0 else ("loss" if p < 0 else "break_even")


def _avg(execs, side) -> float | None:
    rows = [e for e in execs if e.side == side]
    q = sum(float(e.qty) for e in rows)
    if not q:
        return None
    return _f(sum(float(e.qty) * float(e.price) for e in rows) / q)


def _realized_r(t: Trade, execs) -> float | None:
    if t.stop_loss is None:
        return None
    buys = [e for e in execs if e.side == "buy"]
    sells = [e for e in execs if e.side == "sell"]
    if not buys:
        return None
    q = sum(float(e.qty) for e in buys)
    entry = sum(float(e.qty) * float(e.price) for e in buys) / q if q else 0.0
    net = sum(float(e.qty) for e in buys) - sum(float(e.qty) for e in sells)
    side_long = net >= 0
    stop = float(t.stop_loss)
    rpu = (entry - stop) if side_long else (stop - entry)
    if rpu <= 0:
        return None
    close_qty = sum(float(e.qty) for e in (sells if side_long else buys)) or q
    return _f(float(t.net_pnl) / (rpu * close_qty))


def _containing(candles, epoch):
    ch = None
    for c in candles:
        if c["time"] <= epoch:
            ch = c
        else:
            break
    return ch or (candles[0] if candles else None)


def _metrics(candles, execs, t: Trade) -> dict:
    """MAE/MFE + Best Exit %. Uses real fills when present, else approximates
    entry from the candle at open-time (booked-outcome demo rows)."""
    if not candles:
        return {"mae": None, "mfe": None, "best_exit_pct": None, "entry": None, "exit": None}
    entry = _avg(execs, "buy") or _avg(execs, "sell")
    if entry is None:
        cd = _containing(candles, int(t.open_date.timestamp()))
        entry = cd["close"] if cd else None
    if entry is None or entry == 0:
        return {"mae": None, "mfe": None, "best_exit_pct": None, "entry": None, "exit": None}
    t0 = int(t.open_date.timestamp())
    t1 = int(t.close_date.timestamp()) if t.close_date else candles[-1]["time"]
    window = [c for c in candles if t0 <= c["time"] <= t1] or candles
    buys = [e for e in execs if e.side == "buy"]
    long = (sum(float(e.qty) for e in buys) >= sum(float(e.qty) for e in execs if e.side == "sell")) if buys else True
    if long:
        mae = entry - min(c["low"] for c in window)
        mfe = max(c["high"] for c in window) - entry
    else:
        mae = max(c["high"] for c in window) - entry
        mfe = entry - min(c["low"] for c in window)
    exitp = _avg(execs, "sell") if long else _avg(execs, "buy")
    return {
        "mae": _f(max(mae, 0)), "mfe": _f(max(mfe, 0)),
        "best_exit_pct": _f(mfe / entry * 100),
        "entry": _f(entry), "exit": _f(exitp) if exitp is not None else None,
    }


def _apply_filters(stmt, tenant_id, flt: dict):
    stmt = stmt.where(Trade.tenant_id == tenant_id)
    st = flt.get("status")
    if st == "open":
        stmt = stmt.where(Trade.status == "open")
    elif st == "win":
        stmt = stmt.where(Trade.status == "closed", Trade.net_pnl > 0)
    elif st == "loss":
        stmt = stmt.where(Trade.status == "closed", Trade.net_pnl < 0)
    elif st == "break_even":
        stmt = stmt.where(Trade.status == "closed", Trade.net_pnl == 0)
    if flt.get("symbol"):
        stmt = stmt.where(Trade.symbol.ilike(f"%{flt['symbol'].upper()}%"))
    if flt.get("setup"):
        stmt = stmt.where(Trade.setups.ilike(f"%{flt['setup']}%"))
    if flt.get("account_id"):
        stmt = stmt.where(Trade.account_id == uuid.UUID(flt["account_id"]))
    if flt.get("date_from"):
        stmt = stmt.where(Trade.open_date >= datetime.fromisoformat(flt["date_from"]).replace(tzinfo=timezone.utc))
    if flt.get("date_to"):
        nxt = datetime.fromisoformat(flt["date_to"]) + timedelta(days=1)
        stmt = stmt.where(Trade.open_date < nxt.replace(tzinfo=timezone.utc))
    return stmt


_SORT = {"openDate": Trade.open_date, "symbol": Trade.symbol, "netPnl": Trade.net_pnl,
         "netRoi": Trade.net_pnl, "status": Trade.status, "closeDate": Trade.close_date}


async def build_log(session: AsyncSession, tenant_id: uuid.UUID, flt: dict,
                    page: int, per_page: int, sort: str, direction: str) -> dict:
    base = _apply_filters(select(Trade), tenant_id, flt)
    total = (await session.execute(
        select(func.count()).select_from(base.subquery())
    )).scalar() or 0
    pages = max(1, (total + per_page - 1) // per_page)
    page = min(max(1, page), pages)

    col = _SORT.get(sort, Trade.open_date)
    order = col.asc() if direction == "asc" else col.desc()
    trades = list((await session.execute(
        base.order_by(order).offset((page - 1) * per_page).limit(per_page)
    )).scalars().all())

    ids = [t.id for t in trades]
    execs_by: dict[uuid.UUID, list] = defaultdict(list)
    if ids:
        for e in (await session.execute(
            select(Execution).where(Execution.trade_id.in_(ids)).order_by(Execution.executed_at)
        )).scalars().all():
            execs_by[e.trade_id].append(e)
    acct_names = {}
    acct_ids = {t.account_id for t in trades if t.account_id}
    if acct_ids:
        for a in (await session.execute(select(Account).where(Account.id.in_(acct_ids)))).scalars().all():
            acct_names[a.id] = a.name
    pb_names = {}
    pb_ids = {t.playbook_id for t in trades if t.playbook_id}
    if pb_ids:
        for p in (await session.execute(select(Playbook).where(Playbook.id.in_(pb_ids)))).scalars().all():
            pb_names[p.id] = p.name

    rows = []
    for t in trades:
        ex = execs_by[t.id]
        entry = _avg(ex, "buy") or _avg(ex, "sell")
        exitp = _avg(ex, "sell") if (ex and any(e.side == "buy" for e in ex)) else _avg(ex, "buy")
        cost = (entry or 0) * (sum(float(e.qty) for e in ex if e.side == "buy") or float(t.qty) or 1)
        rows.append({
            "id": str(t.id),
            "openDate": t.open_date.strftime("%m/%d/%Y"),
            "symbol": t.symbol,
            "status": _status(t),
            "closeDate": t.close_date.strftime("%m/%d/%Y") if t.close_date else None,
            "entryPrice": entry, "exitPrice": exitp,
            "netPnl": _f(t.net_pnl),
            "netRoi": _f(float(t.net_pnl) / cost * 100) if cost else None,
            "realizedR": _realized_r(t, ex),
            "setups": t.setups,
            "playbookName": pb_names.get(t.playbook_id) if t.playbook_id else None,
            "accountName": acct_names.get(t.account_id),
            "mae": None, "mfe": None, "bestExitPct": None,
        })

    # KPIs over the filtered CLOSED set (realized); badge = total filtered rows.
    # `case` is an SQL EXPRESSION, not a function -> bare `case(...)`, NEVER `func.case(...)`.
    agg = (await session.execute(
        _apply_filters(select(
            func.count().label("n"),
            func.sum(func.coalesce(Trade.net_pnl, 0)).label("total_pnl"),
            func.sum(case((Trade.net_pnl > 0, Trade.net_pnl), else_=0)).label("gw"),
            func.sum(case((Trade.net_pnl < 0, -Trade.net_pnl), else_=0)).label("gl"),
            func.sum(case((Trade.net_pnl > 0, 1), else_=0)).label("nw"),
            func.sum(case((Trade.net_pnl < 0, 1), else_=0)).label("nl"),
        ).where(Trade.status == "closed"), tenant_id, flt)
    )).one()
    n, s, gw, gl, nw, nl = (agg.n or 0), float(agg.total_pnl or 0), float(agg.gw or 0), float(agg.gl or 0), agg.nw or 0, agg.nl or 0

    # cumulative daily over the filtered closed set (_apply_filters takes 3 args: stmt, tenant, flt)
    daily = (await session.execute(
        _apply_filters(
            select(
                func.date(Trade.close_date).label("d"),
                func.sum(Trade.net_pnl).label("p"),
            ).where(Trade.status == "closed"),
            tenant_id, flt,
        ).group_by("d").order_by("d")
    )).all()
    running = 0.0
    cumulative = []
    for d, p in daily:
        running = _f(running + float(p or 0))
        cumulative.append({"date": d.strftime("%m/%d/%y") if hasattr(d, "strftime") else str(d), "value": running})

    kpis = {
        "netPnl": _f(s), "trades": total,
        "winRate": _f(nw / (nw + nl) * 100) if (nw + nl) else 0.0,
        "profitFactor": round(gw / gl, 2) if gl else 0.0,
        "avgWin": _f(gw / nw) if nw else 0.0,
        "avgLoss": _f(-gl / nl) if nl else 0.0,
        "expectancy": _f(s / n) if n else 0.0,
        "cumulative": cumulative,
    }
    return {"rows": rows, "total": total, "page": page, "pages": pages, "perPage": per_page, "kpis": kpis}


async def _candles_for(t: Trade, interval: str = "1m"):
    return await get_candles(t.symbol, t.open_date.date(), interval)


async def preview(session: AsyncSession, tenant_id: uuid.UUID, trade_id: uuid.UUID) -> dict:
    t = await session.get(Trade, trade_id)
    if t is None or t.tenant_id != tenant_id:
        raise NotFoundError("Trade not found")
    ex = list((await session.execute(
        select(Execution).where(Execution.trade_id == t.id).order_by(Execution.executed_at)
    )).scalars().all())
    acct = await session.get(Account, t.account_id) if t.account_id else None
    candles = await _candles_for(t)
    m = _metrics(candles, ex, t)
    entry = m["entry"] if m["entry"] is not None else (_avg(ex, "buy") or _avg(ex, "sell"))
    cost = (entry or 0) * (sum(float(e.qty) for e in ex if e.side == "buy") or float(t.qty) or 1)
    return {
        "id": str(t.id), "symbol": t.symbol,
        "dayLabel": t.open_date.strftime("%a, %b %d, %Y"),
        "status": _status(t),
        "entryPrice": entry, "exitPrice": m["exit"],
        "netPnl": _f(t.net_pnl),
        "netRoi": _f(float(t.net_pnl) / cost * 100) if cost else None,
        "realizedR": _realized_r(t, ex),
        "mae": m["mae"], "mfe": m["mfe"], "bestExitPct": m["best_exit_pct"],
        "setups": t.setups, "accountName": acct.name if acct else None,
        "candles": candles,
    }


async def preview_batch(session: AsyncSession, tenant_id: uuid.UUID, ids: list[str]) -> dict:
    uuids = [uuid.UUID(i) for i in ids[:200]]
    trades = list((await session.execute(
        select(Trade).where(Trade.id.in_(uuids), Trade.tenant_id == tenant_id)
    )).scalars().all())
    ex_by: dict[uuid.UUID, list] = defaultdict(list)
    if trades:
        for e in (await session.execute(
            select(Execution).where(Execution.trade_id.in_([t.id for t in trades])).order_by(Execution.executed_at)
        )).scalars().all():
            ex_by[e.trade_id].append(e)

    async def one(t: Trade):
        async with _SEM:
            try:
                candles = await _candles_for(t)
            except Exception:
                return str(t.id), {"mae": None, "mfe": None, "bestExitPct": None}
            m = _metrics(candles, ex_by[t.id], t)
            return str(t.id), {"mae": m["mae"], "mfe": m["mfe"], "bestExitPct": m["best_exit_pct"]}

    results = await asyncio.gather(*(one(t) for t in trades))
    return dict(results)