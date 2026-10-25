from pydantic import BaseModel

from app.schemas.dashboard import CamelModel


class TradeLogRow(CamelModel):
    id: str
    open_time: str
    ticker: str
    side: str
    instrument: str
    net_pnl: float
    net_roi: float | None = None
    realized_r: float | None = None
    playbook: str | None = None
    tags: str | None = None


class DaySummary(CamelModel):
    date: str
    label: str
    net_pnl: float
    total_trades: int
    winners: int
    losers: int
    winrate: float
    gross_pnl: float
    commissions: float
    volume: float
    profit_factor: float
    has_note: bool
    note: str | None = None
    trades: list[TradeLogRow]


class MonthJournal(CamelModel):
    month: str
    days: list[DaySummary]


class DayNoteIn(BaseModel):
    day: str          # YYYY-MM-DD
    note: str | None = None


class TradePatchIn(BaseModel):
    note: str | None = None
    rating: int | None = None
    playbook: str | None = None
    tags: str | None = None
    setups: str | None = None
    mistakes: str | None = None
    custom_tags: str | None = None
    profit_target: float | None = None
    stop_loss: float | None = None
    initial_target: float | None = None
    planned_r: float | None = None


class ExecutionIn(BaseModel):
    date: str
    time: str
    qty: float
    side: str
    price: float
    commission: float = 0
    fee: float = 0


class ChartStyleIn(BaseModel):
    chart_style: str