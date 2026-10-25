from pydantic import BaseModel

from app.schemas.dashboard import CamelModel


class LogFilters(BaseModel):
    status: str | None = None          # win | loss | break_even | open | all
    symbol: str | None = None
    setup: str | None = None
    account_id: str | None = None
    date_from: str | None = None       # YYYY-MM-DD
    date_to: str | None = None


class LogRow(CamelModel):
    id: str
    open_date: str
    symbol: str
    status: str                         # win | loss | break_even | open
    close_date: str | None
    entry_price: float | None
    exit_price: float | None
    net_pnl: float
    net_roi: float | None
    realized_r: float | None            # "Zella Insights"
    setups: str | None
    playbook_name: str | None
    account_name: str | None
    # market-derived (filled lazily client-side via preview-batch)
    mae: float | None = None
    mfe: float | None = None
    best_exit_pct: float | None = None


class LogKpis(CamelModel):
    net_pnl: float
    trades: int                         # total filtered rows (badge)
    win_rate: float
    profit_factor: float
    avg_win: float
    avg_loss: float
    expectancy: float
    cumulative: list[dict]              # [{date, value}] for the sparkline


class LogPage(CamelModel):
    rows: list[LogRow]
    total: int
    page: int
    pages: int
    per_page: int
    kpis: LogKpis


class PreviewOut(CamelModel):
    id: str
    symbol: str
    day_label: str
    status: str
    entry_price: float | None
    exit_price: float | None
    net_pnl: float
    net_roi: float | None
    realized_r: float | None
    mae: float | None
    mfe: float | None
    best_exit_pct: float | None
    setups: str | None
    account_name: str | None
    candles: list[dict]


class PreviewBatchIn(BaseModel):
    ids: list[str]


class LinkPlaybookIn(BaseModel):
    playbook_id: str | None = None