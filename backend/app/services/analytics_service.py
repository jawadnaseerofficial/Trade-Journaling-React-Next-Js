import math
import os
import random
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import and_, case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.cache import (
    get_data_version,
    get_json,
    make_key,
    set_json,
    stable_hash,
)
from app.db.models import Account, Playbook, Trade
from app.schemas.analytics import (
    AnalyticsOut,
    AttrDim,
    AttrItem,
    Attribution,
    Bucket,
    DistBucket,
    EquityPoint,
    Insight,
    Kpi,
    McBand,
    McPoint,
    MonteCarlo,
    NarrativeBlock,
    RadarScore,
    Regime,
    RegimeCell,
    ScatterPoint,
    Streaks,
    SymbolMonth,
    WaterfallStep,
)
from app.schemas.report import FiltersIn

ET = timezone(timedelta(hours=-5))

_DOW = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
]

_DUR_BUCKETS = [
    ("< 1 min", 0, 60),
    ("1-5 min", 60, 300),
    ("5-10 min", 300, 600),
    ("10-30 min", 600, 1800),
    ("30-60 min", 1800, 3600),
    ("1-4 hrs", 3600, 14400),
    ("> 4 hrs", 14400, None),
]

_DIST_LABELS = [
    "< -1K",
    "-1K to -100",
    "-100 to 0",
    "0",
    "0 to 100",
    "100 to 1K",
    "> 1K",
]

_TRADE_CAP = 5000
_ANALYTICS_CACHE_TTL = int(os.getenv("ANALYTICS_CACHE_TTL") or "60")


def _col(model, *names):
    cols = model.__table__.columns
    for n in names:
        if n in cols:
            return cols[n]
    return None


T_TEN = Trade.tenant_id
T_SYM = Trade.symbol
T_NET = Trade.net_pnl
T_QTY = Trade.qty
T_OPEN = Trade.open_date
T_CLOSE = Trade.close_date
T_STATUS = Trade.status

T_SIDE = _col(Trade, "side", "direction")
T_PB = _col(Trade, "playbook_id")
T_ACCT = _col(Trade, "account_id")
T_STOP = _col(Trade, "stop_loss")
T_TARGET = _col(Trade, "take_profit", "target", "profit_target")
T_REALIZED_R = _col(Trade, "realized_r", "r_multiple", "realized_r_multiple")
T_PLANNED_R = _col(Trade, "planned_r", "planned_r_multiple")
T_COMM = _col(Trade, "commission", "commissions", "fees", "total_commission")

PB_NAME = _col(Playbook, "name")
A_NAME = _col(Account, "name", "label")

HAS = {
    "side": T_SIDE is not None,
    "playbook": T_PB is not None,
    "account": T_ACCT is not None,
    "stop_loss": T_STOP is not None,
    "take_profit": T_TARGET is not None,
    "realized_r": T_REALIZED_R is not None,
    "planned_r": T_PLANNED_R is not None,
    "commission": T_COMM is not None,
}


def _f(v):
    return None if v is None else round(float(v), 2)


def _pct(w, n):
    return round(w / n * 100, 2) if n else None


def _money(v):
    return f"${float(v):,.2f}"


def _kmoney(v):
    a = abs(float(v))
    s = "-" if v < 0 else ""
    if a >= 1_000_000:
        return f"{s}${a / 1_000_000:.1f}M"
    if a >= 1_000:
        return f"{s}${a / 1_000:.1f}K"
    return f"{s}${a:.0f}"


def _clamp(v, lo=0.0, hi=100.0):
    return max(lo, min(hi, float(v)))


def _maybe_uuid(s):
    if not s:
        return None
    try:
        return uuid.UUID(str(s))
    except Exception:
        return None


def _dur_label(sec):
    try:
        sec = float(sec or 0)
    except Exception:
        sec = 0.0

    for name, lo, hi in _DUR_BUCKETS:
        if hi is None:
            if sec >= lo:
                return name
        elif lo <= sec < hi:
            return name

    return "> 4 hrs"


def _duration_case(hold):
    whens = []

    for i, (_, lo, hi) in enumerate(_DUR_BUCKETS):
        if hi is None:
            cond = hold >= lo
        else:
            cond = and_(hold >= lo, hold < hi)

        whens.append((cond, i))

    return case(*whens, else_=-1)


def _where(tenant_id, flt):
    w = [T_TEN == tenant_id, T_STATUS == "closed", T_CLOSE.is_not(None)]

    if flt.start:
        try:
            w.append(T_CLOSE >= datetime.fromisoformat(flt.start).replace(tzinfo=ET))
        except ValueError:
            pass

    if flt.end:
        try:
            w.append(
                T_CLOSE
                <= datetime.fromisoformat(flt.end).replace(tzinfo=ET)
                + timedelta(days=1)
            )
        except ValueError:
            pass

    if flt.symbols:
        w.append(T_SYM.in_(flt.symbols))

    if flt.sides and T_SIDE is not None:
        w.append(T_SIDE.in_([s.upper() for s in flt.sides]))

    if flt.accounts and T_ACCT is not None:
        ids = [u for u in (_maybe_uuid(a) for a in flt.accounts) if u]
        if ids:
            w.append(T_ACCT.in_(ids))

    if flt.playbooks and T_PB is not None:
        ids = [u for u in (_maybe_uuid(p) for p in flt.playbooks) if u]
        if ids:
            w.append(T_PB.in_(ids))

    return w


def _label(kind, key, name_map=None):
    if kind == "month" and hasattr(key, "strftime"):
        return key.strftime("%b %Y")

    if kind == "day" and hasattr(key, "strftime"):
        return key.strftime("%b %d")

    if kind == "hour":
        return f"{int(key):02d}:00"

    if kind == "dow":
        return _DOW[int(key)]

    if kind == "duration":
        try:
            i = int(key)
        except Exception:
            return "--"
        return _DUR_BUCKETS[i][0] if 0 <= i < len(_DUR_BUCKETS) else "--"

    if kind == "playbook":
        return (name_map or {}).get(str(key), "None")

    return str(key) if key is not None else "None"


async def _name_map(session, tenant_id, kind):
    if kind == "playbook" and PB_NAME is not None:
        q = select(Playbook.id, PB_NAME)
        if hasattr(Playbook, "tenant_id"):
            q = q.where(Playbook.tenant_id == tenant_id)
        return {str(r[0]): r[1] for r in (await session.execute(q)).all()}

    if kind == "account" and A_NAME is not None:
        q = select(Account.id, A_NAME)
        if hasattr(Account, "tenant_id"):
            q = q.where(Account.tenant_id == tenant_id)
        return {str(r[0]): r[1] for r in (await session.execute(q)).all()}

    return {}


async def _aggregate(session, tenant_id, flt, dimension):
    hold = func.extract("epoch", T_CLOSE - T_OPEN)

    if dimension == "month":
        g, kind = func.date_trunc("month", T_CLOSE), "month"

    elif dimension == "symbol":
        g, kind = T_SYM, "str"

    elif dimension == "playbook":
        if T_PB is None:
            return []
        g, kind = T_PB, "playbook"

    elif dimension == "hour":
        g, kind = func.extract("hour", T_CLOSE), "hour"

    elif dimension == "dow":
        g, kind = func.extract("dow", T_CLOSE), "dow"

    elif dimension == "duration":
        g = _duration_case(hold)
        kind = "duration"

    else:
        return []

    cols = [
        g.label("k"),
        func.count().label("n"),
        func.coalesce(func.sum(T_NET), 0).label("net"),
        func.sum(case((T_NET > 0, 1), else_=0)).label("w"),
        func.sum(case((T_NET < 0, 1), else_=0)).label("l"),
    ]

    stmt = select(*cols).where(*_where(tenant_id, flt)).group_by(g).order_by(g)

    nm = await _name_map(session, tenant_id, kind)
    res = (await session.execute(stmt)).mappings().all()

    items = []

    for r in res:
        n = r["n"] or 0
        net = _f(r["net"]) or 0.0

        items.append(
            (
                r["k"],
                Bucket(
                    label=_label(kind, r["k"], nm),
                    net=net,
                    trades=n,
                    win_rate=_pct(r["w"] or 0, n),
                    avg=_f(net / n) if n else None,
                ),
            )
        )

    if kind in ("hour", "dow", "duration"):
        items.sort(key=lambda x: int(x[0]))
    elif kind in ("month", "day"):
        items.sort(key=lambda x: x[0])
    else:
        items.sort(key=lambda x: -x[1].net)

    return [b for _, b in items]


async def _daily_rows(session, tenant_id, flt):
    g = func.date_trunc("day", T_CLOSE)

    stmt = (
        select(
            g.label("k"),
            func.count().label("n"),
            func.coalesce(func.sum(T_NET), 0).label("net"),
            func.sum(case((T_NET > 0, 1), else_=0)).label("w"),
            func.sum(case((T_NET < 0, 1), else_=0)).label("l"),
            func.coalesce(func.sum(T_QTY), 0).label("vol"),
            func.avg(func.extract("epoch", T_CLOSE - T_OPEN)).label("hold"),
        )
        .where(*_where(tenant_id, flt))
        .group_by(g)
        .order_by(g)
    )

    return [dict(r) for r in (await session.execute(stmt)).mappings().all()]


async def _totals(session, tenant_id, flt):
    cols = [
        func.count().label("n"),
        func.coalesce(func.sum(T_NET), 0).label("net"),
        func.sum(case((T_NET > 0, 1), else_=0)).label("w"),
        func.sum(case((T_NET < 0, 1), else_=0)).label("l"),
        func.sum(case((T_NET == 0, 1), else_=0)).label("b"),
        func.coalesce(func.sum(case((T_NET > 0, T_NET), else_=0)), 0).label("gp"),
        func.coalesce(func.sum(case((T_NET < 0, -T_NET), else_=0)), 0).label("gl"),
        func.avg(case((T_NET > 0, T_NET))).label("avgw"),
        func.avg(case((T_NET < 0, T_NET))).label("avgl"),
        func.avg(func.extract("epoch", T_CLOSE - T_OPEN)).label("hold"),
        func.count(func.distinct(func.date_trunc("day", T_CLOSE))).label("days"),
    ]

    if T_PB is not None:
        cols.append(func.sum(case((T_PB.is_not(None), 1), else_=0)).label("pb_count"))

    row = (
        await session.execute(select(*cols).where(*_where(tenant_id, flt)))
    ).mappings().one()

    out = dict(row)

    if T_PB is None:
        out["pb_count"] = None

    return out


async def _distribution(session, tenant_id, flt):
    g = case(
        (T_NET < -1000, 0),
        (T_NET < -100, 1),
        (T_NET < 0, 2),
        (T_NET == 0, 3),
        (T_NET <= 100, 4),
        (T_NET <= 1000, 5),
        else_=6,
    )

    stmt = (
        select(
            g.label("k"),
            func.count().label("n"),
            func.coalesce(func.sum(T_NET), 0).label("net"),
        )
        .where(*_where(tenant_id, flt))
        .group_by(g)
        .order_by(g)
    )

    out = []

    for r in (await session.execute(stmt)).mappings().all():
        i = int(r["k"])
        out.append(
            DistBucket(
                label=_DIST_LABELS[i] if 0 <= i < len(_DIST_LABELS) else "--",
                count=r["n"] or 0,
                net=_f(r["net"]) or 0.0,
            )
        )

    return out


async def _scatter(session, tenant_id, flt):
    stmt = (
        select(
            T_NET.label("y"),
            func.extract("epoch", T_CLOSE - T_OPEN).label("x"),
            T_SYM.label("label"),
        )
        .where(*_where(tenant_id, flt))
        .order_by(T_CLOSE.desc())
        .limit(1000)
    )

    out = []

    for r in (await session.execute(stmt)).mappings().all():
        y = _f(r["y"]) or 0.0
        out.append(
            ScatterPoint(
                x=round(float(r["x"] or 0) / 60.0, 1),
                y=y,
                label=str(r["label"] or ""),
                tone="win" if y > 0 else "loss" if y < 0 else "be",
            )
        )

    return out


async def _symbol_monthly(session, tenant_id, flt, symbols):
    top = [s.label for s in symbols[:5]]

    if not top:
        return []

    gm = func.date_trunc("month", T_CLOSE)

    stmt = (
        select(
            T_SYM.label("s"),
            gm.label("m"),
            func.coalesce(func.sum(T_NET), 0).label("net"),
        )
        .where(*_where(tenant_id, flt), T_SYM.in_(top))
        .group_by(T_SYM, gm)
        .order_by(gm)
    )

    bucket = {}

    for r in (await session.execute(stmt)).mappings().all():
        bucket.setdefault(r["m"], {})[str(r["s"])] = _f(r["net"]) or 0.0

    return [
        SymbolMonth(month=m.strftime("%b %Y"), values=bucket[m])
        for m in sorted(bucket)
    ]


async def _trade_rows(session, tenant_id, flt):
    """One ordered per-trade projection reused by Monte Carlo / Regime / Attribution."""

    cols = [
        T_NET.label("net"),
        T_SYM.label("symbol"),
        func.extract("hour", T_CLOSE).label("hour"),
        func.extract("epoch", T_CLOSE - T_OPEN).label("hold"),
    ]

    if T_PB is not None:
        cols.append(T_PB.label("playbook"))

    if T_SIDE is not None:
        cols.append(T_SIDE.label("side"))

    stmt = (
        select(*cols)
        .where(*_where(tenant_id, flt))
        .order_by(T_CLOSE.asc())
        .limit(_TRADE_CAP)
    )

    rows = (await session.execute(stmt)).mappings().all()

    out = []

    for r in rows:
        out.append(
            {
                "net": float(r["net"] or 0),
                "symbol": str(r["symbol"] or "--"),
                "hour": int(r["hour"] or 0),
                "hold": float(r["hold"] or 0),
                "playbook": (
                    str(r["playbook"]) if r.get("playbook") is not None else None
                ),
                "side": (
                    str(r["side"]).upper() if r.get("side") is not None else None
                ),
            }
        )

    return out


def _equity_series(daily):
    run = peak = 0.0
    out = []

    for r in daily:
        net = float(r["net"] or 0)
        run += net
        peak = max(peak, run)

        out.append(
            EquityPoint(
                t=(
                    r["k"].strftime("%b %d")
                    if hasattr(r["k"], "strftime")
                    else str(r["k"])
                ),
                equity=round(run, 2),
                drawdown=round(run - peak, 2),
                daily=round(net, 2),
            )
        )

    return out


def _max_drawdown(equity):
    return min((p.drawdown for p in equity), default=0.0)


def _streaks(daily):
    mw = ml = cw = cl = 0

    for r in daily:
        net = float(r["net"] or 0)

        if net > 0:
            cw += 1
            cl = 0
        elif net < 0:
            cl += 1
            cw = 0
        else:
            cw = cl = 0

        mw = max(mw, cw)
        ml = max(ml, cl)

    cur = cw if cw else cl

    return Streaks(
        max_win=mw,
        max_loss=ml,
        current=cur,
        current_type=("win" if cw else "loss" if cl else "neutral"),
    )


def _risk_adjusted(daily):
    nets = [float(r["net"] or 0) for r in daily]

    if len(nets) < 2:
        return None, None

    mean = sum(nets) / len(nets)
    var = sum((x - mean) ** 2 for x in nets) / (len(nets) - 1)
    std = math.sqrt(var) if var > 0 else 0.0

    down = [min(x, 0.0) for x in nets]
    dvar = sum(d * d for d in down) / len(nets)
    dstd = math.sqrt(dvar) if dvar > 0 else 0.0

    return (
        _f((mean / std) * math.sqrt(252)) if std else None,
        _f((mean / dstd) * math.sqrt(252)) if dstd else None,
    )


def _percentile(sorted_vals, q):
    if not sorted_vals:
        return 0.0

    if len(sorted_vals) == 1:
        return sorted_vals[0]

    idx = q * (len(sorted_vals) - 1)
    lo = int(math.floor(idx))
    hi = min(lo + 1, len(sorted_vals) - 1)
    frac = idx - lo

    return sorted_vals[lo] * (1 - frac) + sorted_vals[hi] * frac


def _monte_carlo(seq):
    n = len(seq)

    if n < 8:
        return None

    sims = max(300, min(2000, 6_000_000 // n))
    rng = random.Random(12345)

    n_points = min(120, n)
    steps = (
        sorted(set(round(i * (n - 1) / (n_points - 1)) for i in range(n_points)))
        if n_points > 1
        else [n - 1]
    )

    cols = [[] for _ in steps]
    finals = []
    maxdds = []
    ever_neg = 0

    base = list(seq)

    for _ in range(sims):
        order = base[:]
        rng.shuffle(order)

        run = peak = 0.0
        mdd = 0.0
        neg = False
        si = 0

        for i, v in enumerate(order):
            run += v

            if run < 0:
                neg = True

            peak = max(peak, run)
            d = run - peak

            if d < mdd:
                mdd = d

            if si < len(steps) and i == steps[si]:
                cols[si].append(round(run, 2))
                si += 1

        finals.append(run)
        maxdds.append(mdd)

        if neg:
            ever_neg += 1

    band = []

    for i, s in enumerate(steps):
        sv = sorted(cols[i])
        band.append(
            McBand(
                step=s,
                p05=round(_percentile(sv, 0.05), 2),
                p25=round(_percentile(sv, 0.25), 2),
                p50=round(_percentile(sv, 0.50), 2),
                p75=round(_percentile(sv, 0.75), 2),
                p95=round(_percentile(sv, 0.95), 2),
            )
        )

    lo = min(maxdds)
    hi = 0.0
    nb = 12
    hist = [0] * nb
    width = (hi - lo) / nb if hi > lo else 1.0

    for d in maxdds:
        b = int((d - lo) / width) if width else 0
        b = max(0, min(nb - 1, b))
        hist[b] += 1

    dd_hist = [
        McPoint(label=_kmoney(lo + width * (i + 0.5)), count=hist[i])
        for i in range(nb)
    ]

    sf = sorted(finals)

    return MonteCarlo(
        sims=sims,
        horizon=n,
        prob_negative=round(ever_neg / sims * 100, 2),
        worst_dd95=round(_percentile(sorted(maxdds), 0.05), 2),
        median_final=round(_percentile(sf, 0.5), 2),
        expected_final=round(sum(finals) / sims, 2),
        band=band,
        dd_hist=dd_hist,
    )


def _regime(seq_nets):
    n = len(seq_nets)

    if n < 12:
        return None

    states = ["W", "L", "B"]
    out = ["W" if v > 0 else "L" if v < 0 else "B" for v in seq_nets]

    counts = {(a, b): 0 for a in states for b in states}

    for i in range(n - 1):
        counts[(out[i], out[i + 1])] += 1

    cells = []

    for a in states:
        row_total = sum(counts[(a, b)] for b in states)

        for b in states:
            c = counts[(a, b)]
            cells.append(
                RegimeCell(
                    frm=a,
                    to=b,
                    count=c,
                    prob=round(c / row_total * 100, 2) if row_total else 0.0,
                )
            )

    win_next = [seq_nets[i + 1] for i in range(n - 1) if out[i] == "W"]
    loss_next = [seq_nets[i + 1] for i in range(n - 1) if out[i] == "L"]

    awe = _f(sum(win_next) / len(win_next)) if win_next else None
    ale = _f(sum(loss_next) / len(loss_next)) if loss_next else None

    tilt = (
        _f((ale or 0) - (awe or 0))
        if (awe is not None and ale is not None)
        else None
    )

    if tilt is None:
        verdict = "Not enough consecutive trades to model regime behavior."
    elif tilt <= -abs(awe or 0) * 0.5 and tilt < 0:
        verdict = (
            "Tilt signature: your trades after a loss are materially worse "
            "than after a win - likely revenge/oversize after losses."
        )
    elif tilt >= abs(awe or 0) * 0.5 and tilt > 0:
        verdict = (
            "Recovery signature: you actually perform better after a loss - "
            "disciplined reset, not tilt."
        )
    else:
        verdict = (
            "Neutral regime: outcome of the next trade is roughly independent "
            "of the previous one."
        )

    return Regime(
        states=states,
        cells=cells,
        after_win_exp=awe,
        after_loss_exp=ale,
        tilt_score=tilt,
        verdict=verdict,
    )


def _attribution(rows, overall_exp):
    if not rows:
        return Attribution(dims=[], waterfall=[], total=0.0)

    total = sum(r["net"] for r in rows)

    def group(keyfn, label):
        agg = {}

        for r in rows:
            k = keyfn(r)
            a = agg.setdefault(k, [0.0, 0])
            a[0] += r["net"]
            a[1] += 1

        items = []

        for k, (val, cnt) in sorted(agg.items(), key=lambda x: -abs(x[1][0])):
            exp = val / cnt if cnt else 0.0
            items.append(
                AttrItem(
                    label=str(k),
                    value=round(val, 2),
                    share=round(val / total * 100, 2) if total else 0.0,
                    exp_delta=(
                        round(exp - overall_exp, 2)
                        if overall_exp is not None
                        else None
                    ),
                )
            )

        return AttrDim(dimension=label, label=label, items=items)

    dims = [
        group(lambda r: r["symbol"], "Symbol"),
        group(lambda r: _dur_label(r["hold"]), "Duration"),
        group(lambda r: f"{r['hour']:02d}:00", "Time of day"),
    ]

    if T_PB is not None:
        dims.append(
            group(
                lambda r: (r["playbook"] or "None")[:8],
                "Playbook",
            )
        )

    if T_SIDE is not None:
        dims.append(group(lambda r: (r["side"] or "--"), "Side"))

    wf_src = dims[0].items[:8] if dims else []

    running = 0.0
    wf = []

    for it in wf_src:
        val = float(it.value)
        start = running
        running += val

        wf.append(
            WaterfallStep(
                label=it.label,
                delta=round(val, 2),
                base=round(min(start, running), 2),
                height=round(abs(val), 2),
                positive=val >= 0,
                cumulative=round(running, 2),
            )
        )

    return Attribution(dims=dims, waterfall=wf, total=round(total, 2))


def _radar(totals, daily, hours, mdd, pf, expectancy, consistency):
    n = totals.get("n") or 0
    net = float(totals.get("net") or 0)
    days = len(daily)
    pos_days = sum(1 for r in daily if float(r["net"] or 0) > 0)

    profitability = 0.0

    if n:
        profitability = _clamp(
            35
            + ((pf - 1) * 35 if pf else 0)
            + (15 if expectancy and expectancy > 0 else -10)
            + (25 if net > 0 else 0)
        )

    cons = _clamp((pos_days / days * 100) if days else 0)

    risk = 100.0
    if mdd < 0:
        risk = _clamp(100 - (abs(mdd) / max(abs(net), 1.0) * 100))

    activity = _clamp((n / 2.0) if n else 0)

    timing = 0.0
    pos_hour = sum(h.net for h in hours if h.net > 0)

    if pos_hour > 0 and hours:
        timing = _clamp(max(h.net for h in hours) / pos_hour * 100)

    discipline = 60.0
    pbc = totals.get("pb_count")

    if n and pbc is not None:
        discipline = _clamp(float(pbc) / n * 100)

    return [
        RadarScore(subject="Profitability", score=round(profitability, 1)),
        RadarScore(subject="Consistency", score=round(cons, 1)),
        RadarScore(subject="Risk Control", score=round(risk, 1)),
        RadarScore(subject="Activity", score=round(activity, 1)),
        RadarScore(subject="Timing", score=round(timing, 1)),
        RadarScore(subject="Discipline", score=round(discipline, 1)),
    ]


def _kpis(totals, daily, mdd, sharpe, consistency):
    n = totals.get("n") or 0
    w = totals.get("w") or 0
    l = totals.get("l") or 0

    net = float(totals.get("net") or 0)
    gp = float(totals.get("gp") or 0)
    gl = float(totals.get("gl") or 0)

    pf = round(gp / gl, 2) if gl else None
    exp = _f(net / n) if n else None
    rec = round(net / abs(mdd), 2) if mdd < 0 else None

    return [
        Kpi(
            label="Net P&L",
            value=_money(net),
            sub=f"{n} closed trades",
            tone="pos" if net >= 0 else "neg",
        ),
        Kpi(
            label="Win Rate",
            value=f"{_pct(w, n) or 0}%",
            sub=f"{w}W / {l}L",
            tone="pos" if w >= l else "neg",
        ),
        Kpi(
            label="Profit Factor",
            value=f"{pf}" if pf is not None else "--",
            sub="Gross win / gross loss",
            tone="pos" if pf and pf >= 1 else "neg" if pf else None,
        ),
        Kpi(
            label="Expectancy",
            value=_money(exp) if exp is not None else "--",
            sub="Per trade",
            tone="pos" if exp and exp > 0 else "neg" if exp is not None else None,
        ),
        Kpi(
            label="Max Drawdown",
            value=_money(mdd),
            sub="Peak-to-trough",
            tone="neg" if mdd < 0 else None,
        ),
        Kpi(
            label="Recovery Factor",
            value=f"{rec}" if rec is not None else "--",
            sub="Net / max DD",
            tone="pos" if rec and rec >= 1 else None,
        ),
        Kpi(
            label="Sharpe Proxy",
            value=f"{sharpe}" if sharpe is not None else "--",
            sub="Daily risk-adjusted",
            tone="pos" if sharpe and sharpe > 0 else None,
        ),
        Kpi(
            label="Consistency",
            value=f"{round(consistency, 1)}%",
            sub="Positive trading days",
            tone="pos" if consistency >= 50 else "neg",
        ),
        Kpi(
            label="Avg Win / Loss",
            value=(
                f"{_money(totals.get('avgw')) if totals.get('avgw') is not None else '--'} / "
                f"{_money(totals.get('avgl')) if totals.get('avgl') is not None else '--'}"
            ),
            sub="Trade-level average",
            tone=None,
        ),
    ]


def _insights(
    symbols,
    playbooks,
    hours,
    dows,
    durations,
    totals,
    mdd,
    consistency,
    streaks,
    mc,
    regime,
):
    out = []
    n = totals.get("n") or 0

    if not n:
        return [
            Insight(
                title="No closed trades yet",
                text="Import or log trades to unlock analytics.",
                tone="neutral",
            )
        ]

    if symbols:
        b = max(symbols, key=lambda x: x.net)
        wr = min(symbols, key=lambda x: x.net)

        if b.net > 0:
            out.append(
                Insight(
                    title="Strongest edge",
                    text=f"{b.label} produced {_money(b.net)} across {b.trades} trades.",
                    tone="pos",
                )
            )

        if wr.net < 0:
            out.append(
                Insight(
                    title="Biggest leak",
                    text=f"{wr.label} cost {_money(wr.net)} across {wr.trades} trades.",
                    tone="neg",
                )
            )

    if playbooks:
        b = max(playbooks, key=lambda x: x.net)
        wr = min(playbooks, key=lambda x: x.net)

        if b.net > 0:
            out.append(
                Insight(
                    title="Best playbook",
                    text=f"{b.label} is your strongest setup with {_money(b.net)}.",
                    tone="pos",
                )
            )

        if wr.net < 0:
            out.append(
                Insight(
                    title="Weakest playbook",
                    text=f"{wr.label} is dragging results with {_money(wr.net)}.",
                    tone="neg",
                )
            )

    if hours:
        b = max(hours, key=lambda x: x.net)
        wr = min(hours, key=lambda x: x.net)

        if b.net > 0:
            out.append(
                Insight(
                    title="Best time window",
                    text=f"{b.label} is your most profitable hour ({_money(b.net)}).",
                    tone="pos",
                )
            )

        if wr.net < 0:
            out.append(
                Insight(
                    title="Danger zone",
                    text=f"{wr.label} is consistently costly ({_money(wr.net)}).",
                    tone="neg",
                )
            )

    if durations:
        rated = [d for d in durations if d.avg is not None]

        if rated:
            bd = max(rated, key=lambda x: x.avg or 0)
            wd = min(rated, key=lambda x: x.avg or 0)

            if bd.avg and bd.avg > 0:
                out.append(
                    Insight(
                        title="Duration edge",
                        text=(
                            f"Holding {bd.label} gives your best average outcome "
                            f"({_money(bd.avg)}/trade)."
                        ),
                        tone="pos",
                    )
                )

            if wd.avg and wd.avg < 0:
                out.append(
                    Insight(
                        title="Duration warning",
                        text=(
                            f"Holding {wd.label} is your weakest bucket "
                            f"({_money(wd.avg)}/trade)."
                        ),
                        tone="neg",
                    )
                )

    if mc:
        out.append(
            Insight(
                title="Sequence risk (Monte Carlo)",
                text=(
                    f"Across {mc.sims:,} re-orderings of your own trades, the path "
                    f"went below zero in {mc.prob_negative}% of runs and the "
                    f"95th-percentile worst drawdown was {_money(mc.worst_dd95)}."
                ),
                tone="neg" if mc.prob_negative >= 50 else "warn",
            )
        )

    if regime and regime.tilt_score is not None:
        out.append(
            Insight(
                title="Regime / tilt",
                text=regime.verdict,
                tone="neg" if regime.tilt_score < 0 else "pos",
            )
        )

    if mdd < 0:
        out.append(
            Insight(
                title="Drawdown behavior",
                text=f"Worst peak-to-trough pullback was {_money(mdd)}.",
                tone="neg",
            )
        )

    if consistency >= 60:
        out.append(
            Insight(
                title="High consistency",
                text=(
                    f"{round(consistency, 1)}% of trading days were positive - "
                    "strong stability."
                ),
                tone="pos",
            )
        )
    elif consistency < 35:
        out.append(
            Insight(
                title="Low consistency",
                text=(
                    f"Only {round(consistency, 1)}% of days positive - "
                    "your curve is choppy."
                ),
                tone="warn",
            )
        )

    if streaks.max_loss >= 5:
        out.append(
            Insight(
                title="Loss cluster risk",
                text=(
                    f"Longest losing streak was {streaks.max_loss} days - "
                    "review sizing there."
                ),
                tone="neg",
            )
        )

    return out[:12]


def _narrative(
    totals,
    kpis,
    symbols,
    playbooks,
    hours,
    durations,
    mc,
    regime,
    consistency,
    mdd,
):
    n = totals.get("n") or 0

    if not n:
        return [
            NarrativeBlock(
                heading="Nothing to read yet",
                body=(
                    "Log or import closed trades and this narrative writes itself "
                    "from your real data."
                ),
                tone="neutral",
            )
        ]

    kv = {k.label: k.value for k in kpis}
    blocks = []

    blocks.append(
        NarrativeBlock(
            heading="The headline",
            body=(
                f"You have closed {n} trades for {_money(float(totals.get('net') or 0))} net, "
                f"a {kv.get('Win Rate', '--')} win rate and a profit factor of "
                f"{kv.get('Profit Factor', '--')}. Expectancy is "
                f"{kv.get('Expectancy', '--')} per trade, which is the single number "
                "that decides whether this edge survives scaling."
            ),
            tone="pos" if float(totals.get("net") or 0) >= 0 else "neg",
        )
    )

    if symbols:
        b = max(symbols, key=lambda x: x.net)
        wr = min(symbols, key=lambda x: x.net)

        blocks.append(
            NarrativeBlock(
                heading="Where your edge lives",
                body=(
                    f"{b.label} is carrying you ({_money(b.net)} over {b.trades} trades). "
                    f"{wr.label} is the opposite ({_money(wr.net)} over {wr.trades}). "
                    "Concentration like this is normal - the question is whether you are "
                    "over-allocating to the winner and tolerating the leak."
                ),
                tone=None,
            )
        )

    if playbooks:
        b = max(playbooks, key=lambda x: x.net)

        blocks.append(
            NarrativeBlock(
                heading="Setup quality",
                body=(
                    f"Your best playbook, {b.label}, netted {_money(b.net)}. "
                    "Treat playbook P&L as a hiring decision: promote the ones with "
                    "positive expectancy and bench the ones that quietly subtract."
                ),
                tone=None,
            )
        )

    if hours or durations:
        h = max(hours, key=lambda x: x.net) if hours else None

        d = None
        if durations:
            rated = [x for x in durations if x.avg is not None]
            if rated:
                d = max(rated, key=lambda x: x.avg or 0)

        seg = []

        if h:
            seg.append(f"{h.label} is your sharpest hour ({_money(h.net)})")

        if d:
            seg.append(
                f"holds of {d.label} carry the best average ({_money(d.avg)}/trade)"
            )

        blocks.append(
            NarrativeBlock(
                heading="Timing and hold",
                body=(
                    ("Your rhythm matters: " + " and ".join(seg) + ".")
                    if seg
                    else "Not enough timing spread yet to characterize."
                ),
                tone=None,
            )
        )

    if mc:
        blocks.append(
            NarrativeBlock(
                heading="Sequence risk",
                body=(
                    f"I re-shuffled your exact trade set {mc.sims:,} ways. The median ending "
                    f"is {_money(mc.median_final)} but the 95th-percentile drawdown reaches "
                    f"{_money(mc.worst_dd95)}, and {mc.prob_negative}% of orderings dipped "
                    "below zero at some point. Same edge, different luck - size so the bad "
                    "ordering does not end you."
                ),
                tone="warn" if mc.prob_negative >= 50 else None,
            )
        )

    if regime and regime.tilt_score is not None:
        blocks.append(
            NarrativeBlock(
                heading="Psychology (regime model)",
                body=regime.verdict,
                tone="neg" if regime.tilt_score < 0 else "pos",
            )
        )

    blocks.append(
        NarrativeBlock(
            heading="Focus for next week",
            body=(
                f"Consistency is {round(consistency, 1)}% positive days and max drawdown "
                f"{_money(mdd)}. Pick the one weakest bucket above and cut it for seven "
                "sessions - removing a leak is faster than adding an edge."
            ),
            tone=None,
        )
    )

    return blocks


async def analyze(session, tenant_id, flt):
    cache_key = None

    try:
        version = await get_data_version(str(tenant_id))
        filter_hash = stable_hash(flt.model_dump(mode="json"))
        cache_key = make_key(
            "analytics",
            "summary",
            str(tenant_id),
            str(version),
            filter_hash,
        )

        cached = await get_json(cache_key)

        if cached is not None:
            return AnalyticsOut.model_validate(cached)
    except Exception:
        cache_key = None

    daily = await _daily_rows(session, tenant_id, flt)
    totals = await _totals(session, tenant_id, flt)

    monthly = await _aggregate(session, tenant_id, flt, "month")
    symbols = await _aggregate(session, tenant_id, flt, "symbol")
    playbooks = await _aggregate(session, tenant_id, flt, "playbook")
    hours = await _aggregate(session, tenant_id, flt, "hour")
    dows = await _aggregate(session, tenant_id, flt, "dow")
    durations = await _aggregate(session, tenant_id, flt, "duration")

    distribution = await _distribution(session, tenant_id, flt)
    scatter = await _scatter(session, tenant_id, flt)
    symbol_monthly = await _symbol_monthly(session, tenant_id, flt, symbols)

    rows = await _trade_rows(session, tenant_id, flt)
    seq = [r["net"] for r in rows]

    equity = _equity_series(daily)
    mdd = _max_drawdown(equity)
    streaks = _streaks(daily)

    sharpe, _sortino = _risk_adjusted(daily)

    n = totals.get("n") or 0
    days = len(daily)
    pos_days = sum(1 for r in daily if float(r["net"] or 0) > 0)
    consistency = (pos_days / days * 100) if days else 0.0

    overall_exp = _f(float(totals.get("net") or 0) / n) if n else None

    gp = float(totals.get("gp") or 0)
    gl = float(totals.get("gl") or 0)
    pf = round(gp / gl, 2) if gl else None

    mc = _monte_carlo(seq)
    regime = _regime(seq)
    attribution = _attribution(rows, overall_exp)

    radar = _radar(totals, daily, hours, mdd, pf, overall_exp, consistency)
    kpis = _kpis(totals, daily, mdd, sharpe, consistency)

    insights = _insights(
        symbols,
        playbooks,
        hours,
        dows,
        durations,
        totals,
        mdd,
        consistency,
        streaks,
        mc,
        regime,
    )

    narrative = _narrative(
        totals,
        kpis,
        symbols,
        playbooks,
        hours,
        durations,
        mc,
        regime,
        consistency,
        mdd,
    )

    meta = {
        "trades": n,
        "days": days,
        "basis": "realized closed trades",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "capabilities": HAS,
        "start": flt.start,
        "end": flt.end,
        "mcCap": _TRADE_CAP,
    }

    result = AnalyticsOut(
        meta=meta,
        kpis=kpis,
        equity=equity,
        monthly=monthly,
        distribution=distribution,
        symbols=symbols,
        symbol_monthly=symbol_monthly,
        playbooks=playbooks,
        hours=hours,
        dows=dows,
        durations=durations,
        scatter=scatter,
        radar=radar,
        streaks=streaks,
        insights=insights,
        monte_carlo=mc,
        regime=regime,
        attribution=attribution,
        narrative=narrative,
    )

    try:
        if cache_key:
            await set_json(
                cache_key,
                result.model_dump(mode="json", by_alias=False),
                _ANALYTICS_CACHE_TTL,
            )
    except Exception:
        pass

    return result