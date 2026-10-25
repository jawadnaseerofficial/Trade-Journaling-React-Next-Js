from pydantic import BaseModel, Field

from app.schemas.dashboard import CamelModel


class ExecutionIn(BaseModel):
    date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    time: str = Field(default="00:00", pattern=r"^\d{2}:\d{2}(:\d{2})?$")
    qty: float = Field(gt=0)
    side: str = Field(pattern=r"^(buy|sell)$")
    price: float = Field(ge=0)
    commission: float = Field(default=0, ge=0)
    fee: float = Field(default=0, ge=0)


class ManualTradeIn(BaseModel):
    account_id: str
    symbol: str = Field(min_length=1, max_length=16)
    asset_type: str = Field(default="stock")
    timezone: str = Field(default="US/Eastern")
    executions: list[ExecutionIn] = Field(min_length=1)


class TradeCreatedOut(CamelModel):
    id: str
    symbol: str
    status: str
    net_pnl: float
    executions: int


class ImportResultOut(CamelModel):
    imported_trades: int
    imported_executions: int
    skipped_rows: int