from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class KpiSummary(CamelModel):
    net_pnl: float
    trade_expectancy: float
    profit_factor: float
    win_rate: float
    avg_win: float
    avg_loss: float


class ScoreAxis(CamelModel):
    axis: str
    value: float


class Score(CamelModel):
    value: float
    axes: list[ScoreAxis]


class CumulativePoint(CamelModel):
    date: str
    value: float


class DailyPnl(CamelModel):
    date: str
    pnl: float
    trades: int


class TradeRow(CamelModel):
    id: str
    close_date: str
    symbol: str
    net_pnl: float
    qty: float


class CalendarMonth(CamelModel):
    month: str
    days: list[DailyPnl]


class DashboardSummary(CamelModel):
    kpi: KpiSummary
    score: Score
    cumulative: list[CumulativePoint]
    daily: list[DailyPnl]
    recent_trades: list[TradeRow]
    open_positions: list[TradeRow]
    calendar: CalendarMonth
    range_label: str
    last_import_at: str | None = None