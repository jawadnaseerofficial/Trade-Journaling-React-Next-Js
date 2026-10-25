from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user
from app.db.models import User
from app.db.session import get_session
from app.schemas.report import FiltersIn
from app.services import report_service as svc

router = APIRouter(prefix="/reports")


@router.get("/capabilities")
async def capabilities(user: User = Depends(get_current_user)):
    return svc.HAS


@router.get("/dimension/{dimension}")
async def dimension(dimension: str, flt: FiltersIn = Depends(), session: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    return await svc.dimension_report(session, user.tenant_id, flt, dimension)


@router.get("/cross")
async def cross(dimA: str = Query("dow"), dimB: str = Query("hour"), metric: str = Query("net"),
                flt: FiltersIn = Depends(), session: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    return await svc.cross(session, user.tenant_id, flt, dimA, dimB, metric)


@router.get("/performance")
async def performance(metrics: str = Query("net_cum,trades,win_rate"), gran: str = Query("day"),
                      flt: FiltersIn = Depends(), session: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    return await svc.performance(session, user.tenant_id, flt, [m for m in metrics.split(",") if m], gran)


@router.get("/overview")
async def overview(flt: FiltersIn = Depends(), session: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    return await svc.overview(session, user.tenant_id, flt)


@router.post("/compare")
async def compare(body: dict, session: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    fa = FiltersIn(**(body.get("a") or {})); fb = FiltersIn(**(body.get("b") or {}))
    return await svc.compare(session, user.tenant_id, fa, fb)


@router.get("/calendar")
async def calendar(month: str = Query(...), flt: FiltersIn = Depends(), session: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    return await svc.calendar(session, user.tenant_id, flt, month)


@router.get("/wins-losses")
async def wins_losses(flt: FiltersIn = Depends(), session: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    return await svc.wins_losses(session, user.tenant_id, flt)