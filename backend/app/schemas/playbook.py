from pydantic import BaseModel, Field

from app.schemas.dashboard import CamelModel


class RuleIn(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    visibility: str = Field(default="always", pattern=r"^(always|winner|loser|break_even)$")


class GroupIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    rules: list[RuleIn] = Field(default_factory=list)


class PlaybookCreateIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    description: str | None = None
    icon: str = Field(default="", max_length=16)
    color: str = Field(default="#6D5DE7", max_length=9)
    groups: list[GroupIn] = Field(default_factory=list)


class RenameIn(BaseModel):
    name: str | None = None
    description: str | None = None


class VisibilityIn(BaseModel):
    visibility: str = Field(pattern=r"^(private|shared)$")


class GroupRenameIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)


class GroupCreateIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)


# frontend addMissed sends camelCase (openDate/closeDate/entryPrice/exitPrice) and does NOT
# send net_pnl/net_roi (the endpoint derives them from entry/exit/side/qty) -> CamelModel + drop those two.
class MissedCreateIn(CamelModel):
    symbol: str = Field(min_length=1, max_length=16)
    side: str = Field(default="buy", pattern=r"^(buy|sell)$")
    qty: float = Field(default=1, gt=0)
    open_date: str
    close_date: str
    entry_price: float = Field(ge=0)
    exit_price: float = Field(ge=0)
    status: str = Field(default="win", pattern=r"^(win|loss|break_even)$")
    setups: str | None = None


class NoteCreateIn(BaseModel):
    title: str = Field(default="Untitled", max_length=200)


class NoteUpdateIn(BaseModel):
    title: str | None = None
    body: str | None = None


class ShareIn(BaseModel):
    email: str


class TradePlaybookIn(BaseModel):
    playbook_id: str | None = None
    rules: list[dict] = Field(default_factory=list)  # [{ruleId, followed}]


# ---- out ----
class RuleOut(CamelModel):
    id: str
    name: str
    visibility: str
    position: int
    follow_rate: float | None = None
    net_pnl: float | None = None
    profit_factor: float | None = None
    win_rate: float | None = None


class GroupOut(CamelModel):
    id: str
    name: str
    position: int
    rules: list[RuleOut]


class PlaybookListItem(CamelModel):
    id: str
    name: str
    description: str | None
    icon: str
    color: str
    visibility: str
    trades: int
    net_pnl: float
    win_rate: float
    missed_trades: int
    expectancy: float
    shared_count: int


class PlaybookDetail(CamelModel):
    id: str
    name: str
    description: str | None
    icon: str
    color: str
    visibility: str
    groups: list[GroupOut]


class OverviewKpis(CamelModel):
    net_pnl: float
    trades: int
    win_rate: float
    profit_factor: float
    missed_trades: int
    expectancy: float
    rules_followed: float | None
    average_winner: float
    average_loser: float
    largest_profit: float
    largest_loss: float
    total_r_multiple: float | None


class CumPoint(CamelModel):
    date: str
    value: float


class OverviewOut(CamelModel):
    kpis: OverviewKpis
    cumulative: list[CumPoint]


class ExecutedRow(CamelModel):
    id: str
    open_date: str
    symbol: str
    status: str
    close_date: str | None
    entry_price: float | None
    exit_price: float | None
    net_pnl: float
    net_roi: float | None
    setups: str | None
    account_name: str | None


class MissedRow(CamelModel):
    id: str
    open_date: str
    symbol: str
    status: str
    close_date: str
    entry_price: float
    exit_price: float
    net_pnl: float
    net_roi: float
    setups: str | None


class NoteOut(CamelModel):
    id: str
    title: str
    body: str | None
    created_at: str
    updated_at: str


class WithRulesRule(CamelModel):
    id: str
    name: str
    visibility: str


class WithRulesGroup(CamelModel):
    id: str
    name: str
    rules: list[WithRulesRule]


class WithRulesPlaybook(CamelModel):
    id: str
    name: str
    groups: list[WithRulesGroup]