import uuid
from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, File, Form, Query, UploadFile
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user
from app.core.errors import DomainError, NotFoundError
from app.db.models import Account, Execution, Playbook, PlaybookRule, Trade, TradeRuleMark, User
from app.db.session import get_session
from app.schemas.journal import ExecutionIn, TradePatchIn
from app.schemas.playbook import TradePlaybookIn
from app.schemas.replay import ReplayOut
from app.schemas.trade import ImportResultOut, ManualTradeIn, TradeCreatedOut
from app.schemas.trade_log import LinkPlaybookIn, PreviewBatchIn
from app.services import replay_service, trade_log_service
from app.services.csv_import import group_by_symbol, parse_csv
from app.services.trade_service import Exec, compute_pnl, create_trade

router = APIRouter(prefix="/trades")

_TZ_OFFSET = {"US/Eastern": -4.0, "US/Central": -5.0, "US/Mountain": -6.0, "US/Pacific": -7.0, "UTC": 0.0}


def _to_exec(e, offset_hours: float) -> Exec:
    naive = datetime.fromisoformat(f"{e.date}T{e.time}")
    utc = (naive - timedelta(hours=offset_hours)).replace(tzinfo=timezone.utc)
    return Exec(symbol="", side=e.side, qty=e.qty, price=e.price,
                commission=e.commission, fee=e.fee, executed_at=utc)


async def _recompute_trade(session: AsyncSession, trade: Trade) -> None:
    execs = list((await session.execute(
        select(Execution).where(Execution.trade_id == trade.id).order_by(Execution.executed_at)
    )).scalars().all())
    if not execs:
        await session.delete(trade)
        return
    dom = [Exec(symbol=e.symbol, side=e.side, qty=float(e.qty), price=float(e.price),
                commission=float(e.commission), fee=float(e.fee), executed_at=e.executed_at) for e in execs]
    net_pnl, status, opened_at, closed_at = compute_pnl(dom)
    trade.net_pnl = net_pnl
    trade.status = status
    trade.open_date = opened_at
    trade.close_date = closed_at
    trade.qty = round(sum(float(e.qty) for e in execs if e.side == "buy") or sum(float(e.qty) for e in execs), 4)


@router.post("/manual", response_model=TradeCreatedOut, status_code=201)
async def manual(body: ManualTradeIn, session: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    acct = await session.get(Account, uuid.UUID(body.account_id))
    if acct is None or acct.tenant_id != user.tenant_id:
        raise NotFoundError("Account not found")
    offset = _TZ_OFFSET.get(body.timezone, -4.0)
    execs = []
    for e in body.executions:
        ex = _to_exec(e, offset)
        ex.symbol = body.symbol.upper()
        execs.append(ex)
    trade = await create_trade(session, tenant_id=user.tenant_id, account_id=acct.id,
                               symbol=body.symbol, asset_type=body.asset_type, execs=execs)
    await session.commit()
    return TradeCreatedOut(id=str(trade.id), symbol=trade.symbol, status=trade.status,
                           net_pnl=float(trade.net_pnl), executions=len(execs))


@router.post("/import", response_model=ImportResultOut)
async def import_csv(
    account_id: str = Form(...), broker: str = Form("webull"), timezone: str = Form("US/Eastern"),
    file: UploadFile = File(...), session: AsyncSession = Depends(get_session), user: User = Depends(get_current_user),
):
    acct = await session.get(Account, uuid.UUID(account_id))
    if acct is None or acct.tenant_id != user.tenant_id:
        raise NotFoundError("Account not found")
    raw = await file.read()
    try:
        content = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        content = raw.decode("latin-1")
    offset = _TZ_OFFSET.get(timezone, -4.0)
    execs, skipped = parse_csv(content, tz_offset_hours=offset)
    if not execs:
        raise DomainError("No readable trade rows found in this CSV. Check the broker export format.")
    grouped = group_by_symbol(execs)
    n_exec = 0
    for symbol, exs in grouped.items():
        for ex in exs:
            ex.symbol = symbol
        await create_trade(session, tenant_id=user.tenant_id, account_id=acct.id,
                           symbol=symbol, asset_type="stock", execs=exs)
        n_exec += len(exs)
    await session.commit()
    return ImportResultOut(imported_trades=len(grouped), imported_executions=n_exec, skipped_rows=skipped)


@router.get("/log")
async def log(
    page: int = Query(1, ge=1), per_page: int = Query(50, ge=10, le=200),
    status: str | None = None, symbol: str | None = None, setup: str | None = None,
    account_id: str | None = None, date_from: str | None = None, date_to: str | None = None,
    sort: str = Query("openDate"), direction: str = Query("desc", pattern=r"^(asc|desc)$"),
    session: AsyncSession = Depends(get_session), user: User = Depends(get_current_user),
):
    flt = {"status": status, "symbol": symbol, "setup": setup, "account_id": account_id,
           "date_from": date_from, "date_to": date_to}
    return await trade_log_service.build_log(session, user.tenant_id, flt, page, per_page, sort, direction)


@router.get("/preview/{trade_id}")
async def preview(trade_id: str, session: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    return await trade_log_service.preview(session, user.tenant_id, uuid.UUID(trade_id))


@router.post("/preview-batch")
async def preview_batch(body: PreviewBatchIn, session: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    return await trade_log_service.preview_batch(session, user.tenant_id, body.ids)


@router.put("/{trade_id}/playbook-link")
async def playbook_link(trade_id: str, body: LinkPlaybookIn, session: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    """Set ONLY the playbook FK (bulk attach). Never touches rule marks."""
    trade = await session.get(Trade, uuid.UUID(trade_id))
    if trade is None or trade.tenant_id != user.tenant_id:
        raise NotFoundError("Trade not found")
    if body.playbook_id:
        pb = await session.get(Playbook, uuid.UUID(body.playbook_id))
        if pb is None or pb.tenant_id != user.tenant_id:
            raise NotFoundError("Playbook not found")
        trade.playbook_id = pb.id
    else:
        trade.playbook_id = None
    await session.commit()
    return {"ok": True}


@router.get("/for-replay")
async def for_replay(day: str | None = Query(None), session: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    if day:
        d = date.fromisoformat(day)
        start = datetime.combine(d, datetime.min.time(), tzinfo=timezone.utc)
        end = start + timedelta(days=1)
    else:
        today = datetime.now(timezone.utc).date()
        start = datetime.combine(today, datetime.min.time(), tzinfo=timezone.utc)
        end = start + timedelta(days=1)
    t = (await session.execute(
        select(Trade).where(Trade.tenant_id == user.tenant_id, Trade.open_date >= start, Trade.open_date < end)
        .order_by(Trade.open_date.desc()).limit(1)
    )).scalar_one_or_none()
    if t is None and not day:
        month_start = datetime(today.year, today.month, 1, tzinfo=timezone.utc)
        t = (await session.execute(
            select(Trade).where(Trade.tenant_id == user.tenant_id, Trade.open_date >= month_start)
            .order_by(Trade.open_date.desc()).limit(1)
        )).scalar_one_or_none()
    return {"tradeId": str(t.id) if t else None}


@router.get("/by-day")
async def by_day(day: str = Query(...), session: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    d = date.fromisoformat(day)
    start = datetime.combine(d, datetime.min.time(), tzinfo=timezone.utc)
    end = start + timedelta(days=1)
    rows = (await session.execute(
        select(Trade).where(Trade.tenant_id == user.tenant_id, Trade.open_date >= start, Trade.open_date < end)
        .order_by(Trade.open_date)
    )).scalars().all()
    return [
        {"id": str(t.id), "symbol": t.symbol, "instrument": t.instrument or t.symbol, "status": t.status,
         "netPnl": round(float(t.net_pnl), 2), "openDate": t.open_date.strftime("%Y-%m-%dT%H:%M:%SZ")}
        for t in rows
    ]


@router.put("/{trade_id}/playbook")
async def set_playbook(trade_id: str, body: TradePlaybookIn, session: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    trade = await session.get(Trade, uuid.UUID(trade_id))
    if trade is None or trade.tenant_id != user.tenant_id:
        raise NotFoundError("Trade not found")
    if body.playbook_id:
        pb = await session.get(Playbook, uuid.UUID(body.playbook_id))
        if pb is None or pb.tenant_id != user.tenant_id:
            raise NotFoundError("Playbook not found")
        valid = {r[0] for r in (await session.execute(
            select(PlaybookRule.id).where(PlaybookRule.playbook_id == pb.id)
        )).all()}
        trade.playbook_id = pb.id
    else:
        valid = set()
        trade.playbook_id = None
    await session.execute(delete(TradeRuleMark).where(TradeRuleMark.trade_id == trade.id))
    for item in body.rules:
        rid = item.get("ruleId")
        if rid in valid:
            session.add(TradeRuleMark(trade_id=trade.id, rule_id=uuid.UUID(rid),
                                      tenant_id=user.tenant_id, followed=bool(item.get("followed"))))
    await session.commit()
    return {"ok": True}


@router.get("/{trade_id}/replay", response_model=ReplayOut)
async def replay(trade_id: str, interval: str = Query("1m"), session: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    return await replay_service.build_replay(session, user.tenant_id, uuid.UUID(trade_id), interval)


@router.patch("/{trade_id}")
async def patch_trade(trade_id: str, body: TradePatchIn, session: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    trade = await session.get(Trade, uuid.UUID(trade_id))
    if trade is None or trade.tenant_id != user.tenant_id:
        raise NotFoundError("Trade not found")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(trade, k, v)
    await session.commit()
    return {"ok": True}


@router.post("/{trade_id}/executions", status_code=201)
async def add_execution(trade_id: str, body: ExecutionIn, session: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    trade = await session.get(Trade, uuid.UUID(trade_id))
    if trade is None or trade.tenant_id != user.tenant_id:
        raise NotFoundError("Trade not found")
    ex = _to_exec(body, _TZ_OFFSET.get("US/Eastern", -4.0))
    ex.symbol = trade.symbol
    session.add(Execution(trade_id=trade.id, tenant_id=trade.tenant_id, symbol=ex.symbol, side=ex.side,
                          qty=ex.qty, price=ex.price, commission=ex.commission, fee=ex.fee, executed_at=ex.executed_at))
    await session.flush()
    await _recompute_trade(session, trade)
    await session.commit()
    return {"ok": True}


@router.delete("/executions/{execution_id}", status_code=204)
async def delete_execution(execution_id: str, session: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    e = await session.get(Execution, uuid.UUID(execution_id))
    if e is None or e.tenant_id != user.tenant_id:
        raise NotFoundError("Execution not found")
    trade = await session.get(Trade, e.trade_id)
    await session.delete(e)
    await session.flush()
    if trade is not None:
        await _recompute_trade(session, trade)
    await session.commit()