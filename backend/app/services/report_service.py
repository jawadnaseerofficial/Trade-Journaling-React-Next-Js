import calendar as pycal
import uuid
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import and_, case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Base, Account, Playbook, Trade
from app.schemas.report import (
    BucketRow,
    CalendarDay,
    CalendarOut,
    CompareGroup,
    CompareOut,
    CrossCell,
    DimensionOut,
    FiltersIn,
    MetricPoint,
    MetricSeries,
    OverviewOut,
    PerformanceOut,
    SummaryCard,
)

ET = timezone(timedelta(hours=-5))
_DOW = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
_MON = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
]
_DUR_BUCKETS = [
    ("< 1 min", 0, 60),
    ("1–5 min", 60, 300),
    ("5–10 min", 300, 600),
    ("10–30 min", 600, 1800),
    ("30–60 min", 1800, 3600),
    ("1–4 hrs", 3600, 14400),
    ("> 4 hrs", 14400, 10**12),
]
_RISK_BUCKETS = [
    ("1–4", 1, 4),
    ("5–9", 5, 9),
    ("10–24", 10, 24),
    ("25–49", 25, 49),
    ("50+", 50, 10**9),
]


def _col(model, *names):
    cols = model.__table__.columns
    for n in names:
        if n in cols:
            return cols[n]
    return None


# Guaranteed core
T_TEN = Trade.tenant_id
T_SYM = Trade.symbol
T_NET = Trade.net_pnl
T_QTY = Trade.qty
T_OPEN = Trade.open_date
T_CLOSE = Trade.close_date
T_STATUS = Trade.status
T_STOP = Trade.stop_loss

# Optional / resolved safely
T_GROSS = _col(Trade, "gross_pnl", "gross")
T_COMM = _col(Trade, "commission", "commissions", "fees", "total_commission")
T_SWAP = _col(Trade, "swap", "swaps")
T_SIDE = _col(Trade, "side", "direction")
T_TARGET = _col(Trade, "take_profit", "target", "profit_target")
T_ACCT = _col(Trade, "account_id")
T_PB = _col(Trade, "playbook_id")
T_CONF = _col(Trade, "confidence")
T_ETFS = _col(Trade, "entry_timeframe", "timeframe", "entry_tf")
T_XTFS = _col(Trade, "exit_timeframe", "exit_tf")
T_MKT = _col(Trade, "market_type", "asset_type")
T_EXPIRY = _col(Trade, "expiration", "expiry", "days_to_expiry")

A_NAME = _col(Account, "name", "label")
PB_NAME = _col(Playbook, "name")

TRADE_TAGS = Base.metadata.tables.get("trade_tags")

HAS = {
    "gross": T_GROSS is not None,
    "commission": T_COMM is not None,
    "swap": T_SWAP is not None,
    "side": T_SIDE is not None,
    "target": T_TARGET is not None,
    "account": T_ACCT is not None,
    "playbook": T_PB is not None,
    "confidence": T_CONF is not None,
    "entry_tf": T_ETFS is not None,
    "exit_tf": T_XTFS is not None,
    "market": T_MKT is not None,
    "expiry": T_EXPIRY is not None,
    "trade_tags": TRADE_TAGS is not None,
}


def _f(v):
    return None if v is None else round(float(v), 2)


def _pct(w, n):
    return round(w / n * 100, 2) if n else None


def _sec(h):
    return None if h is None else round(float(h), 1)


def _maybe_uuid(s):
    if not s:
        return None
    try:
        return uuid.UUID(str(s))
    except Exception:
        return None


def _sort_key(kind, key):
    if kind in {"dow", "hour", "month", "duration", "risk"}:
        try:
            return (0, int(key))
        except Exception:
            return (1, str(key))
    if kind == "day":
        return (2, str(key))
    return (3, str(key).lower())


def _where_base(tenant_id: uuid.UUID, flt: FiltersIn):
    w = [T_TEN == tenant_id, T_STATUS == "closed", T_CLOSE.is_not(None)]

    if flt.start:
        try:
            w.append(T_CLOSE >= datetime.fromisoformat(flt.start).replace(tzinfo=ET))
        except ValueError:
            pass

    if flt.end:
        try:
            w.append(T_CLOSE <= datetime.fromisoformat(flt.end).replace(tzinfo=ET) + timedelta(days=1))
        except ValueError:
            pass

    if flt.symbols:
        w.append(T_SYM.in_(flt.symbols))

    if flt.sides and T_SIDE is not None:
        w.append(T_SIDE.in_([s.upper() for s in flt.sides]))

    if flt.accounts and T_ACCT is not None:
        ids = []
        for a in flt.accounts:
            u = _maybe_uuid(a)
            if u is not None:
                ids.append(u)
        if ids:
            w.append(T_ACCT.in_(ids))

    return w


def _dim_expr(dimension: str):
    hold = func.extract("epoch", T_CLOSE - T_OPEN)

    if dimension == "day":
        return func.date_trunc("day", T_CLOSE), "day"
    if dimension == "month":
        return func.extract("month", T_CLOSE), "month"
    if dimension == "dow":
        return func.extract("dow", T_CLOSE), "dow"
    if dimension == "hour":
        return func.extract("hour", T_CLOSE), "hour"
    if dimension == "duration":
        return (
            case(
                *[(and_(hold >= lo, hold < hi), i) for i, (_, lo, hi) in enumerate(_DUR_BUCKETS)],
                else_=-1,
            ),
            "duration",
        )
    if dimension == "symbol":
        return T_SYM, "str"
    if dimension == "playbook" and T_PB is not None:
        return T_PB, "playbook"
    if dimension == "risk":
        return (
            case(
                *[(and_(T_QTY >= lo, T_QTY <= hi), i) for i, (_, lo, hi) in enumerate(_RISK_BUCKETS)],
                else_=-1,
            ),
            "risk",
        )
    if dimension == "account" and T_ACCT is not None:
        return T_ACCT, "account"
    if dimension == "confidence" and T_CONF is not None:
        return T_CONF, "str"
    if dimension == "entry_tf" and T_ETFS is not None:
        return T_ETFS, "str"
    if dimension == "exit_tf" and T_XTFS is not None:
        return T_XTFS, "str"
    if dimension == "expiry" and T_EXPIRY is not None:
        return T_EXPIRY, "str"

    return None, None


def _label(kind, key, extra=None):
    if kind == "day":
        if hasattr(key, "strftime"):
            return key.strftime("%a, %b %d, %Y")
        return str(key)
    if kind == "month":
        return _MON[int(key) - 1]
    if kind == "dow":
        return _DOW[int(key)]
    if kind == "hour":
        return f"{int(key):02d}:00"
    if kind == "duration":
        i = int(key)
        return _DUR_BUCKETS[i][0] if 0 <= i < len(_DUR_BUCKETS) else "—"
    if kind == "risk":
        i = int(key)
        return _RISK_BUCKETS[i][0] if 0 <= i < len(_RISK_BUCKETS) else "—"
    if kind in ("playbook", "account"):
        return (extra or {}).get(str(key), "None")
    return str(key) if key is not None else "None"


async def _name_extras(session: AsyncSession, tenant_id: uuid.UUID, dimension: str) -> dict:
    if dimension == "playbook" and PB_NAME is not None:
        rows = (await session.execute(
            select(Playbook.id, PB_NAME).where(Playbook.tenant_id == tenant_id)
        )).all()
        return {str(r[0]): r[1] for r in rows}
    if dimension == "account" and A_NAME is not None:
        rows = (await session.execute(
            select(Account.id, A_NAME).where(Account.tenant_id == tenant_id)
        )).all()
        return {str(r[0]): r[1] for r in rows}
    return {}


async def _bucket_aggregate(session: AsyncSession, tenant_id: uuid.UUID, flt: FiltersIn, dimension: str):
    gexpr, kind = _dim_expr(dimension)
    if gexpr is None:
        return None

    cols = [
        gexpr.label("k"),
        func.count().label("n"),
        func.sum(case((T_NET > 0, 1), else_=0)).label("w"),
        func.sum(case((T_NET < 0, 1), else_=0)).label("l"),
        func.sum(case((T_NET == 0, 1), else_=0)).label("b"),
        func.coalesce(func.sum(T_NET), 0).label("net"),
        func.coalesce(func.sum(T_QTY), 0).label("vol"),
        func.avg(case((T_NET > 0, T_NET))).label("avgw"),
        func.avg(case((T_NET < 0, T_NET))).label("avgl"),
        func.max(T_NET).label("best"),
        func.min(T_NET).label("worst"),
        func.avg(func.extract("epoch", T_CLOSE - T_OPEN)).label("hold"),
    ]
    if T_GROSS is not None:
        cols.append(func.coalesce(func.sum(T_GROSS), 0).label("gross"))

    stmt = select(*cols).where(*_where_base(tenant_id, flt)).group_by(gexpr)
    extras = await _name_extras(session, tenant_id, dimension)
    res = (await session.execute(stmt)).mappings().all()

    out = []
    for r in res:
        n = r["n"] or 0
        out.append(
            BucketRow(
                key=str(r["k"]),
                label=_label(kind, r["k"], extras),
                trades=n,
                wins=r["w"] or 0,
                losses=r["l"] or 0,
                breakeven=r["b"] or 0,
                win_rate=_pct(r["w"] or 0, n),
                net=_f(r["net"]) or 0.0,
                gross=_f(r.get("gross")) if T_GROSS is not None else None,
                avg_win=_f(r["avgw"]),
                avg_loss=_f(r["avgl"]),
                volume=_f(r["vol"]) or 0.0,
                avg_hold_sec=_sec(r["hold"]),
                best=_f(r["best"]),
                worst=_f(r["worst"]),
                avg_r=None,
            )
        )

    out.sort(key=lambda x: _sort_key(kind, x.key))
    return out


def _cards(rows, entity: str):
    if not rows:
        return []

    by_net = sorted(rows, key=lambda r: r.net)
    by_wr = sorted([r for r in rows if r.trades >= 3], key=lambda r: -(r.win_rate or 0))
    by_n = sorted(rows, key=lambda r: -r.trades)

    def card(kind, title, r, tone=None, sub_extra=None):
        if kind in ("best", "worst"):
            value = f"${r.net:,.2f}"
        elif kind == "winrate":
            value = f"{r.win_rate}%"
        else:
            value = str(r.trades)
        return SummaryCard(
            kind=kind,
            title=title,
            label=r.label,
            value=value,
            sub=sub_extra or f"{r.trades} trades",
            tone=tone,
        )

    c = []
    if by_net:
        c.append(card("best", f"Best performing {entity}", by_net[-1], "pos"))
        c.append(card("worst", f"Least performing {entity}", by_net[0], "neg"))
    if by_n:
        c.append(card("active", f"Most active {entity}", by_n[0]))
    if by_wr:
        c.append(card("winrate", f"Best win rate {entity}", by_wr[0], None, f"{by_wr[0].win_rate}% / {by_wr[0].trades} trades"))
    return c


async def _cross(session: AsyncSession, tenant_id: uuid.UUID, flt: FiltersIn, dimA: str, dimB: str, metric: str):
    ga, ka = _dim_expr(dimA)
    gb, kb = _dim_expr(dimB)
    if ga is None or gb is None:
        return {"rows": [], "cols": [], "cells": []}

    stmt = (
        select(
            ga.label("a"),
            gb.label("b"),
            func.count().label("n"),
            func.coalesce(func.sum(T_NET), 0).label("net"),
            func.sum(case((T_NET > 0, 1), else_=0)).label("w"),
        )
        .where(*_where_base(tenant_id, flt))
        .group_by(ga, gb)
    )

    extras_a = await _name_extras(session, tenant_id, dimA)
    extras_b = await _name_extras(session, tenant_id, dimB)
    res = (await session.execute(stmt)).mappings().all()

    rowkeys = sorted({r["a"] for r in res}, key=lambda k: _sort_key(ka, k))
    colkeys = sorted({r["b"] for r in res}, key=lambda k: _sort_key(kb, k))

    cells = []
    for r in res:
        n = r["n"] or 0
        cells.append(
            CrossCell(
                row=_label(ka, r["a"], extras_a),
                col=_label(kb, r["b"], extras_b),
                trades=n,
                net=_f(r["net"]) or 0.0,
                win_rate=_pct(r["w"] or 0, n),
                avg_r=None,
            )
        )

    return {
        "rows": [_label(ka, k, extras_a) for k in rowkeys],
        "cols": [_label(kb, k, extras_b) for k in colkeys],
        "cells": cells,
    }


async def dimension_report(session: AsyncSession, tenant_id: uuid.UUID, flt: FiltersIn, dimension: str):
    if dimension == "tag" and not HAS["trade_tags"]:
        return DimensionOut(
            dimension="tag",
            available=False,
            note=(
                "Per-trade tagging isn’t wired yet. Your notebook tags live in Notebook; "
                "enable trade-tags via a small migration when ready and this report lights up automatically."
            ),
            cards=[],
            series=[],
            table=[],
            cross_rows=[],
            cross_cols=[],
            cross=[],
        )

    rows = await _bucket_aggregate(session, tenant_id, flt, dimension)
    if rows is None:
        return DimensionOut(
            dimension=dimension,
            available=False,
            note="Dimension column not present in schema.",
            cards=[],
            series=[],
            table=[],
            cross_rows=[],
            cross_cols=[],
            cross=[],
        )

    entity = {
        "day": "day",
        "dow": "day",
        "month": "month",
        "hour": "hour slot",
        "duration": "duration",
        "symbol": "symbol",
        "playbook": "playbook",
        "risk": "size bracket",
        "account": "account",
        "confidence": "confidence",
        "entry_tf": "entry timeframe",
        "exit_tf": "exit timeframe",
        "expiry": "expiry window",
        "tag": "tag",
    }.get(dimension, dimension)

    cross_dim_a = "dow" if dimension in ("day", "dow") else dimension
    cross = await _cross(session, tenant_id, flt, cross_dim_a, "hour", "net")

    return DimensionOut(
        dimension=dimension,
        available=True,
        cards=_cards(rows, entity),
        series=rows,
        table=rows,
        cross_rows=cross["rows"],
        cross_cols=cross["cols"],
        cross=cross["cells"],
    )


async def cross(session: AsyncSession, tenant_id: uuid.UUID, flt: FiltersIn, dimA: str, dimB: str, metric: str):
    c = await _cross(session, tenant_id, flt, dimA, dimB, metric)
    return {
        "available": bool(c["rows"]),
        "rows": c["rows"],
        "cols": c["cols"],
        "cells": c["cells"],
        "note": None if c["rows"] else "Pick two available dimensions.",
    }


_PERF_METRICS = {
    "net_cum": ("Net P&L - cumulative", "$"),
    "net_daily": ("Net P&L - daily", "$"),
    "gross_cum": ("Gross P&L - cumulative", "$"),
    "trades": ("Trade count", "#"),
    "win_rate": ("Win %", "%"),
    "avg_win": ("Avg win", "$"),
    "avg_loss": ("Avg loss", "$"),
    "volume": ("Volume", "#"),
    "profit_factor": ("Profit factor", "x"),
    "expectancy": ("Trade expectancy", "$"),
    "max_dd": ("Drawdown", "$"),
    "avg_hold": ("Avg hold time", "s"),
    "win_streak": ("Max win streak", "#"),
    "loss_streak": ("Max loss streak", "#"),
}


def _perf_available(m: str) -> bool:
    if m == "gross_cum":
        return HAS["gross"]
    return True


async def performance(session: AsyncSession, tenant_id: uuid.UUID, flt: FiltersIn, metrics: list[str], gran: str):
    if gran == "week":
        gexpr = func.date_trunc("week", T_CLOSE)
        gkind = "week"
    elif gran == "month":
        gexpr = func.extract("month", T_CLOSE)
        gkind = "month"
    else:
        gexpr = func.date_trunc("day", T_CLOSE)
        gkind = "day"

    cols = [
        gexpr.label("k"),
        func.count().label("n"),
        func.sum(case((T_NET > 0, 1), else_=0)).label("w"),
        func.sum(case((T_NET < 0, 1), else_=0)).label("l"),
        func.coalesce(func.sum(T_NET), 0).label("net"),
        func.coalesce(func.sum(T_QTY), 0).label("vol"),
        func.avg(case((T_NET > 0, T_NET))).label("avgw"),
        func.avg(case((T_NET < 0, T_NET))).label("avgl"),
        func.avg(func.extract("epoch", T_CLOSE - T_OPEN)).label("hold"),
    ]
    if HAS["gross"]:
        cols.append(func.coalesce(func.sum(T_GROSS), 0).label("gross"))

    stmt = select(*cols).where(*_where_base(tenant_id, flt)).group_by(gexpr).order_by(gexpr)
    rows = (await session.execute(stmt)).mappings().all()

    if gkind == "month":
        lab = lambda k: _MON[int(k) - 1]
    else:
        lab = lambda k: k.strftime("%b %d") if hasattr(k, "strftime") else str(k)

    buck = []
    for r in rows:
        n = r["n"] or 0
        buck.append({
            "t": lab(r["k"]),
            "n": n,
            "w": r["w"] or 0,
            "l": r["l"] or 0,
            "net": float(r["net"] or 0),
            "vol": float(r["vol"] or 0),
            "avgw": float(r["avgw"] or 0),
            "avgl": float(r["avgl"] or 0),
            "hold": float(r["hold"] or 0),
            "gross": float(r.get("gross") or 0) if HAS["gross"] else None,
        })

    series = []
    for m in metrics:
        if not _perf_available(m):
            continue

        pts = []
        if m == "net_cum":
            run = 0.0
            for b in buck:
                run += b["net"]
                pts.append({"t": b["t"], "v": _f(run)})
        elif m == "gross_cum":
            run = 0.0
            for b in buck:
                run += (b["gross"] or 0)
                pts.append({"t": b["t"], "v": _f(run)})
        elif m == "net_daily":
            pts = [{"t": b["t"], "v": _f(b["net"])} for b in buck]
        elif m == "trades":
            pts = [{"t": b["t"], "v": float(b["n"])} for b in buck]
        elif m == "win_rate":
            pts = [{"t": b["t"], "v": _pct(b["w"], b["n"])} for b in buck]
        elif m == "avg_win":
            pts = [{"t": b["t"], "v": _f(b["avgw"]) if b["w"] else None} for b in buck]
        elif m == "avg_loss":
            pts = [{"t": b["t"], "v": _f(b["avgl"]) if b["l"] else None} for b in buck]
        elif m == "volume":
            pts = [{"t": b["t"], "v": _f(b["vol"])} for b in buck]
        elif m == "profit_factor":
            pts = []
            for b in buck:
                gw = b["avgw"] * b["w"]
                gl = abs(b["avgl"] * b["l"])
                pts.append({"t": b["t"], "v": round(gw / gl, 2) if gl else None})
        elif m == "expectancy":
            pts = [{"t": b["t"], "v": _f(b["net"] / b["n"]) if b["n"] else None} for b in buck]
        elif m == "avg_hold":
            pts = [{"t": b["t"], "v": _sec(b["hold"])} for b in buck]
        elif m == "max_dd":
            run = 0.0
            peak = 0.0
            dd = 0.0
            for b in buck:
                run += b["net"]
                peak = max(peak, run)
                dd = min(dd, run - peak)
                pts.append({"t": b["t"], "v": _f(dd)})
        else:
            pts = [{"t": b["t"], "v": None} for b in buck]

        lbl, unit = _PERF_METRICS[m]
        series.append(
            MetricSeries(
                metric=m,
                label=lbl,
                unit=unit,
                points=[MetricPoint(t=p["t"], v=p["v"]) for p in pts],
            )
        )

    tn = sum(b["n"] for b in buck)
    tw = sum(b["w"] for b in buck)
    tl = sum(b["l"] for b in buck)
    tnet = sum(b["net"] for b in buck)
    gw = sum(b["avgw"] * b["w"] for b in buck)
    gl = abs(sum(b["avgl"] * b["l"] for b in buck))

    run = 0.0
    peak = 0.0
    mdd = 0.0
    for b in buck:
        run += b["net"]
        peak = max(peak, run)
        mdd = min(mdd, run - peak)

    summary = [
        {"label": "Net P&L", "value": f"${tnet:,.2f}", "tone": "pos" if tnet >= 0 else "neg"},
        {"label": "Win %", "value": f"{_pct(tw, tn) or 0}%", "tone": None},
        {"label": "Profit factor", "value": f"{round(gw / gl, 2)}" if gl else "--", "tone": None},
        {"label": "Trade expectancy", "value": f"${_f(tnet / tn) if tn else 0:,.2f}", "tone": None},
        {"label": "Avg win / loss", "value": f"${_f(gw / tw) if tw else 0:,.2f} / -${_f(gl / tl) if tl else 0:,.2f}", "tone": None},
        {"label": "Max drawdown", "value": f"${mdd:,.2f}", "tone": "neg"},
        {"label": "Logged days", "value": str(len(buck)), "tone": None},
        {"label": "Avg daily P&L", "value": f"${_f(tnet / len(buck)) if buck else 0:,.2f}", "tone": None},
    ]

    return PerformanceOut(series=series, summary=summary)


def _fmt_dur(sec):
    if not sec:
        return "--"
    h = int(sec // 3600)
    m = int((sec % 3600) // 60)
    return f"{h}h {m:02d}m" if h else f"{m}m"


def _kv(label, value, tone=None):
    return {"label": label, "value": value, "tone": tone}


async def _range_stats(session: AsyncSession, tenant_id: uuid.UUID, flt: FiltersIn):
    w = _where_base(tenant_id, flt)
    row = (await session.execute(
        select(
            func.count().label("n"),
            func.sum(case((T_NET > 0, 1), else_=0)).label("w"),
            func.sum(case((T_NET < 0, 1), else_=0)).label("l"),
            func.sum(case((T_NET == 0, 1), else_=0)).label("b"),
            func.coalesce(func.sum(T_NET), 0).label("net"),
            func.coalesce(func.sum(T_QTY), 0).label("vol"),
            func.avg(case((T_NET > 0, T_NET))).label("avgw"),
            func.avg(case((T_NET < 0, T_NET))).label("avgl"),
            func.max(T_NET).label("best"),
            func.min(T_NET).label("worst"),
            func.avg(func.extract("epoch", T_CLOSE - T_OPEN)).label("hold"),
            func.count(func.distinct(func.date_trunc("day", T_CLOSE))).label("days"),
        ).where(*w)
    )).mappings().one()

    daily = await _bucket_aggregate(session, tenant_id, flt, "day") or []
    seq = sorted(daily, key=lambda r: r.key)

    cw = cl = mcw = mcl = 0
    for r in seq:
        if r.net > 0:
            cw += 1
            cl = 0
        elif r.net < 0:
            cl += 1
            cw = 0
        else:
            cw = cl = 0
        mcw = max(mcw, cw)
        mcl = max(mcl, cl)

    run = 0.0
    peak = 0.0
    mdd = 0.0
    for r in seq:
        run += r.net
        peak = max(peak, run)
        mdd = min(mdd, run - peak)

    win_days = sum(1 for r in seq if r.net > 0)
    loss_days = sum(1 for r in seq if r.net < 0)
    be_days = len(seq) - win_days - loss_days

    comm = None
    if T_COMM is not None:
        comm = (await session.execute(
            select(func.coalesce(func.sum(T_COMM), 0)).where(*w)
        )).scalar()

    swap = None
    if T_SWAP is not None:
        swap = (await session.execute(
            select(func.coalesce(func.sum(T_SWAP), 0)).where(*w)
        )).scalar()

    n = row["n"] or 0
    return dict(
        n=n,
        w=row["w"] or 0,
        l=row["l"] or 0,
        b=row["b"] or 0,
        net=float(row["net"] or 0),
        vol=float(row["vol"] or 0),
        avgw=float(row["avgw"] or 0),
        avgl=float(row["avgl"] or 0),
        best=float(row["best"] or 0),
        worst=float(row["worst"] or 0),
        hold=float(row["hold"] or 0),
        days=row["days"] or 0,
        mcw=mcw,
        mcl=mcl,
        mdd=mdd,
        win_days=win_days,
        loss_days=loss_days,
        be_days=be_days,
        comm=comm,
        swap=swap,
        seq=seq,
    )


async def overview(session: AsyncSession, tenant_id: uuid.UUID, flt: FiltersIn):
    s = await _range_stats(session, tenant_id, flt)
    months = await _bucket_aggregate(session, tenant_id, flt, "month") or []
    ms = sorted(months, key=lambda r: r.net)

    best_m = ms[-1] if ms else None
    low_m = ms[0] if ms else None
    avg_m = _f(sum(m.net for m in ms) / len(ms)) if ms else 0

    n = s["n"]
    pf = round((s["avgw"] * s["w"]) / abs(s["avgl"] * s["l"]), 2) if s["l"] and s["avgl"] else None
    exp = _f(s["net"] / n) if n else None

    left = [
        _kv("Total P&L", f"${s['net']:,.2f}", "pos" if s["net"] >= 0 else "neg"),
        _kv("Average daily volume", f"{_f(s['vol'] / s['days']) if s['days'] else 0}"),
        _kv("Average winning trade", f"${s['avgw']:,.2f}", "pos"),
        _kv("Average losing trade", f"${s['avgl']:,.2f}", "neg"),
        _kv("Total number of trades", str(n)),
        _kv("Number of winning trades", str(s["w"]), "pos"),
        _kv("Number of losing trades", str(s["l"]), "neg"),
        _kv("Number of break-even trades", str(s["b"])),
        _kv("Max consecutive wins", str(s["mcw"]), "pos"),
        _kv("Max consecutive losses", str(s["mcl"]), "neg"),
        _kv("Total commissions", f"${s['comm']:,.2f}" if s["comm"] is not None else "--"),
        _kv("Total fees", "--"),
        _kv("Total swap", f"${s['swap']:,.2f}" if s["swap"] is not None else "--"),
        _kv("Largest profit", f"${s['best']:,.2f}", "pos"),
        _kv("Largest loss", f"${s['worst']:,.2f}", "neg"),
        _kv("Average hold time (all)", _fmt_dur(s["hold"])),
        _kv("Average trade P&L", f"${exp:,.2f}" if exp is not None else "--"),
        _kv("Profit factor", f"{pf}" if pf is not None else "--"),
    ]

    open_trades = (await session.execute(
        select(func.count()).where(T_TEN == tenant_id, T_STATUS == "open")
    )).scalar() or 0

    right = [
        _kv("Open trades", str(open_trades)),
        _kv("Total trading days", str(s["days"])),
        _kv("Winning days", str(s["win_days"]), "pos"),
        _kv("Losing days", str(s["loss_days"]), "neg"),
        _kv("Breakeven days", str(s["be_days"])),
        _kv("Logged days", str(s["days"])),
        _kv("Max consecutive winning days", str(s["mcw"]), "pos"),
        _kv("Max consecutive losing days", str(s["mcl"]), "neg"),
        _kv("Average daily P&L", f"${_f(s['net'] / s['days']) if s['days'] else 0:,.2f}"),
        _kv("Average winning day P&L", f"${_f(sum(r.net for r in s['seq'] if r.net > 0) / s['win_days']) if s['win_days'] else 0:,.2f}", "pos"),
        _kv("Average losing day P&L", f"${_f(sum(r.net for r in s['seq'] if r.net < 0) / s['loss_days']) if s['loss_days'] else 0:,.2f}", "neg"),
        _kv("Largest profitable day", f"${max((r.net for r in s['seq']), default=0):,.2f}", "pos"),
        _kv("Largest losing day", f"${min((r.net for r in s['seq']), default=0):,.2f}", "neg"),
        _kv("Trade expectancy", f"${exp:,.2f}" if exp is not None else "--"),
        _kv("Max drawdown", f"${s['mdd']:,.2f}", "neg"),
        _kv("Max drawdown %", f"{_f(s['mdd'] / (s['net'] + abs(s['mdd'])) * 100) if (s['net'] + abs(s['mdd'])) else 0}%"),
        _kv("Average drawdown", "--"),
    ]

    return OverviewOut(
        best_month={"label": best_m.label if best_m else "--", "value": f"${best_m.net:,.2f}" if best_m else "--", "sub": ""},
        lowest_month={"label": low_m.label if low_m else "--", "value": f"${low_m.net:,.2f}" if low_m else "--", "sub": ""},
        avg_month={"label": "Average", "value": f"${avg_m:,.2f}", "sub": "per month"},
        left=left,
        right=right,
    )


async def compare(session: AsyncSession, tenant_id: uuid.UUID, fa: FiltersIn, fb: FiltersIn):
    async def grp(f: FiltersIn):
        s = await _range_stats(session, tenant_id, f)
        n = s["n"]
        curve = []
        run = 0.0
        for r in sorted(s["seq"], key=lambda x: x.key):
            run += r.net
            curve.append(MetricPoint(t=r.label, v=_f(run)))

        stats = [
            _kv("Total P&L", f"${s['net']:,.2f}", "pos" if s["net"] >= 0 else "neg"),
            _kv("Average daily volume", f"{_f(s['vol'] / s['days']) if s['days'] else 0}"),
            _kv("Average winning trade", f"${s['avgw']:,.2f}", "pos"),
            _kv("Average losing trade", f"${s['avgl']:,.2f}", "neg"),
            _kv("Number of winning trades", str(s["w"])),
            _kv("Number of losing trades", str(s["l"])),
            _kv("Total commissions", f"${s['comm']:,.2f}" if s["comm"] is not None else "--"),
            _kv("Max consecutive wins", str(s["mcw"])),
            _kv("Max consecutive losses", str(s["mcl"])),
        ]
        return CompareGroup(stats=stats, win_rate=_pct(s["w"], n), winners=s["w"], losers=s["l"], curve=curve)

    return CompareOut(a=await grp(fa), b=await grp(fb))


async def calendar(session: AsyncSession, tenant_id: uuid.UUID, flt: FiltersIn, month_iso: str):
    y, m = (int(x) for x in month_iso.split("-")[:2])
    start = datetime(y, m, 1, tzinfo=ET)
    end = datetime(y + (1 if m == 12 else 0), (m % 12) + 1, 1, tzinfo=ET)

    f2 = FiltersIn(
        start=start.date().isoformat(),
        end=(end - timedelta(days=1)).date().isoformat(),
        accounts=flt.accounts,
        symbols=flt.symbols,
        playbooks=flt.playbooks,
        sides=flt.sides,
        statuses=flt.statuses,
        pnl_basis=flt.pnl_basis,
    )

    days = await _bucket_aggregate(session, tenant_id, f2, "day") or []
    byday = {d.label.split(", ")[-1]: d for d in days}

    cells = []
    last = pycal.monthrange(y, m)[1]
    for dn in range(1, last + 1):
        key = f"{_MON[m - 1][:3]} {dn:02d}, {y}"
        d = byday.get(key)
        cells.append(
            CalendarDay(
                d=f"{y}-{m:02d}-{dn:02d}",
                net=_f(d.net) if d else 0.0,
                trades=d.trades if d else 0,
                win_rate=d.win_rate if d else None,
            )
        )

    tot = sum(c.net for c in cells)
    td = sum(1 for c in cells if c.trades)
    pos = [c for c in cells if c.net > 0]
    neg = [c for c in cells if c.net < 0]

    return CalendarOut(
        month=month_iso,
        days=cells,
        total=_f(tot),
        trading_days=td,
        best_day={"label": max(pos, key=lambda c: c.net).d, "value": f"${max(pos, key=lambda c: c.net).net:,.2f}"} if pos else None,
        worst_day={"label": min(neg, key=lambda c: c.net).d, "value": f"${min(neg, key=lambda c: c.net).net:,.2f}"} if neg else None,
    )


async def wins_losses(session: AsyncSession, tenant_id: uuid.UUID, flt: FiltersIn):
    w = _where_base(tenant_id, flt)
    g = await _bucket_aggregate(session, tenant_id, flt, "symbol") or []

    rows = []
    for grp_name, cond in (("Winners", T_NET > 0), ("Losers", T_NET < 0), ("Break-even", T_NET == 0)):
        r = (await session.execute(
            select(
                func.count().label("n"),
                func.avg(T_NET).label("a"),
                func.avg(func.extract("epoch", T_CLOSE - T_OPEN)).label("h"),
                func.avg(T_QTY).label("q"),
            ).where(*w, cond)
        )).mappings().one()
        rows.append({
            "group": grp_name,
            "trades": r["n"] or 0,
            "avgPnl": _f(r["a"]),
            "avgHold": _fmt_dur(float(r["h"] or 0)),
            "avgSize": _f(r["q"]),
        })

    return {"available": True, "rows": rows, "bySymbol": g}