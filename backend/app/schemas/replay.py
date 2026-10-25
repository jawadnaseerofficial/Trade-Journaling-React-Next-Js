from app.schemas.dashboard import CamelModel


class ReplayTrade(CamelModel):
    id: str
    symbol: str
    instrument: str
    asset_type: str
    status: str
    side: str
    open_date: str
    close_date: str | None = None
    day_label: str
    net_pnl: float
    net_roi: float | None = None
    realized_r: float | None = None
    planned_r: float | None = None
    adjusted_cost: float
    commissions_fees: float
    options_traded: int
    playbook_id: str | None = None
    followed_rule_ids: list[str] = []
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


class ReplayExecution(CamelModel):
    id: str
    time: str
    epoch: int
    spread: str
    instrument: str
    side: str
    qty: float
    price: float
    commission: float
    fee: float
    position: float | None = None
    adjusted_cost: float | None = None
    adjusted_proceed: float | None = None
    gross_pnl: float | None = None


class Candle(CamelModel):
    time: int
    open: float
    high: float
    low: float
    close: float
    volume: int


class Marker(CamelModel):
    time: int
    price: float
    side: str
    qty: float
    label: str


class RunningPoint(CamelModel):
    time: int
    pnl: float


class MaeMfe(CamelModel):
    mae: float | None = None
    mfe: float | None = None
    entry: float | None = None


class ReplayOut(CamelModel):
    trade: ReplayTrade
    executions: list[ReplayExecution]
    candles: list[Candle]
    markers: list[Marker]
    running_pnl: list[RunningPoint]
    mae_mfe: MaeMfe
    prev_trade_id: str | None = None
    next_trade_id: str | None = None
    interval: str
    day: str