import uuid
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import NotFoundError
from app.db.models import (
    BacktestAction, BacktestSession, Execution, NoteFolder, Notebook, NotebookTag, NoteTag, NoteTemplate, Trade,
)

ET = timezone(timedelta(hours=-5))  # EST; DST ignored for bucketing consistency
_SYSTEM = [
    ("Trade Notes", "trade"), ("Daily Journal", "daily"),
    ("Sessions Recap", "recap"), ("Backtesting Session Notes", "backtest"),
]
_BUILTIN_TEMPLATES = [
    ("Pre-Market Prep", "recommended",
     '<h3 class="nt-badge" style="background:#E5484D;color:#fff">PRE-MARKET CHECKLIST ✅</h3>'
     '<div class="nt-todo"><span class="nt-check" contenteditable="false">☐</span><span class="nt-todotext">Check economic calendar</span></div>'
     '<div class="nt-todo"><span class="nt-check" contenteditable="false">☐</span><span class="nt-todotext">Have you been for a run/walk?</span></div>'
     '<p>Personal Focus for Today: What&apos;s your #1 personal goal for today&apos;s session?</p>'
     '<p>What&apos;s 1 thing you&apos;re actively working to improve?</p>'
     '<p>Mindset Check-In: How&apos;s your energy today? (1-10)</p>'
     '<p>What&apos;s the #1 rule you refuse to break today?</p>'
     '<h3 class="nt-badge" style="background:#E5484D;color:#fff">FUTURES 🟥</h3>'
     '<details class="nt-toggle"><summary>ES</summary><div class="nt-togglebody"><p>[GAMEPLAN GOES HERE]</p><p>[IMAGE BELOW]</p></div></details>'
     '<details class="nt-toggle"><summary>NAS100</summary><div class="nt-togglebody"><p>[GAMEPLAN GOES HERE]</p></div></details>'),
    ("All-in-One/Daily", "recommended",
     '<h3 class="nt-badge" style="background:#6D5DE7;color:#fff">DAILY OVERVIEW 📊</h3>'
     '<p>Market condition (trend/range/chop):</p><p>Top 3 setups I&apos;m hunting:</p>'
     '<h3 class="nt-badge" style="background:#12B981;color:#fff">WINS 🏆</h3><p></p>'
     '<h3 class="nt-badge" style="background:#E5484D;color:#fff">LESSONS 🎯</h3><p></p>'),
    ("Weekly Recap", "recommended",
     '<h3 class="nt-badge" style="background:#6D5DE7;color:#fff">WEEKLY RECAP 🗓️</h3>'
     '<p>Best trade of the week:</p><p>Worst execution / rule broken:</p>'
     '<div class="nt-todo"><span class="nt-check" contenteditable="false">☐</span><span class="nt-todotext">Review all tagged mistakes</span></div>'
     '<p>Focus for next week:</p>'),
    ("Daily Game Plan", "recommended",
     '<h3 class="nt-badge" style="background:#F5A524;color:#15162E">GAME PLAN 🎮</h3>'
     '<p>A+ setups today:</p><p>Invalidation levels:</p><p>Max daily loss:</p>'),
    ("Intra-day Check-in", "recommended",
     '<h3 class="nt-badge" style="background:#0EA5E9;color:#fff">MIDDAY CHECK ⏱️</h3>'
     '<div class="nt-todo"><span class="nt-check" contenteditable="false">☐</span><span class="nt-todotext">Still following the plan?</span></div>'
     '<p>Energy / emotion right now (1-10):</p>'),
    ("Trade Recap: Basic", "recommended",
     '<h3 class="nt-badge" style="background:#E5484D;color:#fff">TRADE REVIEW 🔥</h3>'
     '<p><b>Overview:</b></p><p><b>Setup Details:</b></p><p><b>Entry:</b></p>'
     '<p><b>Position Size:</b></p><p><b>Exit:</b></p><p><b>Lesson:</b></p>'),
]


def _f(v) -> float:
    return round(float(v), 2)


def _usd(v) -> str:
    return f"${float(v):,.2f}"


def _esc(s) -> str:
    return (str(s).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;"))


def _maybe_uuid(s) -> uuid.UUID | None:
    if not s:
        return None
    try:
        return uuid.UUID(str(s))
    except Exception:
        return None


def _et_day(ts: datetime) -> date:
    if ts.tzinfo is None:
        ts = ts.replace(tzinfo=timezone.utc)
    return ts.astimezone(ET).date()


def _period_keys(d: date) -> dict:
    iso = d.isocalendar()
    q = (d.month - 1) // 3 + 1
    return {"week": f"{iso[0]}-W{iso[1]:02d}", "month": f"{d.year}-{d.month:02d}", "quarter": f"{d.year}-Q{q}"}


async def _ensure_folders(session: AsyncSession, tenant_id: uuid.UUID) -> None:
    existing = {f.link_type for f in (await session.execute(
        select(NoteFolder).where(NoteFolder.tenant_id == tenant_id, NoteFolder.kind == "system")
    )).scalars().all()}
    add = False
    for pos, (name, lt) in enumerate(_SYSTEM):
        if lt not in existing:
            session.add(NoteFolder(id=uuid.uuid4(), tenant_id=tenant_id, name=name, color="", kind="system", link_type=lt, position=pos))
            add = True
    if add:
        await session.commit()


async def _ensure_templates(session: AsyncSession, tenant_id: uuid.UUID) -> None:
    have = (await session.execute(select(func.count()).select_from(NoteTemplate).where(NoteTemplate.tenant_id == tenant_id))).scalar() or 0
    if have:
        return
    for pos, (name, cat, body) in enumerate(_BUILTIN_TEMPLATES):
        session.add(NoteTemplate(id=uuid.uuid4(), tenant_id=tenant_id, name=name, body_html=body, category=cat, is_builtin=True, position=pos))
    await session.commit()


async def _closed_rows(session: AsyncSession, tenant_id: uuid.UUID) -> list[dict]:
    rows = (await session.execute(
        select(Trade.id, Trade.symbol, Trade.net_pnl, Trade.qty, Trade.close_date)
        .where(Trade.tenant_id == tenant_id, Trade.status == "closed", Trade.close_date.is_not(None))
    )).all()
    out = []
    for tid, sym, pnl, qty, cdate in rows:
        out.append({"id": str(tid), "symbol": sym, "pnl": float(pnl or 0), "qty": float(qty or 0),
                    "day": _et_day(cdate), "ts": cdate})
    return out


async def _all_trades(session: AsyncSession, tenant_id: uuid.UUID) -> list[dict]:
    rows = (await session.execute(
        select(Trade.id, Trade.symbol, Trade.net_pnl, Trade.open_date, Trade.status)
        .where(Trade.tenant_id == tenant_id).order_by(Trade.open_date.desc())
    )).all()
    return [{"id": str(r[0]), "symbol": r[1], "pnl": float(r[2] or 0), "open": r[3], "status": r[4]} for r in rows]


async def _ensure_auto_note(session: AsyncSession, tenant_id: uuid.UUID, folder_id: uuid.UUID | None, link_type: str, link_id: str, title: str) -> Notebook:
    q = (await session.execute(select(Notebook).where(
        Notebook.tenant_id == tenant_id, Notebook.link_type == link_type, Notebook.link_id == link_id
    ))).scalar_one_or_none()
    if q is not None:
        if folder_id and q.folder_id != folder_id:
            q.folder_id = folder_id
        return q
    nb = Notebook(id=uuid.uuid4(), tenant_id=tenant_id, folder_id=folder_id, title=title,
                  body_html="", link_type=link_type, link_id=link_id, source="auto")
    session.add(nb)
    await session.flush()
    return nb


async def _folder_map(session: AsyncSession, tenant_id: uuid.UUID) -> tuple[dict, list]:
    await _ensure_folders(session, tenant_id)
    fs = (await session.execute(select(NoteFolder).where(NoteFolder.tenant_id == tenant_id)
                                .order_by(NoteFolder.position, NoteFolder.created_at))).scalars().all()
    return {f.link_type or f"id:{f.id}": f for f in fs}, fs


async def tree(session: AsyncSession, tenant_id: uuid.UUID) -> dict:
    await _ensure_templates(session, tenant_id)
    _, fs = await _folder_map(session, tenant_id)
    closed = await _closed_rows(session, tenant_id)
    trades = await _all_trades(session, tenant_id)
    days = {r["day"] for r in closed}
    # FIX (was: {_period_keys(d) for d in days} -> unhashable dict). Collect distinct unit:key STRINGS,
    # matching exactly the link_id _materialize_system creates, so the badge == the rows you'll see.
    recap_keys: set[str] = set()
    for d in days:
        pk = _period_keys(d)
        for unit in ("week", "month", "quarter"):
            recap_keys.add(f"{unit}:{pk[unit]}")
    bt_sessions = (await session.execute(
        select(func.count()).select_from(BacktestSession).where(BacktestSession.tenant_id == tenant_id)
    )).scalar() or 0
    counts = {"trade": len(trades), "daily": len(days), "recap": len(recap_keys), "backtest": bt_sessions}
    folders = []
    for f in fs:
        if f.kind == "system":
            cnt = counts.get(f.link_type, 0)
        else:
            cnt = (await session.execute(
                select(func.count()).select_from(Notebook).where(
                    Notebook.tenant_id == tenant_id, Notebook.folder_id == f.id, Notebook.deleted_at.is_(None))
            )).scalar() or 0
        folders.append({"id": str(f.id), "name": f.name, "color": f.color, "kind": f.kind,
                        "link_type": f.link_type, "count": cnt})
    tags = (await session.execute(
        select(NoteTag.id, NoteTag.name, func.count(NotebookTag.notebook_id).label("c"))
        .join(NotebookTag, NotebookTag.tag_id == NoteTag.id, isouter=True)
        .where(NoteTag.tenant_id == tenant_id).group_by(NoteTag.id, NoteTag.name).order_by(NoteTag.name)
    )).all()
    deleted = (await session.execute(select(func.count()).select_from(Notebook).where(
        Notebook.tenant_id == tenant_id, Notebook.deleted_at.is_not(None)))).scalar() or 0
    allc = (await session.execute(select(func.count()).select_from(Notebook).where(
        Notebook.tenant_id == tenant_id, Notebook.deleted_at.is_(None)))).scalar() or 0
    return {"folders": folders, "tags": [{"id": str(t[0]), "name": t[1], "count": t[2]} for t in tags],
            "deleted_count": deleted, "all_count": allc}


async def _materialize_system(session: AsyncSession, tenant_id: uuid.UUID, link_type: str) -> list[Notebook]:
    fm, _ = await _folder_map(session, tenant_id)
    folder = fm.get(link_type)
    fid = folder.id if folder else None
    out: list[Notebook] = []
    if link_type == "trade":
        for t in await _all_trades(session, tenant_id):
            title = f"{t['symbol']} : {t['open'].astimezone(ET).strftime('%b %d, %Y')}"
            out.append(await _ensure_auto_note(session, tenant_id, fid, "trade", t["id"], title))
    elif link_type == "daily":
        for d in sorted({r["day"] for r in await _closed_rows(session, tenant_id)}):
            out.append(await _ensure_auto_note(session, tenant_id, fid, "daily", d.isoformat(), d.strftime("%a, %b %d, %Y")))
    elif link_type == "recap":
        buckets: dict[str, set] = defaultdict(set)
        for r in await _closed_rows(session, tenant_id):
            pk = _period_keys(r["day"])
            for unit in ("week", "month", "quarter"):
                buckets[unit].add(pk[unit])
        for unit, keys in buckets.items():
            for k in sorted(keys):
                out.append(await _ensure_auto_note(session, tenant_id, fid, "recap", f"{unit}:{k}", f"{unit.title()} recap · {k}"))
    elif link_type == "backtest":
        for s in (await session.execute(select(BacktestSession).where(BacktestSession.tenant_id == tenant_id))).scalars().all():
            note_count = (await session.execute(select(func.count()).select_from(BacktestAction).where(
                BacktestAction.session_id == s.id, BacktestAction.kind == "note"))).scalar() or 0
            if note_count:
                out.append(await _ensure_auto_note(session, tenant_id, fid, "backtest", str(s.id), f"{s.symbol} · {s.name}"))
    await session.commit()
    return out


async def list_notes(session: AsyncSession, tenant_id: uuid.UUID, folder: str, q: str | None, tag: str | None) -> list[dict]:
    if folder in ("trade", "daily", "recap", "backtest"):
        rows = await _materialize_system(session, tenant_id, folder)
        nbs = [r for r in rows if r.deleted_at is None]
    elif folder == "all":
        nbs = list((await session.execute(select(Notebook).where(
            Notebook.tenant_id == tenant_id, Notebook.deleted_at.is_(None)).order_by(Notebook.updated_at.desc()))).scalars().all())
    elif folder == "deleted":
        nbs = list((await session.execute(select(Notebook).where(
            Notebook.tenant_id == tenant_id, Notebook.deleted_at.is_not(None)).order_by(Notebook.deleted_at.desc()))).scalars().all())
    else:
        fid = _maybe_uuid(folder)
        nbs = [] if fid is None else list((await session.execute(select(Notebook).where(
            Notebook.tenant_id == tenant_id, Notebook.folder_id == fid, Notebook.deleted_at.is_(None))
            .order_by(Notebook.updated_at.desc()))).scalars().all())

    if tag:
        tagged = {r[0] for r in (await session.execute(select(NotebookTag.notebook_id).join(NoteTag, NoteTag.id == NotebookTag.tag_id)
                    .where(NoteTag.tenant_id == tenant_id, NoteTag.name == tag))).all()}
        nbs = [n for n in nbs if n.id in tagged]
    if q:
        ql = q.lower()
        nbs = [n for n in nbs if ql in (n.title or "").lower() or ql in (n.body_html or "").lower()]

    previews: dict[str, float | None] = {}
    trade_pnl: dict[str, float] = {}
    tids = [n.link_id for n in nbs if n.link_type == "trade" and n.link_id]
    if tids:
        for tid, pnl in (await session.execute(select(Trade.id, Trade.net_pnl).where(Trade.id.in_([uuid.UUID(x) for x in tids])))).all():
            trade_pnl[str(tid)] = float(pnl or 0)
    closed = None
    if any(n.link_type in ("daily", "recap") for n in nbs):
        closed = await _closed_rows(session, tenant_id)
    for n in nbs:
        if n.link_type == "trade":
            previews[str(n.id)] = trade_pnl.get(n.link_id or "")
        elif n.link_type == "daily" and closed is not None:
            d = date.fromisoformat(n.link_id or "1970-01-01")
            previews[str(n.id)] = _f(sum(r["pnl"] for r in closed if r["day"] == d))
        elif n.link_type == "recap" and closed is not None:
            unit, _, key = (n.link_id or ":").partition(":")
            previews[str(n.id)] = _f(sum(r["pnl"] for r in closed if _period_keys(r["day"]).get(unit) == key))
        else:
            previews[str(n.id)] = None
    shares: dict[str, int] = defaultdict(int)
    ids = [n.id for n in nbs]
    if ids:
        for nid, c in (await session.execute(select(NotebookTag.notebook_id, func.count()).where(
            NotebookTag.notebook_id.in_(ids)).group_by(NotebookTag.notebook_id))).all():
            shares[str(nid)] = c
    return [{"id": str(n.id), "title": n.title, "folderId": str(n.folder_id) if n.folder_id else None,
             "linkType": n.link_type, "linkId": n.link_id, "source": n.source, "starred": bool(n.starred),
             "shares": shares.get(str(n.id), 0), "netPnl": previews.get(str(n.id)), "subtitle": None,
             "updatedAt": n.updated_at.astimezone(ET).strftime("%m/%d/%Y")} for n in nbs]


def _exec_stats(execs: list[Execution]) -> dict:
    buys = [e for e in execs if e.side == "buy"]; sells = [e for e in execs if e.side == "sell"]
    def avg(rows):
        qq = sum(float(e.qty) for e in rows)
        return (sum(float(e.qty) * float(e.price) for e in rows) / qq) if qq else None
    entry = avg(buys) or avg(sells); exitp = avg(sells) if buys else avg(buys)
    net_q = sum(float(e.qty) for e in buys) - sum(float(e.qty) for e in sells)
    return {"entry": entry, "exit": exitp, "side": "LONG" if net_q >= 0 else "SHORT",
            "volume": _f(sum(float(e.qty) for e in buys) or 0),
            "entryTime": min((e.executed_at for e in execs), default=None),
            "exitTime": max((e.executed_at for e in execs), default=None)}


async def _trade_detail(session: AsyncSession, tenant_id: uuid.UUID, nb: Notebook) -> dict:
    tid = _maybe_uuid(nb.link_id)
    t = await session.get(Trade, tid) if tid else None
    stats: list[dict] = []; chart: list[dict] = []; tids: list[str] = []
    headline = float(t.net_pnl) if t else None
    if t:
        ex = list((await session.execute(select(Execution).where(Execution.trade_id == t.id).order_by(Execution.executed_at))).scalars().all())
        s = _exec_stats(ex)
        cost = (s["entry"] or 0) * (s["volume"] or 1)
        roi = _f(float(t.net_pnl) / cost * 100) if cost else None
        r = None
        if t.stop_loss is not None and s["entry"]:
            stop = float(t.stop_loss); rpu = (s["entry"] - stop) if s["side"] == "LONG" else (stop - s["entry"])
            if rpu > 0: r = _f(float(t.net_pnl) / (rpu * (s["volume"] or 1)))
        stats = [
            {"label": "Side", "value": s["side"], "tone": "pos" if s["side"] == "LONG" else "neg"},
            {"label": "Volume", "value": f'{s["volume"]}', "tone": None},
            {"label": "Commissions", "value": "--", "tone": None},          # not stored -> honest --
            {"label": "Net ROI", "value": f'{roi}%' if roi is not None else "--", "tone": None},
            {"label": "Gross P&L", "value": _usd(float(t.net_pnl)), "tone": None},
            {"label": "Entry", "value": f'{round(s["entry"],4)}' if s["entry"] else "--", "tone": None},
            {"label": "Exit", "value": f'{round(s["exit"],4)}' if s["exit"] else "--", "tone": None},
            {"label": "Realized R", "value": f'{r}R' if r is not None else "--", "tone": "pos" if (r or 0) >= 0 else "neg"},
            {"label": "MAE / MFE", "value": "--", "tone": None},            # needs market data -> live on Replay
            {"label": "Entry time", "value": s["entryTime"].astimezone(ET).strftime("%H:%M:%S") if s["entryTime"] else "--", "tone": None},
            {"label": "Exit time", "value": s["exitTime"].astimezone(ET).strftime("%H:%M:%S") if s["exitTime"] else "--", "tone": None},
        ]
        tids = [str(t.id)]
    return {"stats": stats, "chart": chart, "tradeIds": tids, "headlinePnl": headline, "readonly": False}


async def _daily_detail(session: AsyncSession, tenant_id: uuid.UUID, nb: Notebook) -> dict:
    target = date.fromisoformat(nb.link_id or "1970-01-01")
    closed = [r for r in await _closed_rows(session, tenant_id) if r["day"] == target]
    wins = [r for r in closed if r["pnl"] > 0]; losses = [r for r in closed if r["pnl"] < 0]
    gw = sum(r["pnl"] for r in wins); gl = abs(sum(r["pnl"] for r in losses)); n = len(closed)
    seq = sorted(closed, key=lambda r: r["ts"]); run = 0.0; chart = []
    for r in seq:
        run = _f(run + r["pnl"]); chart.append({"date": r["ts"].astimezone(ET).strftime("%H:%M"), "value": run})
    stats = [
        {"label": "Total trades", "value": str(n), "tone": None},
        {"label": "Winners", "value": str(len(wins)), "tone": "pos"},
        {"label": "Losers", "value": str(len(losses)), "tone": "neg"},
        {"label": "Winrate", "value": f'{_f(len(wins)/n*100)}%' if n else "--", "tone": None},
        {"label": "Gross P&L", "value": _usd(gw), "tone": "pos"},
        {"label": "Commissions", "value": "--", "tone": None},
        {"label": "Volume", "value": f'{_f(sum(r["qty"] for r in closed))}', "tone": None},
        {"label": "Profit factor", "value": f'{round(gw/gl,2)}' if gl else "--", "tone": None},
    ]
    return {"stats": stats, "chart": chart, "tradeIds": [r["id"] for r in closed], "headlinePnl": _f(sum(r["pnl"] for r in closed)), "readonly": False}


async def _recap_detail(session: AsyncSession, tenant_id: uuid.UUID, nb: Notebook) -> dict:
    unit, _, key = (nb.link_id or ":").partition(":")
    closed = [r for r in await _closed_rows(session, tenant_id) if _period_keys(r["day"]).get(unit) == key]
    wins = [r for r in closed if r["pnl"] > 0]; losses = [r for r in closed if r["pnl"] < 0]
    gw = sum(r["pnl"] for r in wins); gl = abs(sum(r["pnl"] for r in losses)); n = len(closed)
    by_day: dict[date, float] = defaultdict(float)
    for r in closed: by_day[r["day"]] += r["pnl"]
    run = 0.0; chart = []
    for d in sorted(by_day):
        run = _f(run + by_day[d]); chart.append({"date": d.strftime("%m/%d"), "value": run})
    stats = [
        {"label": "Total trades", "value": str(n), "tone": None},
        {"label": "Winners", "value": str(len(wins)), "tone": "pos"},
        {"label": "Losers", "value": str(len(losses)), "tone": "neg"},
        {"label": "Winrate", "value": f'{_f(len(wins)/n*100)}%' if n else "--", "tone": None},
        {"label": "Gross P&L", "value": _usd(gw), "tone": "pos"},
        {"label": "Profit factor", "value": f'{round(gw/gl,2)}' if gl else "--", "tone": None},
        {"label": "Trading days", "value": str(len(by_day)), "tone": None},
        {"label": "Best day", "value": _usd(max(by_day.values())) if by_day else "--", "tone": "pos"},
    ]
    return {"stats": stats, "chart": chart, "tradeIds": [r["id"] for r in closed], "headlinePnl": _f(sum(r["pnl"] for r in closed)), "readonly": False}


async def _backtest_detail(session: AsyncSession, tenant_id: uuid.UUID, nb: Notebook) -> dict:
    sid = _maybe_uuid(nb.link_id)
    s = await session.get(BacktestSession, sid) if sid else None
    notes = list((await session.execute(select(BacktestAction).where(
        BacktestAction.session_id == sid, BacktestAction.kind == "note").order_by(BacktestAction.at_time))).scalars().all()) if sid else []
    # escape the note TEXT: this body is rendered on the PUBLIC share page, so a stray <script> must not execute.
    body = "".join(
        f'<h4>{datetime.fromtimestamp(n.at_time, ET).strftime("%a, %b %d %Y")}</h4><p>{_esc((n.payload or {}).get("text", ""))}</p>'
        for n in notes)
    stats = [
        {"label": "Symbol", "value": s.symbol if s else "--", "tone": None},
        {"label": "Range", "value": f'{s.start_date} → {s.end_date}' if s else "--", "tone": None},
        {"label": "Notes", "value": str(len(notes)), "tone": None},
        {"label": "Source", "value": "Backtester (read-only)", "tone": None},
    ]
    return {"stats": stats, "chart": [], "tradeIds": [], "headlinePnl": None, "readonly": True, "bodyOverride": body}


async def detail(session: AsyncSession, tenant_id: uuid.UUID, nid: uuid.UUID) -> dict:
    nb = await session.get(Notebook, nid)
    if nb is None or nb.tenant_id != tenant_id:
        raise NotFoundError("Note not found")
    if nb.link_type == "trade": d = await _trade_detail(session, tenant_id, nb)
    elif nb.link_type == "daily": d = await _daily_detail(session, tenant_id, nb)
    elif nb.link_type == "recap": d = await _recap_detail(session, tenant_id, nb)
    elif nb.link_type == "backtest": d = await _backtest_detail(session, tenant_id, nb)
    else: d = {"stats": [], "chart": [], "tradeIds": [], "headlinePnl": None, "readonly": False}
    tags = [t.name for t in (await session.execute(
        select(NoteTag).join(NotebookTag, NotebookTag.tag_id == NoteTag.id).where(NotebookTag.notebook_id == nb.id))).scalars().all()]
    body = d.pop("bodyOverride", None) or nb.body_html
    return {"id": str(nb.id), "title": nb.title, "bodyHtml": body, "linkType": nb.link_type, "linkId": nb.link_id,
            "source": nb.source, "starred": bool(nb.starred), "shareToken": nb.share_token,
            "createdAt": nb.created_at.astimezone(ET).strftime("%b %d, %Y %I:%M%p"),
            "updatedAt": nb.updated_at.astimezone(ET).strftime("%b %d, %Y %I:%M%p"),
            "tags": tags, "stats": d["stats"], "headlinePnl": d["headlinePnl"], "chart": d["chart"],
            "tradeIds": d["tradeIds"], "readonly": d["readonly"]}


async def create_note(session: AsyncSession, tenant_id: uuid.UUID, body) -> Notebook:
    nb = Notebook(id=uuid.uuid4(), tenant_id=tenant_id,
                  folder_id=_maybe_uuid(body.folder_id),
                  title=(body.title or "Untitled")[:200], body_html=body.body_html or "",
                  link_type="manual", source="manual")
    session.add(nb); await session.commit(); await session.refresh(nb)
    return nb


async def patch_note(session: AsyncSession, tenant_id: uuid.UUID, nid: uuid.UUID, body) -> dict:
    nb = await session.get(Notebook, nid)
    if nb is None or nb.tenant_id != tenant_id:
        raise NotFoundError("Note not found")
    if body.title is not None: nb.title = body.title[:200]
    if body.body_html is not None and nb.link_type != "backtest": nb.body_html = body.body_html
    if body.starred is not None: nb.starred = body.starred
    if body.folder_id is not None: nb.folder_id = _maybe_uuid(body.folder_id)
    await session.commit()
    return {"ok": True, "updatedAt": nb.updated_at.astimezone(ET).strftime("%b %d, %Y %I:%M%p")}


async def set_tags(session: AsyncSession, tenant_id: uuid.UUID, nid: uuid.UUID, names: list[str]) -> list[str]:
    nb = await session.get(Notebook, nid)
    if nb is None or nb.tenant_id != tenant_id:
        raise NotFoundError("Note not found")
    names = [n.strip()[:60] for n in names if n and n.strip()]
    tag_ids = []
    for nm in names:
        t = (await session.execute(select(NoteTag).where(NoteTag.tenant_id == tenant_id, NoteTag.name == nm))).scalar_one_or_none()
        if t is None:
            t = NoteTag(id=uuid.uuid4(), tenant_id=tenant_id, name=nm); session.add(t); await session.flush()
        tag_ids.append(t.id)
    cur = {r[0] for r in (await session.execute(select(NotebookTag.tag_id).where(NotebookTag.notebook_id == nb.id))).all()}
    for tgid in cur - set(tag_ids):
        await session.execute(NotebookTag.__table__.delete().where(NotebookTag.notebook_id == nb.id, NotebookTag.tag_id == tgid))
    for tgid in set(tag_ids) - cur:
        session.add(NotebookTag(notebook_id=nb.id, tag_id=tgid))
    await session.commit()
    return names


async def soft_delete(session: AsyncSession, tenant_id: uuid.UUID, nid: uuid.UUID) -> None:
    nb = await session.get(Notebook, nid)
    if nb is None or nb.tenant_id != tenant_id: raise NotFoundError("Note not found")
    nb.deleted_at = datetime.now(timezone.utc); await session.commit()


async def restore(session: AsyncSession, tenant_id: uuid.UUID, nid: uuid.UUID) -> None:
    nb = await session.get(Notebook, nid)
    if nb is None or nb.tenant_id != tenant_id: raise NotFoundError("Note not found")
    nb.deleted_at = None; await session.commit()


async def purge(session: AsyncSession, tenant_id: uuid.UUID, nid: uuid.UUID) -> None:
    nb = await session.get(Notebook, nid)
    if nb is None or nb.tenant_id != tenant_id: raise NotFoundError("Note not found")
    await session.delete(nb); await session.commit()


async def toggle_share(session: AsyncSession, tenant_id: uuid.UUID, nid: uuid.UUID) -> str | None:
    nb = await session.get(Notebook, nid)
    if nb is None or nb.tenant_id != tenant_id: raise NotFoundError("Note not found")
    nb.share_token = None if nb.share_token else uuid.uuid4().hex[:24]
    await session.commit()
    return nb.share_token


async def public_note(session: AsyncSession, token: str) -> dict:
    # NO auth dependency here by design (public link). Made visible cross-tenant ONLY for rows bearing a
    # share_token by migration 0012's widened USING clause; WITH CHECK still tenant-bound, and there is no
    # public WRITE endpoint, so a token grants READ-ONLY of that one note.
    nb = (await session.execute(select(Notebook).where(Notebook.share_token == token))).scalar_one_or_none()
    if nb is None: raise NotFoundError("Shared note not found")
    return {"title": nb.title, "bodyHtml": nb.body_html, "updatedAt": nb.updated_at.astimezone(ET).strftime("%b %d, %Y")}


async def folders_create(session: AsyncSession, tenant_id: uuid.UUID, body) -> str:
    mx = (await session.execute(select(func.coalesce(func.max(NoteFolder.position), 0)).where(NoteFolder.tenant_id == tenant_id))).scalar() or 0
    f = NoteFolder(id=uuid.uuid4(), tenant_id=tenant_id, name=body.name[:120], color=body.color, kind="custom", position=mx + 1)
    session.add(f); await session.commit(); return str(f.id)


async def folders_patch(session: AsyncSession, tenant_id: uuid.UUID, fid: uuid.UUID, body) -> None:
    f = await session.get(NoteFolder, fid)
    if f is None or f.tenant_id != tenant_id or f.kind == "system": raise NotFoundError("Folder not found")
    if body.name is not None: f.name = body.name[:120]
    if body.color is not None: f.color = body.color[:9]
    if body.position is not None: f.position = body.position
    await session.commit()


async def folders_delete(session: AsyncSession, tenant_id: uuid.UUID, fid: uuid.UUID) -> None:
    f = await session.get(NoteFolder, fid)
    if f is None or f.tenant_id != tenant_id or f.kind == "system": raise NotFoundError("Folder not found")
    await session.execute(Notebook.__table__.update().where(Notebook.folder_id == fid).values(folder_id=None))
    await session.delete(f); await session.commit()


async def templates_list(session: AsyncSession, tenant_id: uuid.UUID) -> list[dict]:
    await _ensure_templates(session, tenant_id)
    rows = (await session.execute(select(NoteTemplate).where(NoteTemplate.tenant_id == tenant_id)
                                  .order_by(NoteTemplate.category, NoteTemplate.position, NoteTemplate.name))).scalars().all()
    return [{"id": str(t.id), "name": t.name, "bodyHtml": t.body_html, "category": t.category,
             "isBuiltin": bool(t.is_builtin), "favourite": bool(t.favourite)} for t in rows]


async def templates_create(session: AsyncSession, tenant_id: uuid.UUID, body) -> str:
    t = NoteTemplate(id=uuid.uuid4(), tenant_id=tenant_id, name=body.name[:120], body_html=body.body_html,
                     category=body.category, is_builtin=False, position=999)
    session.add(t); await session.commit(); return str(t.id)


async def templates_patch(session: AsyncSession, tenant_id: uuid.UUID, tid: uuid.UUID, body) -> None:
    t = await session.get(NoteTemplate, tid)
    if t is None or t.tenant_id != tenant_id: raise NotFoundError("Template not found")
    if body.name is not None: t.name = body.name[:120]
    if body.body_html is not None: t.body_html = body.body_html
    if body.favourite is not None: t.favourite = body.favourite
    await session.commit()


async def templates_delete(session: AsyncSession, tenant_id: uuid.UUID, tid: uuid.UUID) -> None:
    t = await session.get(NoteTemplate, tid)
    if t is None or t.tenant_id != tenant_id: raise NotFoundError("Template not found")
    await session.delete(t); await session.commit()


def export_html(title: str, body_html: str, stats: list[dict], meta: str) -> str:
    # escape title/meta/stat cells (user-controlled); body_html is the editor's own HTML (sanitization of
    # external paste is a known deferred item) and is intentionally injected raw.
    rows = "".join(
        f'<tr><td style="padding:4px 10px;border:1px solid #eee;font-weight:600">{_esc(s["label"])}</td>'
        f'<td style="padding:4px 10px;border:1px solid #eee">{_esc(s["value"])}</td></tr>' for s in stats)
    return (f'<!doctype html><html><head><meta charset="utf-8"><title>{_esc(title)}</title>'
            f'<style>body{{font-family:Arial,Helvetica,sans-serif;color:#15162E;padding:32px;max-width:820px;margin:auto}}'
            f'h1{{font-size:20px}} table{{border-collapse:collapse;margin:12px 0}} .nt-badge{{display:inline-block;padding:2px 8px;border-radius:4px;color:#fff}}'
            f'.nt-check{{display:inline-block;width:16px}} details{{margin:6px 0}} .muted{{color:#888;font-size:12px}}</style></head><body>'
            f'<h1>{_esc(title)}</h1><p class="muted">{_esc(meta)}</p><table>{rows}</table><hr/>{body_html}'
            f'<p class="muted" style="margin-top:24px">Exported from tradeJournaling · use your browser&apos;s Print → Save as PDF</p>'
            f'</body></html>')