export interface KpiSummary {
  netPnl: number;
  tradeExpectancy: number;
  profitFactor: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
}

export interface ScoreAxis {
  axis: "Win %" | "Avg win/loss" | "Profit factor";
  value: number;
}

export interface CumulativePoint {
  date: string;
  value: number;
}

export interface DailyPnl {
  date: string;
  pnl: number;
  trades: number;
}

export interface TradeRow {
  id: string;
  closeDate: string;
  symbol: string;
  netPnl: number;
  qty: number;
}

export interface CalendarMonth {
  month: string;
  days: DailyPnl[];
}

export interface DashboardData {
  kpi: KpiSummary;
  score: { value: number; axes: ScoreAxis[] };
  cumulative: CumulativePoint[];
  daily: DailyPnl[];
  recentTrades: TradeRow[];
  openPositions: TradeRow[];
  calendar: CalendarMonth;
  rangeLabel: string;
  lastImportAt: string;
}

export interface Account {
  id: string;
  name: string;
  broker: string;
  timezone: string;
}

export interface ExecutionInput {
  date: string;
  time: string;
  qty: number;
  side: "buy" | "sell";
  price: number;
  commission: number;
  fee: number;
}

export interface ManualTradePayload {
  accountId: string;
  symbol: string;
  assetType: string;
  timezone: string;
  executions: ExecutionInput[];
}

export interface ImportResult {
  importedTrades: number;
  importedExecutions: number;
  skippedRows: number;
}

export interface BrokerConnection {
  id: string;
  broker: string;
  label: string;
  status: string;
  lastSyncAt: string | null;
}

// ---- Daily Journal ----
export interface TradeLogRow {
  id: string;
  openTime: string;
  ticker: string;
  side: string;
  instrument: string;
  netPnl: number;
  netRoi: number | null;
  realizedR: number | null;
  playbook: string | null;
  tags: string | null;
}

export interface DaySummary {
  date: string;
  label: string;
  netPnl: number;
  totalTrades: number;
  winners: number;
  losers: number;
  winrate: number;
  grossPnl: number;
  commissions: number;
  volume: number;
  profitFactor: number;
  hasNote: boolean;
  note: string | null;
  trades: TradeLogRow[];
}

export interface MonthJournal {
  month: string;
  days: DaySummary[];
}

// ---- Trade Replay ----
export interface TradeSummary {
  id: string;
  symbol: string;
  instrument: string;
  status: string;
  netPnl: number;
  openDate: string;
}

export interface ReplayTrade {
  id: string;
  symbol: string;
  instrument: string;
  assetType: string;
  status: string;
  side: string;
  openDate: string;
  closeDate: string | null;
  dayLabel: string;
  netPnl: number;
  netRoi: number | null;
  realizedR: number | null;
  plannedR: number | null;
  adjustedCost: number;
  commissionsFees: number;
  optionsTraded: number;
  note: string | null;
  rating: number | null;
  playbook: string | null;
  tags: string | null;
  setups: string | null;
  mistakes: string | null;
  customTags: string | null;
  profitTarget: number | null;
  stopLoss: number | null;
  initialTarget: number | null;
}

export interface ReplayExecution {
  id: string;
  time: string;
  epoch: number;
  spread: string;
  instrument: string;
  side: string;
  qty: number;
  price: number;
  commission: number;
  fee: number;
  position: number | null;
  adjustedCost: number | null;
  adjustedProceed: number | null;
  grossPnl: number | null;
}

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Marker {
  time: number;
  price: number;
  side: string;
  qty: number;
  label: string;
}

export interface RunningPoint {
  time: number;
  pnl: number;
}

export interface MaeMfe {
  mae: number | null;
  mfe: number | null;
  entry: number | null;
}

export interface ReplayData {
  trade: ReplayTrade;
  executions: ReplayExecution[];
  candles: Candle[];
  markers: Marker[];
  runningPnl: RunningPoint[];
  maeMfe: MaeMfe;
  prevTradeId: string | null;
  nextTradeId: string | null;
  interval: string;
  day: string;
}

export type ChartStyle = "lightweight" | "simple";

// ---- Playbooks ----
export interface PlaybookListItem {
  id: string; name: string; description: string | null; icon: string; color: string; visibility: string;
  trades: number; netPnl: number; winRate: number; missedTrades: number; expectancy: number; sharedCount: number;
}
export interface PlaybookRule {
  id: string; name: string; visibility: string; position: number;
  followRate: number | null; netPnl: number | null; profitFactor: number | null; winRate: number | null;
}
export interface PlaybookGroup { id: string; name: string; position: number; rules: PlaybookRule[] }
export interface PlaybookDetail {
  id: string; name: string; description: string | null; icon: string; color: string; visibility: string;
  groups: PlaybookGroup[];
}
export interface PlaybookOverview {
  kpis: {
    netPnl: number; trades: number; winRate: number; profitFactor: number; missedTrades: number;
    expectancy: number; rulesFollowed: number | null; averageWinner: number; averageLoser: number;
    largestProfit: number; largestLoss: number; totalRMultiple: number | null;
  };
  cumulative: { date: string; value: number }[];
}
export interface ExecutedRow {
  id: string; openDate: string; symbol: string; status: string; closeDate: string | null;
  entryPrice: number | null; exitPrice: number | null; netPnl: number; netRoi: number | null;
  setups: string | null; accountName: string | null;
}
export interface MissedRow {
  id: string; openDate: string; symbol: string; status: string; closeDate: string;
  entryPrice: number; exitPrice: number; netPnl: number; netRoi: number; setups: string | null;
}
export interface PlaybookNote { id: string; title: string; body: string | null; createdAt: string; updatedAt: string }
export interface WithRulesRule { id: string; name: string; visibility: string }
export interface WithRulesGroup { id: string; name: string; rules: WithRulesRule[] }
export interface WithRulesPlaybook { id: string; name: string; groups: WithRulesGroup[] }

// ---- Trade Log ----
export interface LogRow {
  id: string; openDate: string; symbol: string; status: string; closeDate: string | null;
  entryPrice: number | null; exitPrice: number | null; netPnl: number; netRoi: number | null;
  realizedR: number | null; setups: string | null; playbookName: string | null; accountName: string | null;
  mae: number | null; mfe: number | null; bestExitPct: number | null;
}
export interface LogKpis {
  netPnl: number; trades: number; winRate: number; profitFactor: number;
  avgWin: number; avgLoss: number; expectancy: number; cumulative: { date: string; value: number }[];
}
export interface LogPage { rows: LogRow[]; total: number; page: number; pages: number; perPage: number; kpis: LogKpis }
export interface TradePreview {
  id: string; symbol: string; dayLabel: string; status: string; entryPrice: number | null; exitPrice: number | null;
  netPnl: number; netRoi: number | null; realizedR: number | null; mae: number | null; mfe: number | null;
  bestExitPct: number | null; setups: string | null; accountName: string | null; candles: Candle[];
}
export interface LogFilters {
  status?: string; symbol?: string; setup?: string; accountId?: string; dateFrom?: string; dateTo?: string;
  sort?: string; direction?: "asc" | "desc"; page?: number; perPage?: number;
}

// ---- Backtesting ----
export interface BtSessionListItem {
  id: string; name: string; description: string | null; symbol: string; assetType: string; interval: string;
  visibility: string; startBalance: number; currentBalance: number; realizedPnl: number; winRate: number;
  tradeCount: number; drawdown: number; completionPct: number; startDate: string; endDate: string; playbookName: string | null;
}
export interface BtOrderPayload {
  side: "buy" | "sell"; type: "market" | "limit"; qty: number; limitPrice?: number | null;
  tp?: number | null; sl?: number | null; riskPct?: number | null; basis?: "current" | "initial";
}
export interface BtAction { id: string; atTime: number; kind: "order" | "cancel" | "close" | "modify" | "note" | "tag"; payload: Record<string, unknown>; }
export interface BtPos { id: string; side: "buy" | "sell"; qty: number; entry: number; entryTime: number; tp: number | null; sl: number | null; }
export interface BtPending { id: string; side: "buy" | "sell"; qty: number; limit: number; tp: number | null; sl: number | null; }
export interface BtRealized { id: string; side: string; qty: number; entry: number; exit: number; entryTime: number; exitTime: number; pnl: number; reason: string; tp: number | null; sl: number | null; }
export interface BtEvent { time: number; type: string; label: string; pnl: number; }
export interface BtEquityPoint { time: number; value: number; }
export interface BtState { balance: number; open: BtPos[]; pending: BtPending[]; realized: BtRealized[]; events: BtEvent[]; equity: BtEquityPoint[]; }
export interface BtRun {
  session: { id: string; name: string; description: string | null; symbol: string; assetType: string; interval: string;
    startBalance: number; startDate: string; endDate: string; lastTime: number | null; playbookId: string | null; visibility: string; };
  candles: Candle[]; actions: BtAction[]; baseInterval: string; availableFrom: number | null; totalCandles: number;
}

export interface BtShare { id: string; userId: string; email: string; name: string; }

// ---- Settings ----
export interface Profile {
  id: string; email: string; displayName: string | null; avatar: string;
  chartStyle: string; themePref: string; tenantName: string; createdAt: string;
}



// ---- Notebook ----
export interface NbFolder { id: string; name: string; color: string; kind: string; linkType: string | null; count: number; }
export interface NbTag { id: string; name: string; count: number; }
export interface NbTree { folders: NbFolder[]; tags: NbTag[]; deletedCount: number; allCount: number; }
export interface NbListItem { id: string; title: string; folderId: string | null; linkType: string; linkId: string | null; source: string; starred: boolean; shares: number; netPnl: number | null; subtitle: string | null; updatedAt: string; }
export interface NbStatKV { label: string; value: string; tone?: string | null; }
export interface NbDetail { id: string; title: string; bodyHtml: string; linkType: string; linkId: string | null; source: string; starred: boolean; shareToken: string | null; createdAt: string; updatedAt: string; tags: string[]; stats: NbStatKV[]; headlinePnl: number | null; chart: { date: string; value: number }[]; tradeIds: string[]; readonly: boolean; }
export interface NbTemplate { id: string; name: string; bodyHtml: string; category: string; isBuiltin: boolean; favourite: boolean; }


// ---- Reports ----
export interface RpCaps { [k: string]: boolean; }
export interface RpBucket { key: string; label: string; trades: number; wins: number; losses: number; breakeven: number; winRate: number | null; net: number; gross: number | null; avgWin: number | null; avgLoss: number | null; volume: number; avgHoldSec: number | null; best: number | null; worst: number | null; avgR: number | null; }
export interface RpCard { kind: string; title: string; label: string; value: string; sub?: string | null; tone?: string | null; }
export interface RpCrossCell { row: string; col: string; trades: number; net: number; winRate: number | null; avgR: number | null; }
export interface RpDimension { dimension: string; available: boolean; note?: string | null; cards: RpCard[]; series: RpBucket[]; table: RpBucket[]; crossRows: string[]; crossCols: string[]; cross: RpCrossCell[]; }
export interface RpCross { available: boolean; rows: string[]; cols: string[]; cells: RpCrossCell[]; note?: string | null; }
export interface RpMetricPoint { t: string; v: number | null; }
export interface RpMetricSeries { metric: string; label: string; unit: string; points: RpMetricPoint[]; }
export interface RpPerformance { series: RpMetricSeries[]; summary: { label: string; value: string; tone?: string | null }[]; }
export interface RpOverview { bestMonth: any; lowestMonth: any; avgMonth: any; left: { label: string; value: string; tone?: string | null }[]; right: { label: string; value: string; tone?: string | null }[]; }
export interface RpCompareGroup { stats: { label: string; value: string; tone?: string | null }[]; winRate: number | null; winners: number; losers: number; curve: RpMetricPoint[]; }
export interface RpCompare { a: RpCompareGroup; b: RpCompareGroup; }
export interface RpCalendar { month: string; days: { d: string; net: number; trades: number; winRate: number | null }[]; total: number; tradingDays: number; bestDay: any; worstDay: any; }
export interface RpFilters { start?: string; end?: string; accounts?: string[]; symbols?: string[]; playbooks?: string[]; sides?: string[]; statuses?: string[]; pnlBasis?: string; }


// ---- Analytics ----
export interface AnaKpi {
  label: string;
  value: string;
  sub?: string | null;
  tone?: string | null;
}

export interface AnaEquityPoint {
  t: string;
  equity: number;
  drawdown: number;
  daily: number;
}

export interface AnaBucket {
  label: string;
  net: number;
  trades: number;
  winRate: number | null;
  avg: number | null;
}

export interface AnaDistBucket {
  label: string;
  count: number;
  net: number;
}

export interface AnaSymbolMonth {
  month: string;
  values: Record<string, number>;
}

export interface AnaScatterPoint {
  x: number;
  y: number;
  label: string;
  tone: string;
}

export interface AnaRadarScore {
  subject: string;
  score: number;
}

export interface AnaInsight {
  title: string;
  text: string;
  tone?: string | null;
}

export interface AnaStreaks {
  maxWin: number;
  maxLoss: number;
  current: number;
  currentType: string;
}

export interface AnalyticsOut {
  meta: Record<string, any>;
  kpis: AnaKpi[];
  equity: AnaEquityPoint[];
  monthly: AnaBucket[];
  distribution: AnaDistBucket[];
  symbols: AnaBucket[];
  symbolMonthly: AnaSymbolMonth[];
  playbooks: AnaBucket[];
  hours: AnaBucket[];
  dows: AnaBucket[];
  durations: AnaBucket[];
  scatter: AnaScatterPoint[];
  radar: AnaRadarScore[];
  streaks: AnaStreaks;
  insights: AnaInsight[];

  monteCarlo: AnaMonteCarlo | null;
  regime: AnaRegime | null;
  attribution: AnaAttribution | null;
  narrative: AnaNarrative[];
}

export interface AnaMcBand { step: number; p05: number; p25: number; p50: number; p75: number; p95: number; }
export interface AnaMcPoint { label: string; count: number; }
export interface AnaMonteCarlo { sims: number; horizon: number; probNegative: number; worstDd95: number; medianFinal: number; expectedFinal: number; band: AnaMcBand[]; ddHist: AnaMcPoint[]; }
export interface AnaRegimeCell { frm: string; to: string; count: number; prob: number; }
export interface AnaRegime { states: string[]; cells: AnaRegimeCell[]; afterWinExp: number | null; afterLossExp: number | null; tiltScore: number | null; verdict: string; }
export interface AnaAttrItem { label: string; value: number; share: number; expDelta: number | null; }
export interface AnaAttrDim { dimension: string; label: string; items: AnaAttrItem[]; }
export interface AnaWaterfall { label: string; delta: number; base: number; height: number; positive: boolean; cumulative: number; }
export interface AnaAttribution { dims: AnaAttrDim[]; waterfall: AnaWaterfall[]; total: number; }
export interface AnaNarrative { heading: string; body: string; tone?: string | null; }

