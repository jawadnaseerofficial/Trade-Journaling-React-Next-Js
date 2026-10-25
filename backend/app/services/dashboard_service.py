import re
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import DomainError
from app.db.models import Trade
from app.schemas.dashboard import (
    CalendarMonth,
    CumulativePoint,
    DailyPnl,
    DashboardSummary,
    KpiSummary,
    Score,
    ScoreAxis,
    TradeRow,
)

MONTH_RE = re.compile(r"^\d{4}-\d{2}$")


def _f(v: Decimal | float) -> float:
    return round(float(v), 2)


def _utc_now_date():
    return datetime.now(timezone.utc).date()


async def _closed_between(session: AsyncSession, start: datetime, end: datetime) -> list[Trade]:
    stmt = (
        select(Trade)
        .where(Trade.status == "closed", Trade.close_date >= start, Trade.close_date < end)
        .order_by(Trade.close_date.desc())
    )
    return list((await session.execute(stmt)).scalars().all())


def _kpi(trades: list[Trade]) -> KpiSummary:
    pnls = [_f(t.net_pnl) for t in trades]
    wins = [p for p in pnls if p > 0]
    losses = [p for p in pnls if p < 0]
    gross_win, gross_loss = sum(wins), abs(sum(losses))
    n = len(pnls)
    return KpiSummary(
        net_pnl=_f(sum(pnls)),
        trade_expectancy=_f(sum(pnls) / n) if n else 0.0,
        profit_factor=round(gross_win / gross_loss, 2) if gross_loss else 0.0,
        win_rate=round(len(wins) / n * 100, 2) if n else 0.0,
        avg_win=_f(gross_win / len(wins)) if wins else 0.0,
        avg_loss=_f(-gross_loss / len(losses)) if losses else 0.0,
    )


def _score(kpi: KpiSummary) -> Score:
    ratio = abs(kpi.avg_win / kpi.avg_loss) if kpi.avg_loss else 0.0
    win_axis = min(kpi.win_rate, 100.0)
    pf_axis = min(kpi.profit_factor, 10.0) / 10.0 * 100.0
    ratio_axis = min(ratio, 5.0) / 5.0 * 100.0
    value = round(0.4 * win_axis + 0.3 * pf_axis + 0.3 * ratio_axis, 1)
    return Score(
        value=value,
        axes=[
            ScoreAxis(axis="Win %", value=round(win_axis, 1)),
            ScoreAxis(axis="Avg win/loss", value=round(ratio_axis, 1)),
            ScoreAxis(axis="Profit factor", value=round(pf_axis, 1)),
        ],
    )


async def build_calendar(session: AsyncSession, month: str) -> CalendarMonth:
    if not MONTH_RE.match(month):
        raise DomainError("month must be in YYYY-MM format")
    year, mon = map(int, month.split("-"))
    start = datetime(year, mon, 1, tzinfo=timezone.utc)
    end = datetime(year + (mon == 12), (mon % 12) + 1, 1, tzinfo=timezone.utc)

    trades = await _closed_between(session, start, end)
    by_day: dict[int, list[Trade]] = {}
    for t in trades:
        by_day.setdefault(t.close_date.date().day, []).append(t)

    days = [
        DailyPnl(
            date=f"{month}-{d:02d}",
            pnl=_f(sum(x.net_pnl for x in ts)),
            trades=len(ts),
        )
        for d, ts in sorted(by_day.items())
    ]
    return CalendarMonth(month=month, days=days)


async def build_summary(session: AsyncSession) -> DashboardSummary:
    today = _utc_now_date()
    days = [today - timedelta(days=2), today - timedelta(days=1), today]
    start = datetime.combine(days[0], datetime.min.time(), tzinfo=timezone.utc)
    end = datetime.combine(today + timedelta(days=1), datetime.min.time(), tzinfo=timezone.utc)

    trades = await _closed_between(session, start, end)
    kpi = _kpi(trades)

    daily: list[DailyPnl] = []
    cumulative: list[CumulativePoint] = []
    running = 0.0
    for d in days:
        day_trades = [t for t in trades if t.close_date.date() == d]
        pnl = _f(sum(t.net_pnl for t in day_trades))
        running = _f(running + pnl)
        daily.append(DailyPnl(date=d.strftime("%m/%d/%y"), pnl=pnl, trades=len(day_trades)))
        cumulative.append(CumulativePoint(date=d.strftime("%m/%d/%y"), value=running))

    recent = [
        TradeRow(
            id=str(t.id),
            close_date=t.close_date.strftime("%m/%d/%Y"),
            symbol=t.symbol,
            net_pnl=_f(t.net_pnl),
            qty=float(t.qty),
        )
        for t in trades[:5]
    ]

    open_stmt = select(Trade).where(Trade.status == "open").order_by(Trade.open_date.desc())
    open_trades = list((await session.execute(open_stmt)).scalars().all())
    open_positions = [
        TradeRow(id=str(t.id), close_date="—", symbol=t.symbol, net_pnl=_f(t.net_pnl), qty=float(t.qty))
        for t in open_trades
    ]

    last_import = (await session.execute(select(func.max(Trade.created_at)))).scalar()

    return DashboardSummary(
        kpi=kpi,
        score=_score(kpi),
        cumulative=cumulative,
        daily=daily,
        recent_trades=recent,
        open_positions=open_positions,
        calendar=await build_calendar(session, today.strftime("%Y-%m")),
        range_label=f"{days[0]:%b %d, %Y} – {days[-1]:%b %d, %Y}",
        last_import_at=last_import.strftime("%Y-%m-%dT%H:%M:%SZ") if last_import else None,
    )