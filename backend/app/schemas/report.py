from pydantic import BaseModel, Field

from app.schemas.dashboard import CamelModel


class FiltersIn(BaseModel):
    start: str | None = None          # ISO date
    end: str | None = None
    accounts: list[str] = Field(default_factory=list)
    symbols: list[str] = Field(default_factory=list)
    playbooks: list[str] = Field(default_factory=list)
    sides: list[str] = Field(default_factory=list)        # long|short
    statuses: list[str] = Field(default_factory=list)     # closed|open
    pnl_basis: str = Field(default="net", pattern=r"^(net|gross|r)$")


class BucketRow(CamelModel):
    key: str
    label: str
    trades: int
    wins: int
    losses: int
    breakeven: int
    win_rate: float | None
    net: float
    gross: float | None
    avg_win: float | None
    avg_loss: float | None
    volume: float
    avg_hold_sec: float | None
    best: float | None
    worst: float | None
    avg_r: float | None


class SummaryCard(CamelModel):
    kind: str            # best|worst|active|winrate
    title: str
    label: str
    value: str
    sub: str | None = None
    tone: str | None = None


class CrossCell(CamelModel):
    row: str
    col: str
    trades: int
    net: float
    win_rate: float | None
    avg_r: float | None


class DimensionOut(CamelModel):
    dimension: str
    available: bool                 # False => gated (e.g. trade-tags not wired)
    note: str | None = None
    cards: list[SummaryCard]
    series: list[BucketRow]         # x-axis buckets
    table: list[BucketRow]
    cross_rows: list[str]
    cross_cols: list[str]
    cross: list[CrossCell]


class MetricPoint(CamelModel):
    t: str
    v: float | None


class MetricSeries(CamelModel):
    metric: str
    label: str
    unit: str
    points: list[MetricPoint]


class PerformanceOut(CamelModel):
    series: list[MetricSeries]
    summary: list[dict]             # [{label,value,tone}]


class OverviewOut(CamelModel):
    best_month: dict
    lowest_month: dict
    avg_month: dict
    left: list[dict]
    right: list[dict]


class CompareGroup(CamelModel):
    stats: list[dict]
    win_rate: float | None
    winners: int
    losers: int
    curve: list[MetricPoint]


class CompareOut(CamelModel):
    a: CompareGroup
    b: CompareGroup


class CalendarDay(CamelModel):
    d: str
    net: float
    trades: int
    win_rate: float | None


class CalendarOut(CamelModel):
    month: str
    days: list[CalendarDay]
    total: float
    trading_days: int
    best_day: dict | None
    worst_day: dict | None