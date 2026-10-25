import uuid
from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import NotFoundError
from app.db.models import BacktestAction, BacktestSession, BacktestShare, Playbook, User
from app.services import backtest_engine as engine
from app.services.market_data import get_candles

_INTERVAL_ORDER = ["1m", "5m", "15m", "1h", "1d"]
_MAX_DAYS = 400


def _dates(start: date, end: date) -> list[date]:
    out, d = [], start
    while d <= end and len(out) < _MAX_DAYS:
        out.append(d); d += timedelta(days=1)
    return out


async def _try_interval(symbol: str, days: list[date], interval: str) -> list[dict]:
    seen: set[int] = set(); out: list[dict] = []
    for d in days:
        try:
            cs = await get_candles(symbol, d, interval)
        except Exception:
            cs = []
        for c in cs or []:
            if c["time"] not in seen:
                seen.add(c["time"]); out.append(c)
    out.sort(key=lambda c: c["time"])
    return out


async def resolve_candles(symbol: str, start: date, end: date, requested: str) -> tuple[list[dict], str]:
    """Fetch the finest interval the range actually supports (Yahoo free-feed ceiling)."""
    days = _dates(start, end)
    idx = _INTERVAL_ORDER.index(requested) if requested in _INTERVAL_ORDER else 0
    for iv in _INTERVAL_ORDER[idx:]:
        cs = await _try_interval(symbol, days, iv)
        if len(cs) >= 2:
            return cs, iv
    return [], requested


async def _get(session: AsyncSession, tenant_id: uuid.UUID, sid: uuid.UUID) -> BacktestSession:
    s = await session.get(BacktestSession, sid)
    if s is None or s.tenant_id != tenant_id:
        raise NotFoundError("Backtest session not found")
    return s


async def list_sessions(session: AsyncSession, tenant_id: uuid.UUID, user_id: uuid.UUID, scope: str) -> list[dict]:
    q = select(BacktestSession).where(BacktestSession.tenant_id == tenant_id).order_by(BacktestSession.created_at.desc())
    rows = list((await session.execute(q)).scalars().all())
    if scope == "shared":
        granted = {r[0] for r in (await session.execute(
            select(BacktestShare.session_id).where(BacktestShare.tenant_id == tenant_id, BacktestShare.user_id == user_id)
        )).all()}
        rows = [r for r in rows if r.visibility == "shared" or r.id in granted]
    pb_names = {}
    pb_ids = {r.playbook_id for r in rows if r.playbook_id}
    if pb_ids:
        for p in (await session.execute(select(Playbook).where(Playbook.id.in_(pb_ids)))).scalars().all():
            pb_names[p.id] = p.name
    out = []
    for s in rows:
        acts = list((await session.execute(
            select(BacktestAction).where(BacktestAction.session_id == s.id)
        )).scalars().all())
        candles, _ = await resolve_candles(s.symbol, s.start_date, s.end_date, s.interval)
        st = engine.session_stats(candles, [{"id": str(a.id), "at_time": a.at_time, "kind": a.kind, "payload": a.payload} for a in acts], float(s.start_balance))
        total = len(candles)
        played = sum(1 for c in candles if s.last_time is None or c["time"] <= s.last_time)
        out.append({
            "id": str(s.id), "name": s.name, "description": s.description, "symbol": s.symbol,
            "assetType": s.asset_type, "interval": s.interval, "visibility": s.visibility,
            "startBalance": float(s.start_balance), "currentBalance": st["currentBalance"],
            "realizedPnl": st["realizedPnl"], "winRate": st["winRate"], "tradeCount": st["tradeCount"],
            "drawdown": st["drawdown"], "completionPct": round(played / total * 100, 1) if total else 0.0,
            "startDate": s.start_date.strftime("%m/%d/%Y"), "endDate": s.end_date.strftime("%m/%d/%Y"),
            "playbookName": pb_names.get(s.playbook_id),
        })
    return out


async def create(session: AsyncSession, tenant_id: uuid.UUID, body) -> BacktestSession:
    s = BacktestSession(
        tenant_id=tenant_id, name=body.name, description=body.description,
        playbook_id=uuid.UUID(body.playbook_id) if body.playbook_id else None,
        asset_type=body.asset_type, symbol=body.symbol.upper(), start_balance=body.start_balance,
        start_date=date.fromisoformat(body.start_date), end_date=date.fromisoformat(body.end_date),
        interval=body.interval,
    )
    session.add(s); await session.commit(); await session.refresh(s)
    return s


async def run_payload(session: AsyncSession, tenant_id: uuid.UUID, sid: uuid.UUID) -> dict:
    s = await _get(session, tenant_id, sid)
    candles, base_iv = await resolve_candles(s.symbol, s.start_date, s.end_date, s.interval)
    acts = list((await session.execute(
        select(BacktestAction).where(BacktestAction.session_id == s.id).order_by(BacktestAction.at_time)
    )).scalars().all())
    return {
        "session": {
            "id": str(s.id), "name": s.name, "description": s.description, "symbol": s.symbol,
            "assetType": s.asset_type, "interval": s.interval, "startBalance": float(s.start_balance),
            "startDate": s.start_date.strftime("%Y-%m-%d"), "endDate": s.end_date.strftime("%Y-%m-%d"),
            "lastTime": s.last_time, "playbookId": str(s.playbook_id) if s.playbook_id else None,
            "visibility": s.visibility,
        },
        "candles": candles,
        "actions": [{"id": str(a.id), "atTime": a.at_time, "kind": a.kind, "payload": a.payload} for a in acts],
        "baseInterval": base_iv,
        "availableFrom": candles[0]["time"] if candles else None,
        "totalCandles": len(candles),
    }


async def add_action(session: AsyncSession, tenant_id: uuid.UUID, sid: uuid.UUID, body) -> None:
    s = await _get(session, tenant_id, sid)
    session.add(BacktestAction(
        id=uuid.UUID(body.id), session_id=s.id, tenant_id=tenant_id,
        at_time=body.at_time, kind=body.kind, payload=body.payload,
    ))
    await session.commit()


async def set_progress(session: AsyncSession, tenant_id: uuid.UUID, sid: uuid.UUID, last_time: int | None) -> None:
    s = await _get(session, tenant_id, sid)
    s.last_time = last_time
    await session.commit()


async def list_shares(session: AsyncSession, tenant_id: uuid.UUID, sid: uuid.UUID) -> list[dict]:
    await _get(session, tenant_id, sid)
    rows = (await session.execute(
        select(BacktestShare.id, BacktestShare.user_id, User.email, User.id)
        .join(User, User.id == BacktestShare.user_id)
        .where(BacktestShare.session_id == sid, BacktestShare.tenant_id == tenant_id)
    )).all()
    # User.email is the same column we joined; resolve display name from the user row
    users = {u.id: u for u in (await session.execute(
        select(User).where(User.id.in_([r[1] for r in rows]))
    )).scalars().all()} if rows else {}
    return [
        {"id": str(r[0]), "userId": str(r[1]), "email": users[r[1]].email if r[1] in users else "",
         "name": (users[r[1]].email.split("@")[0].replace(".", " ").title() if r[1] in users else "Teammate")}
        for r in rows
    ]


async def share_with(session: AsyncSession, tenant_id: uuid.UUID, sid: uuid.UUID, email: str) -> dict:
    s = await _get(session, tenant_id, sid)
    target = (await session.execute(
        select(User).where(User.tenant_id == tenant_id, User.email.ilike(email.strip()))
    )).scalar_one_or_none()
    if target is None:
        raise NotFoundError("No user with that email in this workspace")
    exists = (await session.execute(
        select(BacktestShare).where(BacktestShare.session_id == s.id, BacktestShare.user_id == target.id)
    )).scalar_one_or_none()
    if exists is None:
        session.add(BacktestShare(id=uuid.uuid4(), session_id=s.id, tenant_id=tenant_id, user_id=target.id))
        await session.commit()
    return {"ok": True, "userId": str(target.id)}


async def unshare(session: AsyncSession, tenant_id: uuid.UUID, sid: uuid.UUID, uid: uuid.UUID) -> None:
    await _get(session, tenant_id, sid)
    row = (await session.execute(
        select(BacktestShare).where(BacktestShare.session_id == sid, BacktestShare.user_id == uid, BacktestShare.tenant_id == tenant_id)
    )).scalar_one_or_none()
    if row is not None:
        await session.delete(row)
        await session.commit()