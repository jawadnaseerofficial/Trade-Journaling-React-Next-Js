from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user
from app.db.models import User
from app.db.session import get_session
from app.schemas.dashboard import CalendarMonth, DashboardSummary
from app.services import dashboard_service as svc

router = APIRouter()


@router.get("/dashboard/summary", response_model=DashboardSummary)
async def summary(
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    return await svc.build_summary(session)


@router.get("/dashboard/calendar", response_model=CalendarMonth)
async def calendar(
    month: str,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    return await svc.build_calendar(session, month)