from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user
from app.db.models import Account, User
from app.db.session import get_session
from app.schemas.account import AccountOut

router = APIRouter(prefix="/accounts")


@router.get("", response_model=list[AccountOut])
async def list_accounts(session: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    rows = (await session.execute(select(Account).order_by(Account.created_at))).scalars().all()
    return [AccountOut(id=str(a.id), name=a.name, broker=a.broker, timezone=a.timezone) for a in rows]