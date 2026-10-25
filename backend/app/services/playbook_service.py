import uuid
from collections import defaultdict
from datetime import date

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import NotFoundError
from app.db.models import (
    Account, Execution, MissedTrade, Playbook, PlaybookNote, PlaybookRule,
    PlaybookRuleGroup, PlaybookShare, Trade, TradeRuleMark,
)


def _f(v) -> float:
    return round(float(v), 2)


async def _get_pb(session: AsyncSession, tenant_id: uuid.UUID, pb_id: uuid.UUID) -> Playbook:
    pb = await session.get(Playbook, pb_id)
    if pb is None or pb.tenant_id != tenant_id:
        raise NotFoundError("Playbook not found")
    return pb


async def _closed_trades_for(session: AsyncSession, pb_id: uuid.UUID) -> list[Trade]:
    rows = (await session.execute(
        select(Trade).where(Trade.playbook_id == pb_id, Trade.status == "closed").order_by(Trade.open_date)
    )).scalars().all()
    return list(rows)


def _kpi_block(trades: list[Trade]) -> dict:
    pnls = [_f(t.net_pnl) for t in trades]
    wins = [p for p in pnls if p > 0]
    losses = [p for p in pnls if p < 0]
    gw, gl = sum(wins), abs(sum(losses))
    n = len(pnls)
    return {
        "net_pnl": _f(sum(pnls)),
        "trades": n,
        "win_rate": _f(len(wins) / n * 100) if n else 0.0,
        "profit_factor": round(gw / gl, 2) if gl else 0.0,
        "expectancy": _f(sum(pnls) / n) if n else 0.0,
        "average_winner": _f(gw / len(wins)) if wins else 0.0,
        "average_loser": _f(-gl / len(losses)) if losses else 0.0,
        "largest_profit": _f(max(pnls)) if pnls else 0.0,
        "largest_loss": _f(min(pnls)) if pnls else 0.0,
    }


async def _total_r(session: AsyncSession, trades: list[Trade]) -> float | None:
    total = 0.0
    any_r = False
    for t in trades:
        if t.stop_loss is None:
            continue
        execs = (await session.execute(
            select(Execution).where(Execution.trade_id == t.id).order_by(Execution.executed_at)
        )).scalars().all()
        buys = [e for e in execs if e.side == "buy"]
        if not buys:
            continue
        q = sum(float(e.qty) for e in buys)
        entry = sum(float(e.qty) * float(e.price) for e in buys) / q if q else 0.0
        risk = abs(entry - float(t.stop_loss)) * q
        if risk <= 0:
            continue
        total += float(t.net_pnl) / risk
        any_r = True
    return round(total, 2) if any_r else None


async def list_index(session: AsyncSession, tenant_id: uuid.UUID, scope: str) -> list[dict]:
    pbs = (await session.execute(
        select(Playbook).where(Playbook.tenant_id == tenant_id).order_by(Playbook.created_at)
    )).scalars().all()
    if scope == "shared":
        shared_ids = {r[0] for r in (await session.execute(
            select(PlaybookShare.playbook_id).where(PlaybookShare.tenant_id == tenant_id)
        )).all()}
        pbs = [p for p in pbs if p.id in shared_ids or p.visibility == "shared"]

    trades = (await session.execute(select(Trade).where(Trade.tenant_id == tenant_id))).scalars().all()
    missed = (await session.execute(select(MissedTrade.playbook_id).where(MissedTrade.tenant_id == tenant_id))).scalars().all()
    shares = (await session.execute(select(PlaybookShare.playbook_id).where(PlaybookShare.tenant_id == tenant_id))).scalars().all()
    by_pb: dict[uuid.UUID, list[Trade]] = defaultdict(list)
    for t in trades:
        if t.playbook_id:
            by_pb[t.playbook_id].append(t)
    missed_count: dict[uuid.UUID, int] = defaultdict(int)
    for m in missed:
        missed_count[m] += 1
    share_count: dict[uuid.UUID, int] = defaultdict(int)
    for s in shares:
        share_count[s] += 1

    out = []
    for p in pbs:
        k = _kpi_block([t for t in by_pb[p.id] if t.status == "closed"])
        out.append({
            "id": str(p.id), "name": p.name, "description": p.description, "icon": p.icon,
            "color": p.color, "visibility": p.visibility,
            "trades": k["trades"], "netPnl": k["net_pnl"], "winRate": k["win_rate"],
            "missedTrades": missed_count[p.id], "expectancy": k["expectancy"],
            "sharedCount": share_count[p.id],
        })
    return out


async def _rule_stats(session: AsyncSession, pb_id: uuid.UUID) -> dict[uuid.UUID, dict]:
    rows = (await session.execute(
        select(TradeRuleMark.rule_id, TradeRuleMark.followed, Trade.net_pnl)
        .join(Trade, Trade.id == TradeRuleMark.trade_id)
        .where(Trade.playbook_id == pb_id)
    )).all()
    agg: dict[uuid.UUID, dict] = defaultdict(lambda: {"total": 0, "followed": 0, "pnls": []})
    for rule_id, followed, pnl in rows:
        a = agg[rule_id]
        a["total"] += 1
        if followed:
            a["followed"] += 1
            a["pnls"].append(_f(pnl))
    out: dict[uuid.UUID, dict] = {}
    for rid, a in agg.items():
        pnls = a["pnls"]
        wins = [p for p in pnls if p > 0]
        losses = [p for p in pnls if p < 0]
        gw, gl = sum(wins), abs(sum(losses))
        out[rid] = {
            "follow_rate": _f(a["followed"] / a["total"] * 100) if a["total"] else None,
            "net_pnl": _f(sum(pnls)) if pnls else 0.0,
            "profit_factor": round(gw / gl, 2) if gl else None,
            "win_rate": _f(len(wins) / len(pnls) * 100) if pnls else 0.0,
        }
    return out


async def detail(session: AsyncSession, tenant_id: uuid.UUID, pb_id: uuid.UUID) -> dict:
    pb = await _get_pb(session, tenant_id, pb_id)
    groups = (await session.execute(
        select(PlaybookRuleGroup).where(PlaybookRuleGroup.playbook_id == pb.id).order_by(PlaybookRuleGroup.position)
    )).scalars().all()
    rules = (await session.execute(
        select(PlaybookRule).where(PlaybookRule.playbook_id == pb.id).order_by(PlaybookRule.position)
    )).scalars().all()
    stats = await _rule_stats(session, pb.id)
    by_group: dict[uuid.UUID, list[dict]] = defaultdict(list)
    for r in rules:
        s = stats.get(r.id, {})
        by_group[r.group_id].append({
            "id": str(r.id), "name": r.name, "visibility": r.visibility, "position": r.position,
            "followRate": s.get("follow_rate"), "netPnl": s.get("net_pnl"),
            "profitFactor": s.get("profit_factor"), "winRate": s.get("win_rate"),
        })
    return {
        "id": str(pb.id), "name": pb.name, "description": pb.description, "icon": pb.icon,
        "color": pb.color, "visibility": pb.visibility,
        "groups": [
            {"id": str(g.id), "name": g.name, "position": g.position, "rules": by_group[g.id]}
            for g in groups
        ],
    }


async def overview(session: AsyncSession, tenant_id: uuid.UUID, pb_id: uuid.UUID) -> dict:
    pb = await _get_pb(session, tenant_id, pb_id)
    trades = await _closed_trades_for(session, pb.id)
    k = _kpi_block(trades)
    missed = (await session.execute(
        select(func.count(MissedTrade.id)).where(MissedTrade.playbook_id == pb.id)
    )).scalar() or 0
    marks = (await session.execute(
        select(TradeRuleMark.followed)
        .join(Trade, Trade.id == TradeRuleMark.trade_id)
        .where(Trade.playbook_id == pb.id)
    )).scalars().all()
    rules_followed = _f(sum(1 for m in marks if m) / len(marks) * 100) if marks else None
    total_r = await _total_r(session, trades)

    by_day: dict[date, float] = defaultdict(float)
    for t in trades:
        by_day[t.close_date.date() if t.close_date else t.open_date.date()] += float(t.net_pnl)
    running = 0.0
    cumulative = []
    for d in sorted(by_day):
        running = _f(running + by_day[d])
        cumulative.append({"date": d.strftime("%m/%d/%y"), "value": running})

    # camelCase contract — the frontend reads exactly these keys
    kpis = {
        "netPnl": k["net_pnl"],
        "trades": k["trades"],
        "winRate": k["win_rate"],
        "profitFactor": k["profit_factor"],
        "missedTrades": missed,
        "expectancy": k["expectancy"],
        "rulesFollowed": rules_followed,
        "averageWinner": k["average_winner"],
        "averageLoser": k["average_loser"],
        "largestProfit": k["largest_profit"],
        "largestLoss": k["largest_loss"],
        "totalRMultiple": total_r,
    }
    return {"kpis": kpis, "cumulative": cumulative}


async def executed_rows(session: AsyncSession, tenant_id: uuid.UUID, pb_id: uuid.UUID) -> list[dict]:
    await _get_pb(session, tenant_id, pb_id)
    rows = (await session.execute(
        select(Trade, Account.name)
        .outerjoin(Account, Account.id == Trade.account_id)
        .where(Trade.playbook_id == pb_id)
        .order_by(Trade.open_date.desc())
    )).all()
    out = []
    for t, acct in rows:
        execs = (await session.execute(
            select(Execution).where(Execution.trade_id == t.id).order_by(Execution.executed_at)
        )).scalars().all()
        buys = [e for e in execs if e.side == "buy"]
        sells = [e for e in execs if e.side == "sell"]
        entry = _f(sum(float(e.qty) * float(e.price) for e in buys) / sum(float(e.qty) for e in buys)) if buys else None
        exitp = _f(sum(float(e.qty) * float(e.price) for e in sells) / sum(float(e.qty) for e in sells)) if sells else None
        cost = (entry or 0) * (sum(float(e.qty) for e in buys) or 1)
        out.append({
            "id": str(t.id),
            "openDate": t.open_date.strftime("%m/%d/%Y"),
            "symbol": t.symbol,
            "status": "win" if float(t.net_pnl) > 0 else ("loss" if float(t.net_pnl) < 0 else "break_even"),
            "closeDate": t.close_date.strftime("%m/%d/%Y") if t.close_date else None,
            "entryPrice": entry, "exitPrice": exitp,
            "netPnl": _f(t.net_pnl),
            "netRoi": _f(float(t.net_pnl) / cost * 100) if cost else None,
            "setups": t.setups, "accountName": acct,
        })
    return out


async def missed_rows(session: AsyncSession, tenant_id: uuid.UUID, pb_id: uuid.UUID) -> list[dict]:
    await _get_pb(session, tenant_id, pb_id)
    rows = (await session.execute(
        select(MissedTrade).where(MissedTrade.playbook_id == pb_id).order_by(MissedTrade.open_date.desc())
    )).scalars().all()
    return [
        {
            "id": str(m.id), "openDate": m.open_date.strftime("%m/%d/%Y"), "symbol": m.symbol,
            "status": m.status, "closeDate": m.close_date.strftime("%m/%d/%Y"),
            "entryPrice": _f(m.entry_price), "exitPrice": _f(m.exit_price),
            "netPnl": _f(m.net_pnl), "netRoi": _f(m.net_roi), "setups": m.setups,
        }
        for m in rows
    ]


async def notes_list(session: AsyncSession, tenant_id: uuid.UUID, pb_id: uuid.UUID) -> list[dict]:
    await _get_pb(session, tenant_id, pb_id)
    rows = (await session.execute(
        select(PlaybookNote).where(PlaybookNote.playbook_id == pb_id).order_by(PlaybookNote.created_at)
    )).scalars().all()
    return [
        {
            "id": str(n.id), "title": n.title, "body": n.body,
            "createdAt": n.created_at.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "updatedAt": n.updated_at.strftime("%Y-%m-%dT%H:%M:%SZ"),
        }
        for n in rows
    ]


async def with_rules(session: AsyncSession, tenant_id: uuid.UUID) -> list[dict]:
    pbs = (await session.execute(
        select(Playbook).where(Playbook.tenant_id == tenant_id).order_by(Playbook.name)
    )).scalars().all()
    groups = (await session.execute(
        select(PlaybookRuleGroup).where(PlaybookRuleGroup.tenant_id == tenant_id).order_by(PlaybookRuleGroup.position)
    )).scalars().all()
    rules = (await session.execute(
        select(PlaybookRule).where(PlaybookRule.tenant_id == tenant_id).order_by(PlaybookRule.position)
    )).scalars().all()
    rg: dict[uuid.UUID, list[dict]] = defaultdict(list)
    for r in rules:
        rg[r.group_id].append({"id": str(r.id), "name": r.name, "visibility": r.visibility})
    gp: dict[uuid.UUID, list[dict]] = defaultdict(list)
    for g in groups:
        gp[g.playbook_id].append({"id": str(g.id), "name": g.name, "rules": rg[g.id]})
    return [{"id": str(p.id), "name": p.name, "groups": gp[p.id]} for p in pbs]