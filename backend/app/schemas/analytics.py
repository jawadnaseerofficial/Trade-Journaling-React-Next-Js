from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class Kpi(CamelModel):
    label: str
    value: str
    sub: str | None = None
    tone: str | None = None


class EquityPoint(CamelModel):
    t: str
    equity: float
    drawdown: float
    daily: float


class Bucket(CamelModel):
    label: str
    net: float
    trades: int
    win_rate: float | None = None
    avg: float | None = None


class DistBucket(CamelModel):
    label: str
    count: int
    net: float


class SymbolMonth(CamelModel):
    month: str
    values: dict[str, float]


class ScatterPoint(CamelModel):
    x: float
    y: float
    label: str
    tone: str


class RadarScore(CamelModel):
    subject: str
    score: float


class Insight(CamelModel):
    title: str
    text: str
    tone: str | None = None


class Streaks(CamelModel):
    max_win: int
    max_loss: int
    current: int
    current_type: str


# ---- Monte Carlo ----
class McBand(CamelModel):
    step: int
    p05: float
    p25: float
    p50: float
    p75: float
    p95: float


class McPoint(CamelModel):
    label: str
    count: int


class MonteCarlo(CamelModel):
    sims: int
    horizon: int
    prob_negative: float
    worst_dd95: float
    median_final: float
    expected_final: float
    band: list[McBand]
    dd_hist: list[McPoint]


# ---- Regime / Markov ----
class RegimeCell(CamelModel):
    frm: str
    to: str
    count: int
    prob: float


class Regime(CamelModel):
    states: list[str]
    cells: list[RegimeCell]
    after_win_exp: float | None = None
    after_loss_exp: float | None = None
    tilt_score: float | None = None
    verdict: str


# ---- Attribution ----
class AttrItem(CamelModel):
    label: str
    value: float
    share: float
    exp_delta: float | None = None


class AttrDim(CamelModel):
    dimension: str
    label: str
    items: list[AttrItem]


class WaterfallStep(CamelModel):
    label: str
    delta: float
    base: float
    height: float
    positive: bool
    cumulative: float


class Attribution(CamelModel):
    dims: list[AttrDim]
    waterfall: list[WaterfallStep]
    total: float


# ---- Narrative ----
class NarrativeBlock(CamelModel):
    heading: str
    body: str
    tone: str | None = None


class AnalyticsOut(CamelModel):
    meta: dict
    kpis: list[Kpi]
    equity: list[EquityPoint]
    monthly: list[Bucket]
    distribution: list[DistBucket]
    symbols: list[Bucket]
    symbol_monthly: list[SymbolMonth]
    playbooks: list[Bucket]
    hours: list[Bucket]
    dows: list[Bucket]
    durations: list[Bucket]
    scatter: list[ScatterPoint]
    radar: list[RadarScore]
    streaks: Streaks
    insights: list[Insight]
    monte_carlo: MonteCarlo | None = None
    regime: Regime | None = None
    attribution: Attribution | None = None
    narrative: list[NarrativeBlock] = []