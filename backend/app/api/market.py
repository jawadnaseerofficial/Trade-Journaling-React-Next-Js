from datetime import date

from fastapi import APIRouter, Depends, Query

from app.core.deps import get_current_user
from app.db.models import User
from app.schemas.replay import Candle
from app.services.market_data import get_candles

router = APIRouter(prefix="/market")


@router.get("/candles", response_model=list[Candle])
async def candles(
    symbol: str,
    day: str,
    interval: str = Query("1m"),
    user: User = Depends(get_current_user),
):
    return await get_candles(symbol, date.fromisoformat(day), interval)