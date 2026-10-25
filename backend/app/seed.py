import asyncio
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import select

from app.db.models import Trade
from app.db.session import SessionLocal

SYMBOLS = ["AMD", "GOOG", "NVDA", "TSLA", "SPY"]

# (days_ago, daily_total, trade_count) — the colored calendar days
PLAN = [
    (3, 105, 4), (4, 101, 5), (5, -248, 6), (6, -241, 4),
    (9, -149, 3), (10, -289, 5), (11, 104, 2), (12, 31, 4), (13, -90, 5),
]


def split_total(total: int, count: int) -> list[int]:
    base, rem = divmod(total, count)
    return [base + (1 if i < rem else 0) for i in range(count)]


def _dt(days_ago: int, hour: int) -> datetime:
    d = datetime.now(timezone.utc).date() - timedelta(days=days_ago)
    return datetime.combine(d, datetime.min.time(), tzinfo=timezone.utc) + timedelta(hours=hour)


async def main() -> None:
    async with SessionLocal() as s:
        if (await s.execute(select(Trade.id).limit(1))).first():
            print("Already seeded — skipping.")
            return

        rows: list[Trade] = []

        # yesterday = the exact 3 trades from the screenshot (+78 / -30 / +81)
        for i, (sym, pnl) in enumerate([("AMD", 78), ("AMD", -30), ("GOOG", 81)]):
            rows.append(Trade(
                symbol=sym, qty=Decimal(10), status="closed",
                open_date=_dt(1, 9 + i), close_date=_dt(1, 10 + i), net_pnl=Decimal(pnl),
            ))

        for days_ago, total, count in PLAN:
            for i, pnl in enumerate(split_total(total, count)):
                rows.append(Trade(
                    symbol=SYMBOLS[i % len(SYMBOLS)], qty=Decimal(5), status="closed",
                    open_date=_dt(days_ago, 9 + i), close_date=_dt(days_ago, 10 + i),
                    net_pnl=Decimal(pnl),
                ))

        # one open position
        rows.append(Trade(
            symbol="NVDA", qty=Decimal(4), status="open",
            open_date=_dt(0, 9), close_date=None, net_pnl=Decimal("42.50"),
        ))

        s.add_all(rows)
        await s.commit()
        print(f"Seeded {len(rows)} trades.")


asyncio.run(main())