from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user
from app.db.models import User
from app.db.session import get_session
from app.schemas.report import FiltersIn
from app.services import analytics_service as svc

router = APIRouter(prefix="/analytics")


@router.get("/summary")
async def summary(
    flt: FiltersIn = Depends(),
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    return await svc.analyze(session, user.tenant_id, flt)