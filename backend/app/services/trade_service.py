import uuid
from collections import deque
from dataclasses import dataclass
from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Execution, Trade


@dataclass
class Exec:
    symbol: str
    side: str
    qty: float
    price: float
    commission: float
    fee: float
    executed_at: datetime

    @property
    def total_cost(self) -> float:
        return self.commission + self.fee


def compute_pnl(execs: list[Exec]) -> tuple[float, str, datetime, datetime | None]:
    """FIFO matching across longs & shorts. Returns (net_pnl, status, opened_at, closed_at)."""
    ordered = sorted(execs, key=lambda e: e.executed_at)
    longs: deque[list] = deque()   # [orig_qty, remaining, price, fee]
    shorts: deque[list] = deque()
    realized = 0.0

    def take_from(queue: deque, side_price: float, side_fee_unit: float, qty: float) -> float:
        nonlocal realized
        rem = qty
        while rem > 1e-9 and queue:
            lot = queue[0]
            matched = min(rem, lot[1])
            lot_fee = lot[3] * (matched / lot[0]) if lot[0] else 0.0
            side_fee = side_fee_unit * matched
            if queue is longs:
                realized += (side_price - lot[2]) * matched - lot_fee - side_fee
            else:
                realized += (lot[2] - side_price) * matched - lot_fee - side_fee
            lot[1] -= matched
            rem -= matched
            if lot[1] <= 1e-9:
                queue.popleft()
        return rem

    for e in ordered:
        fee_unit = e.total_cost / e.qty if e.qty else 0.0
        if e.side == "buy":
            leftover = take_from(shorts, e.price, fee_unit, e.qty)
            if leftover > 1e-9:
                longs.append([e.qty, leftover, e.price, e.total_cost * (leftover / e.qty)])
        else:
            leftover = take_from(longs, e.price, fee_unit, e.qty)
            if leftover > 1e-9:
                shorts.append([e.qty, leftover, e.price, e.total_cost * (leftover / e.qty)])

    open_qty = sum(l[1] for l in longs) + sum(s[1] for s in shorts)
    status = "open" if open_qty > 1e-9 else "closed"
    opened_at = ordered[0].executed_at
    closed_at = ordered[-1].executed_at if status == "closed" else None
    return round(realized, 2), status, opened_at, closed_at


async def create_trade(
    session: AsyncSession,
    *,
    tenant_id: uuid.UUID,
    account_id: uuid.UUID | None,
    symbol: str,
    asset_type: str,
    execs: list[Exec],
) -> Trade:
    net_pnl, status, opened_at, closed_at = compute_pnl(execs)
    total_qty = sum(e.qty for e in execs if e.side == "buy") or sum(e.qty for e in execs)
    trade = Trade(
        tenant_id=tenant_id,
        account_id=account_id,
        symbol=symbol.upper(),
        asset_type=asset_type,
        qty=round(total_qty, 4),
        status=status,
        open_date=opened_at,
        close_date=closed_at,
        net_pnl=net_pnl,
    )
    session.add(trade)
    await session.flush()
    for e in execs:
        session.add(Execution(
            trade_id=trade.id, tenant_id=tenant_id, symbol=symbol.upper(), side=e.side,
            qty=e.qty, price=e.price, commission=e.commission, fee=e.fee, executed_at=e.executed_at,
        ))
    await session.flush()
    return trade