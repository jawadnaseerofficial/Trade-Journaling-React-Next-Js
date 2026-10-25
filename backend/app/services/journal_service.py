import uuid
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Execution, JournalDay, Trade


def _f(v) -> float:
    return round(float(v), 2)


def _side_of(execs: list[Execution]) -> str:
    net = sum((e.qty if e.side == "buy" else -e.qty) for e in execs)
    return "long" if net >= 0 else "short"


def _adjusted_cost(execs: list[Execution]) -> float:
    return _f(sum(float(e.qty) * float(e.price) + float(e.commission) + float(e.fee)
                  for e in execs if e.side == "buy"))


def _realized_r(trade: Trade, execs: list[Execution]) -> float | None:
    if trade.stop_loss is None:
        return None
    side = _side_of(execs)
    buys = [e for e in execs if e.side == "buy"]
    entry = (sum(float(e.qty) * float(e.price) for e in buys) / sum(float(e.qty) for e in buys)) if buys else 0.0
    stop = float(trade.stop_loss)
    rpu = (entry - stop) if side == "long" else (stop - entry)
    if rpu <= 0:
        return None
    qty = sum(float(e.qty) for e in execs if e.side == ("buy" if side == "long" else "sell")) or 1.0
    return _f(float(trade.net_pnl) / (rpu * qty))


def _net_roi(trade: Trade, execs: list[Execution]) -> float | None:
    cost = _adjusted_cost(execs)
    return _f(float(trade.net_pnl) / cost * 100) if cost else None


async def build_month(session: AsyncSession, tenant_id: uuid.UUID, month: str) -> dict:
    year, mon = map(int, month.split("-"))
    start = datetime(year, mon, 1, tzinfo=timezone.utc)
    end = datetime(year + (mon == 12), (mon % 12) + 1, 1, tzinfo=timezone.utc)

    trades = list((await session.execute(
        select(Trade).where(Trade.tenant_id == tenant_id, Trade.open_date >= start, Trade.open_date < end)
        .order_by(Trade.open_date.desc())
    )).scalars().all())

    notes = {d.day: d.note for d in (await session.execute(
        select(JournalDay).where(JournalDay.tenant_id == tenant_id, JournalDay.day >= start.date(), JournalDay.day < end.date())
    )).scalars().all()}

    by_day: dict[date, list[Trade]] = defaultdict(list)
    for t in trades:
        by_day[t.open_date.date()].append(t)

    trade_ids = [t.id for t in trades]
    execs_by_trade: dict[uuid.UUID, list[Execution]] = defaultdict(list)
    if trade_ids:
        for e in (await session.execute(
            select(Execution).where(Execution.trade_id.in_(trade_ids)).order_by(Execution.executed_at)
        )).scalars().all():
            execs_by_trade[e.trade_id].append(e)

    days = []
    for d in sorted(by_day.keys(), reverse=True):
        ts = by_day[d]
        execs_all = [e for t in ts for e in execs_by_trade[t.id]]
        wins = [t for t in ts if float(t.net_pnl) > 0]
        losses = [t for t in ts if float(t.net_pnl) < 0]
        gross_win = sum(float(t.net_pnl) for t in wins)
        gross_loss = abs(sum(float(t.net_pnl) for t in losses))
        rows = []
        for t in ts:
            ex = execs_by_trade[t.id]
            rows.append({
                "id": str(t.id),
                "openTime": t.open_date.strftime("%H:%M:%S"),
                "ticker": t.symbol,
                "side": _side_of(ex).upper(),
                "instrument": t.instrument or t.symbol,
                "netPnl": _f(t.net_pnl),
                "netRoi": _net_roi(t, ex),
                "realizedR": _realized_r(t, ex),
                "playbook": t.playbook,
                "tags": t.tags,
            })
        days.append({
            "date": d.isoformat(),
            "label": d.strftime("%a, %b %d, %Y"),
            "netPnl": _f(sum(float(t.net_pnl) for t in ts)),
            "totalTrades": len(ts),
            "winners": len(wins),
            "losers": len(losses),
            "winrate": _f(len(wins) / (len(wins) + len(losses)) * 100) if (wins or losses) else 0.0,
            "grossPnl": _f(gross_win),
            "commissions": _f(sum(float(e.commission) + float(e.fee) for e in execs_all)),
            "volume": _f(sum(float(e.qty) for e in execs_all)),
            "profitFactor": _f(gross_win / gross_loss) if gross_loss else 0.0,
            "hasNote": d in notes and bool(notes[d]),
            "note": notes.get(d),
            "trades": rows,
        })

    return {"month": month, "days": days}