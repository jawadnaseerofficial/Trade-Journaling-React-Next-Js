import uuid
from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user
from app.core.errors import DomainError, NotFoundError
from app.db.models import (
    MissedTrade, Playbook, PlaybookNote, PlaybookRule, PlaybookRuleGroup,
    PlaybookShare, Trade, TradeRuleMark, User,
)
from app.db.session import get_session
from app.schemas.playbook import (
    GroupCreateIn, GroupRenameIn, MissedCreateIn, NoteCreateIn, NoteUpdateIn,
    PlaybookCreateIn, RenameIn, ShareIn, VisibilityIn,
)
from app.services import playbook_service as svc

router = APIRouter(prefix="/playbooks")


async def _pb(session: AsyncSession, user: User, pb_id: str) -> Playbook:
    return await svc._get_pb(session, user.tenant_id, uuid.UUID(pb_id))


@router.get("")
async def list_playbooks(
    scope: str = "my",
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    return await svc.list_index(session, user.tenant_id, scope)


@router.get("/with-rules")
async def with_rules(session: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    return await svc.with_rules(session, user.tenant_id)


@router.post("", status_code=201)
async def create_playbook(
    body: PlaybookCreateIn,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    pb = Playbook(tenant_id=user.tenant_id, name=body.name, description=body.description,
                  icon=body.icon, color=body.color)
    session.add(pb)
    await session.flush()
    for gi, g in enumerate(body.groups):
        grp = PlaybookRuleGroup(playbook_id=pb.id, tenant_id=user.tenant_id, name=g.name, position=gi)
        session.add(grp)
        await session.flush()
        for ri, r in enumerate(g.rules):
            session.add(PlaybookRule(group_id=grp.id, playbook_id=pb.id, tenant_id=user.tenant_id,
                                     name=r.name, visibility=r.visibility, position=ri))
    await session.commit()
    return {"id": str(pb.id)}


@router.get("/{pb_id}")
async def detail(pb_id: str, session: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    return await svc.detail(session, user.tenant_id, uuid.UUID(pb_id))


@router.patch("/{pb_id}")
async def rename(pb_id: str, body: RenameIn, session: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    pb = await _pb(session, user, pb_id)
    if body.name is not None:
        pb.name = body.name
    if body.description is not None:
        pb.description = body.description
    pb.updated_at = datetime.now(timezone.utc)
    await session.commit()
    return {"ok": True}


@router.patch("/{pb_id}/visibility")
async def set_visibility(pb_id: str, body: VisibilityIn, session: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    pb = await _pb(session, user, pb_id)
    pb.visibility = body.visibility
    await session.commit()
    return {"ok": True}


@router.delete("/{pb_id}", status_code=204)
async def remove(pb_id: str, session: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    pb = await _pb(session, user, pb_id)
    await session.delete(pb)
    await session.commit()


@router.get("/{pb_id}/overview")
async def overview(pb_id: str, session: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    return await svc.overview(session, user.tenant_id, uuid.UUID(pb_id))


@router.get("/{pb_id}/trades")
async def trades(pb_id: str, session: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    return await svc.executed_rows(session, user.tenant_id, uuid.UUID(pb_id))


@router.get("/{pb_id}/missed")
async def missed(pb_id: str, session: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    return await svc.missed_rows(session, user.tenant_id, uuid.UUID(pb_id))


@router.post("/{pb_id}/missed", status_code=201)
async def add_missed(pb_id: str, body: MissedCreateIn, session: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    pb = await _pb(session, user, pb_id)
    pnl = (body.exit_price - body.entry_price) * body.qty * (1 if body.side == "buy" else -1)
    cost = body.entry_price * body.qty or 1.0
    session.add(MissedTrade(
        playbook_id=pb.id, tenant_id=user.tenant_id, symbol=body.symbol.upper(), side=body.side,
        qty=body.qty, open_date=date.fromisoformat(body.open_date), close_date=date.fromisoformat(body.close_date),
        entry_price=body.entry_price, exit_price=body.exit_price, net_pnl=round(pnl, 2),
        net_roi=round(pnl / cost * 100, 2), status=body.status, setups=body.setups,
    ))
    await session.commit()
    return {"ok": True}


@router.get("/{pb_id}/notes")
async def notes(pb_id: str, session: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    return await svc.notes_list(session, user.tenant_id, uuid.UUID(pb_id))


@router.post("/{pb_id}/notes", status_code=201)
async def add_note(pb_id: str, body: NoteCreateIn, session: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    pb = await _pb(session, user, pb_id)
    n = PlaybookNote(playbook_id=pb.id, tenant_id=user.tenant_id, title=body.title, body="")
    session.add(n)
    await session.commit()
    return {"id": str(n.id)}


@router.patch("/notes/{note_id}")
async def update_note(note_id: str, body: NoteUpdateIn, session: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    n = await session.get(PlaybookNote, uuid.UUID(note_id))
    if n is None or n.tenant_id != user.tenant_id:
        raise NotFoundError("Note not found")
    if body.title is not None:
        n.title = body.title
    if body.body is not None:
        n.body = body.body
    n.updated_at = datetime.now(timezone.utc)
    await session.commit()
    return {"ok": True}


@router.delete("/notes/{note_id}", status_code=204)
async def remove_note(note_id: str, session: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    n = await session.get(PlaybookNote, uuid.UUID(note_id))
    if n is None or n.tenant_id != user.tenant_id:
        raise NotFoundError("Note not found")
    await session.delete(n)
    await session.commit()


@router.post("/{pb_id}/groups", status_code=201)
async def add_group(pb_id: str, body: GroupCreateIn, session: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    pb = await _pb(session, user, pb_id)
    pos = (await session.execute(
        select(func.max(PlaybookRuleGroup.position)).where(PlaybookRuleGroup.playbook_id == pb.id)
    )).scalar() or 0
    g = PlaybookRuleGroup(playbook_id=pb.id, tenant_id=user.tenant_id, name=body.name, position=pos + 1)
    session.add(g)
    await session.commit()
    return {"id": str(g.id)}


@router.patch("/groups/{group_id}")
async def rename_group(group_id: str, body: GroupRenameIn, session: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    g = await session.get(PlaybookRuleGroup, uuid.UUID(group_id))
    if g is None or g.tenant_id != user.tenant_id:
        raise NotFoundError("Group not found")
    g.name = body.name
    await session.commit()
    return {"ok": True}


@router.delete("/groups/{group_id}", status_code=204)
async def remove_group(group_id: str, session: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    g = await session.get(PlaybookRuleGroup, uuid.UUID(group_id))
    if g is None or g.tenant_id != user.tenant_id:
        raise NotFoundError("Group not found")
    await session.delete(g)
    await session.commit()


@router.post("/groups/{group_id}/rules", status_code=201)
async def add_rule(group_id: str, body: GroupCreateIn, session: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    g = await session.get(PlaybookRuleGroup, uuid.UUID(group_id))
    if g is None or g.tenant_id != user.tenant_id:
        raise NotFoundError("Group not found")
    pos = (await session.execute(
        select(func.max(PlaybookRule.position)).where(PlaybookRule.group_id == g.id)
    )).scalar() or 0
    r = PlaybookRule(group_id=g.id, playbook_id=g.playbook_id, tenant_id=user.tenant_id,
                     name=body.name, visibility="always", position=pos + 1)
    session.add(r)
    await session.commit()
    return {"id": str(r.id)}


@router.patch("/rules/{rule_id}")
async def update_rule(rule_id: str, body: GroupRenameIn, session: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    r = await session.get(PlaybookRule, uuid.UUID(rule_id))
    if r is None or r.tenant_id != user.tenant_id:
        raise NotFoundError("Rule not found")
    r.name = body.name
    await session.commit()
    return {"ok": True}


@router.delete("/rules/{rule_id}", status_code=204)
async def remove_rule(rule_id: str, session: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    r = await session.get(PlaybookRule, uuid.UUID(rule_id))
    if r is None or r.tenant_id != user.tenant_id:
        raise NotFoundError("Rule not found")
    await session.delete(r)
    await session.commit()


@router.delete("/missed/{missed_id}", status_code=204)
async def remove_missed(missed_id: str, session: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    m = await session.get(MissedTrade, uuid.UUID(missed_id))
    if m is None or m.tenant_id != user.tenant_id:
        raise NotFoundError("Missed trade not found")
    await session.delete(m)
    await session.commit()


@router.post("/{pb_id}/share", status_code=201)
async def share(pb_id: str, body: ShareIn, session: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    pb = await _pb(session, user, pb_id)
    target = (await session.execute(
        select(User).where(User.tenant_id == user.tenant_id, User.email == body.email.lower())
    )).scalar_one_or_none()
    if target is None:
        raise DomainError("No user with that email in your workspace")
    if target.id == user.id:
        raise DomainError("You already own this playbook")
    exists = (await session.execute(
        select(PlaybookShare.id).where(PlaybookShare.playbook_id == pb.id, PlaybookShare.user_id == target.id)
    )).first()
    if not exists:
        session.add(PlaybookShare(playbook_id=pb.id, tenant_id=user.tenant_id, user_id=target.id))
        await session.commit()
    return {"ok": True}