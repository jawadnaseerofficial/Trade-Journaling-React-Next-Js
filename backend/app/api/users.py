from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user
from app.db.models import User
from app.db.session import get_session
from app.schemas.journal import ChartStyleIn

router = APIRouter(prefix="/users")


@router.patch("/me")
async def patch_me(
    body: ChartStyleIn,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    user.chart_style = body.chart_style if body.chart_style in ("lightweight", "simple") else "lightweight"
    await session.commit()
    return {"ok": True, "chartStyle": user.chart_style}


@router.get("/me")
async def get_me(user: User = Depends(get_current_user)):
    return {"id": str(user.id), "email": user.email, "tenantId": str(user.tenant_id), "chartStyle": user.chart_style}