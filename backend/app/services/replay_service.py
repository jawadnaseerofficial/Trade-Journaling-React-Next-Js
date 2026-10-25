import uuid
from datetime import date, datetime, timezone
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Execution, Trade, TradeRuleMark
from app.services.market_data import get_candles


def _f(v) -> float:
    return round(float(v), 2)


def _side_of(execs: list[Execution]) -> str:
    net = sum((e.qty if e.side == "buy" else -e.qty) for e in execs)
    return "long" if net >= 0 else "short"


def _avg_entry(execs: list[Execution]) -> float:
    buys = [e for e in execs if e.side == "buy"]
    if not buys:
        sells = [e for e in execs if e.side == "sell"]
        return float(sells[0].price) if sells else 0.0
    total_q = sum(float(e.qty) for e in buys)
    return (sum(float(e.qty) * float(e.price) for e in buys) / total_q) if total_q else 0.0


def _adjusted_cost(execs: list[Execution]) -> float:
    buys = [e for e in execs if e.side == "buy"]
    cost = sum(float(e.qty) * float(e.price) + float(e.commission) + float(e.fee) for e in buys)
    return round(cost, 2)


def realized_r(trade: Trade, execs: list[Execution]) -> float | None:
    if trade.stop_loss is None or not execs:
        return None
    side = _side_of(execs)
    entry = _avg_entry(execs)
    stop = float(trade.stop_loss)
    risk_per_unit = (entry - stop) if side == "long" else (stop - entry)
    if risk_per_unit <= 0:
        return None
    qty = sum(float(e.qty) for e in execs if e.side == ("buy" if side == "long" else "sell")) or 1.0
    risk = risk_per_unit * qty
    return round(float(trade.net_pnl) / risk, 2) if risk else None


def net_roi(trade: Trade, execs: list[Execution]) -> float | None:
    cost = _adjusted_cost(execs)
    if not cost:
        return None
    return round(float(trade.net_pnl) / cost * 100, 2)


def _containing_candle(candles: list[dict], epoch: int) -> dict | None:
    """Last candle whose time <= epoch; falls back to first/last so a marker always lands on a bucket."""
    if not candles:
        return None
    chosen = None
    for c in candles:
        if c["time"] <= epoch:
            chosen = c
        else:
            break
    return chosen or candles[0]


def _synth_points(trade: Trade, candles: list[dict]) -> list[tuple[int, float, str, float]]:
    """Outcome-only demo rows (no recorded fills): place entry/exit at the REAL market price
    on the trade's own timestamps, anchored to the candles, spread tied out to the booked P&L."""
    qty = float(trade.qty) or 1.0
    pnl = float(trade.net_pnl)
    open_e = int(trade.open_date.timestamp())
    entry_cd = next((c for c in candles if c["time"] >= open_e), candles[0])
    entry = float(entry_cd["close"])
    exit_price = entry + pnl / qty  # (exit-entry)*qty == net_pnl exactly
    if trade.close_date:
        close_e = int(trade.close_date.timestamp())
        exit_cd = next((c for c in reversed(candles) if c["time"] <= close_e), candles[-1])
        exit_time = exit_cd["time"]
    else:
        exit_time = candles[-1]["time"]
    # long assumption for booked-outcome demo rows (buy then sell)
    return [(entry_cd["time"], entry, "buy", qty), (exit_time, exit_price, "sell", qty)]


def build_markers(execs: list[Execution], candles: list[dict], trade: Trade) -> list[dict]:
    """Snap every marker to its containing candle bucket and clamp its price onto that candle's
    high/low, so arrows render on BOTH lightweight-charts (which drops off-bucket times) and the
    simple recharts view (which clips out-of-domain prices)."""
    if not candles:
        return []
    if execs:
        pts = [(int(e.executed_at.timestamp()), float(e.price), e.side, float(e.qty))
               for e in sorted(execs, key=lambda x: x.executed_at)]
    else:
        pts = _synth_points(trade, candles)
    out: list[dict] = []
    for epoch, price, side, qty in pts:
        cd = _containing_candle(candles, epoch)
        if cd is None:
            continue
        clamped = min(max(price, cd["low"]), cd["high"])
        out.append({
            "time": cd["time"],
            "price": round(clamped, 4),
            "side": side,
            "qty": round(qty, 4),
            "label": f"{'BUY' if side == 'buy' else 'SELL'} {round(qty, 2)} @ {round(price, 2)}",
        })
    return out


def compute_running_pnl(execs: list[Execution], candles: list[dict]) -> list[dict]:
    """Mark the open position to each candle close -> cumulative realized+unrealized."""
    if not candles or not execs:
        return []
    ordered = sorted(execs, key=lambda x: x.executed_at)
    pos = 0.0
    cost_basis = 0.0
    fees_paid = 0.0
    realized = 0.0
    ei = 0
    series: list[dict] = []
    for cd in candles:
        t = cd["time"]
        while ei < len(ordered) and int(ordered[ei].executed_at.timestamp()) <= t:
            e = ordered[ei]
            q = float(e.qty) * (1 if e.side == "buy" else -1)
            px = float(e.price)
            fee = float(e.commission) + float(e.fee)
            fees_paid += fee
            if pos == 0 or (pos > 0) == (q > 0):
                pos += q
                cost_basis += q * px
            else:
                closing = min(abs(q), abs(pos))
                avg = cost_basis / pos if pos else 0.0
                realized += (avg - px) * closing if pos > 0 else (px - avg) * closing
                pos += q
                cost_basis = avg * pos if pos else 0.0
            ei += 1
        unreal = 0.0
        if pos != 0:
            avg = cost_basis / pos
            unreal = (cd["close"] - avg) * pos
        series.append({"time": t, "pnl": round(realized + unreal - fees_paid, 2)})
    return series


def compute_mae_mfe(execs: list[Execution], candles: list[dict]) -> dict:
    ordered = sorted(execs, key=lambda x: x.executed_at)
    if not ordered or not candles:
        return {"mae": None, "mfe": None, "entry": None}
    entry_exec = ordered[0]
    entry = float(entry_exec.price)
    side = entry_exec.side
    t0 = int(entry_exec.executed_at.timestamp())
    after = [c for c in candles if c["time"] >= t0]
    if not after:
        return {"mae": 0.0, "mfe": 0.0, "entry": _f(entry)}
    if side == "buy":
        mae = entry - min(c["low"] for c in after)
        mfe = max(c["high"] for c in after) - entry
    else:
        mae = max(c["high"] for c in after) - entry
        mfe = entry - min(c["low"] for c in after)
    return {"mae": _f(max(mae, 0)), "mfe": _f(max(mfe, 0)), "entry": _f(entry)}


async def _execs_for(session: AsyncSession, trade_id: uuid.UUID) -> list[Execution]:
    rows = (await session.execute(
        select(Execution).where(Execution.trade_id == trade_id).order_by(Execution.executed_at)
    )).scalars().all()
    return list(rows)


async def build_replay(session: AsyncSession, tenant_id: uuid.UUID, trade_id: uuid.UUID,
                       interval: str = "1m") -> dict:
    from app.core.errors import NotFoundError
    trade = await session.get(Trade, trade_id)
    if trade is None or trade.tenant_id != tenant_id:
        raise NotFoundError("Trade not found")

    execs = await _execs_for(session, trade.id)
    day = trade.open_date.date()
    candles = await get_candles(trade.symbol, day, interval)

    stmt = select(Trade.id).where(Trade.tenant_id == tenant_id).order_by(Trade.open_date)
    ids = [str(i) for i in (await session.execute(stmt)).scalars().all()]
    cur = str(trade.id)
    idx = ids.index(cur) if cur in ids else -1
    prev_id = ids[idx - 1] if idx > 0 else None
    next_id = ids[idx + 1] if 0 <= idx < len(ids) - 1 else None

    side = _side_of(execs) if execs else "long"
    return {
        "trade": {
            "id": cur,
            "symbol": trade.symbol,
            "instrument": trade.instrument or trade.symbol,
            "assetType": trade.asset_type,
            "status": trade.status,
            "side": side,
            "openDate": trade.open_date.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "closeDate": trade.close_date.strftime("%Y-%m-%dT%H:%M:%SZ") if trade.close_date else None,
            "dayLabel": trade.open_date.strftime("%a, %b %d, %Y"),
            "netPnl": _f(trade.net_pnl),
            "netRoi": net_roi(trade, execs),
            "realizedR": realized_r(trade, execs),
            "plannedR": _f(trade.planned_r) if trade.planned_r is not None else None,
            "adjustedCost": _adjusted_cost(execs),
            "commissionsFees": _f(sum(float(e.commission) + float(e.fee) for e in execs)) if execs else 0.0,
            "optionsTraded": int(sum(float(e.qty) for e in execs if e.side == "buy")) if execs else (int(float(trade.qty)) or 0),
            "note": trade.note,
            "rating": trade.rating,
            "playbook": trade.playbook,
            "tags": trade.tags,
            "setups": trade.setups,
            "mistakes": trade.mistakes,
            "customTags": trade.custom_tags,
            "profitTarget": _f(trade.profit_target) if trade.profit_target is not None else None,
            "stopLoss": _f(trade.stop_loss) if trade.stop_loss is not None else None,
            "initialTarget": _f(trade.initial_target) if trade.initial_target is not None else None,
            "playbookId": str(trade.playbook_id) if trade.playbook_id else None,
            "followedRuleIds": [str(m.rule_id) for m in (await session.execute(
                select(TradeRuleMark).where(TradeRuleMark.trade_id == trade.id, TradeRuleMark.followed.is_(True))
            )).scalars().all()],
        },
        "executions": [
            {
                "id": str(e.id),
                "time": e.executed_at.strftime("%Y-%m-%d %H:%M:%S"),
                "epoch": int(e.executed_at.timestamp()),
                "spread": "Single",
                "instrument": trade.instrument or trade.symbol,
                "side": e.side,
                "qty": _f(e.qty * (1 if e.side == "buy" else -1)),
                "price": _f(e.price),
                "commission": _f(e.commission),
                "fee": _f(e.fee),
                "position": None,
                "adjustedCost": _f(-(float(e.qty) * float(e.price) + float(e.commission) + float(e.fee))) if e.side == "buy" else None,
                "adjustedProceed": _f(float(e.qty) * float(e.price) - float(e.commission) - float(e.fee)) if e.side == "sell" else None,
                "grossPnl": None,
            }
            for e in execs
        ],
        "candles": candles,
        "markers": build_markers(execs, candles, trade),
        "runningPnl": compute_running_pnl(execs, candles),
        "maeMfe": compute_mae_mfe(execs, candles),
        "prevTradeId": prev_id,
        "nextTradeId": next_id,
        "interval": interval,
        "day": day.isoformat(),
    }