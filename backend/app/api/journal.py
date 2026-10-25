import uuid
from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user
from app.db.models import JournalDay, User
from app.db.session import get_session
from app.schemas.journal import DayNoteIn, MonthJournal
from app.services import journal_service

router = APIRouter(prefix="/journal")


@router.get("/month", response_model=MonthJournal)
async def month(
    month: str,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    return await journal_service.build_month(session, user.tenant_id, month)


@router.put("/day")
async def upsert_day_note(
    body: DayNoteIn,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    d = date.fromisoformat(body.day)
    row = (await session.execute(
        select(JournalDay).where(JournalDay.tenant_id == user.tenant_id, JournalDay.day == d)
    )).scalar_one_or_none()
    if row is None:
        row = JournalDay(tenant_id=user.tenant_id, day=d, note=body.note)
        session.add(row)
    else:
        row.note = body.note
    await session.commit()
    return {"ok": True, "day": body.day}