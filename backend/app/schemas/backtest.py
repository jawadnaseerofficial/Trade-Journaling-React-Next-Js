from pydantic import BaseModel, Field

from app.schemas.dashboard import CamelModel


# frontend sends camelCase (playbookId / assetType / startBalance / startDate / endDate)
# -> must be CamelModel so the to_camel aliases match the wire. Other inputs below are
# snake/single-word on purpose (addAction/progress send at_time / last_time) -> stay BaseModel.
class SessionCreateIn(CamelModel):
    name: str = Field(min_length=1, max_length=120)
    description: str | None = None
    playbook_id: str | None = None
    asset_type: str = Field(default="stocks", pattern=r"^(forex|stocks|crypto|futures|indices)$")
    symbol: str = Field(min_length=1, max_length=24)
    start_balance: float = Field(default=100000, gt=0)
    start_date: str
    end_date: str
    interval: str = Field(default="1m", pattern=r"^(1m|5m|15m|1h|1d)$")


# kind widened to include note|tag: the simulator's if/elif chain has NO else, so an
# unknown kind is consumed (ai+=1) and silently skipped -> notes/tags ride the SAME action
# log with ZERO schema change and never affect P&L/stats. modify still only writes tp/sl.
class ActionIn(BaseModel):
    id: str
    at_time: int
    kind: str = Field(pattern=r"^(order|cancel|close|modify|note|tag)$")
    payload: dict = Field(default_factory=dict)


class ProgressIn(BaseModel):
    last_time: int | None = None


class RenameIn(BaseModel):
    name: str | None = None
    description: str | None = None


class VisibilityIn(BaseModel):
    visibility: str = Field(pattern=r"^(private|shared)$")


class SessionListItem(CamelModel):
    id: str
    name: str
    description: str | None
    symbol: str
    asset_type: str
    interval: str
    visibility: str
    start_balance: float
    current_balance: float
    realized_pnl: float
    win_rate: float
    trade_count: int
    drawdown: float
    completion_pct: float
    start_date: str
    end_date: str
    playbook_name: str | None


class RunOut(CamelModel):
    session: dict
    candles: list[dict]
    actions: list[dict]
    base_interval: str
    available_from: int | None
    total_candles: int


class ShareIn(BaseModel):
    email: str


class ShareOut(CamelModel):
    id: str
    user_id: str
    email: str
    name: str