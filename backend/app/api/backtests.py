import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user
from app.db.models import User
from app.db.session import get_session
from app.schemas.backtest import (
    ActionIn, ProgressIn, RenameIn, SessionCreateIn, ShareIn, VisibilityIn,
)
from app.services import backtest_service as svc

router = APIRouter(prefix="/backtests")

@router.get("")
async def list_sessions(scope: str = Query("my"), session: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    return await svc.list_sessions(session, user.tenant_id, user.id, scope)


@router.post("", status_code=201)
async def create(body: SessionCreateIn, session: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    s = await svc.create(session, user.tenant_id, body)
    return {"id": str(s.id)}


@router.get("/{sid}")
async def get_one(sid: str, session: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    return await svc.run_payload(session, user.tenant_id, uuid.UUID(sid))["session"]


@router.get("/{sid}/run")
async def run(sid: str, session: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    return await svc.run_payload(session, user.tenant_id, uuid.UUID(sid))


@router.post("/{sid}/actions", status_code=201)
async def add_action(sid: str, body: ActionIn, session: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    await svc.add_action(session, user.tenant_id, uuid.UUID(sid), body)
    return {"ok": True}


@router.patch("/{sid}/progress")
async def progress(sid: str, body: ProgressIn, session: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    await svc.set_progress(session, user.tenant_id, uuid.UUID(sid), body.last_time)
    return {"ok": True}


@router.patch("/{sid}")
async def rename(sid: str, body: RenameIn, session: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    from app.core.errors import NotFoundError
    s = await svc._get(session, user.tenant_id, uuid.UUID(sid))
    if body.name is not None: s.name = body.name
    if body.description is not None: s.description = body.description
    await session.commit()
    return {"ok": True}


@router.patch("/{sid}/visibility")
async def visibility(sid: str, body: VisibilityIn, session: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    s = await svc._get(session, user.tenant_id, uuid.UUID(sid))
    s.visibility = body.visibility
    await session.commit()
    return {"ok": True}


@router.delete("/{sid}", status_code=204)
async def remove(sid: str, session: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    s = await svc._get(session, user.tenant_id, uuid.UUID(sid))
    await session.delete(s)
    await session.commit()


@router.get("/{sid}/shares")
async def list_shares(sid: str, session: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    return await svc.list_shares(session, user.tenant_id, uuid.UUID(sid))


@router.post("/{sid}/share", status_code=201)
async def share(sid: str, body: ShareIn, session: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    return await svc.share_with(session, user.tenant_id, uuid.UUID(sid), body.email)


@router.delete("/{sid}/shares/{uid}", status_code=204)
async def unshare(sid: str, uid: str, session: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    await svc.unshare(session, user.tenant_id, uuid.UUID(sid), uuid.UUID(uid))