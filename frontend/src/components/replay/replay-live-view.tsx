"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createChart, ColorType, CrosshairMode, LineStyle,
  type IChartApi, type ISeriesApi, type UTCTimestamp, type CandlestickData, type HistogramData, type SeriesMarker,
} from "lightweight-charts";
import {
  ArrowLeft, Camera, ChevronDown, Crosshair, Eraser, Eye, Lock, Maximize2, Minimize2,
  Pause, Play, Ruler, Settings2, SkipBack, SkipForward, Trash2, TrendingUp, Type,
} from "lucide-react";
import { Area, AreaChart, CartesianGrid, ReferenceDot, ReferenceLine, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { cn, money } from "@/lib/utils";
import { api } from "@/lib/api";
import { clientGetToken } from "@/lib/auth";
import type { Candle, ChartStyle, Marker, ReplayData, ReplayExecution, TradeSummary } from "@/types";

const INTERVALS = ["1m", "5m", "15m", "1h", "1d"];
const SPEEDS = [1, 2, 5, 10];
const BASE_MS = 600; // ms per candle at 1x
const todayISO = () => new Date().toISOString().slice(0, 10);
const prevISO = (d: string) => { const x = new Date(d + "T00:00:00Z"); x.setUTCDate(x.getUTCDate() - 1); return x.toISOString().slice(0, 10); };
const fmtClock = (t: number) => `${new Date(t * 1000).toISOString().slice(11, 19)} UTC`;
const fmtHM = (t: number) => new Date(t * 1000).toISOString().slice(11, 16);

/* ---------------- dark chart with progressive reveal + real price lines ---------------- */
function LiveChart({ candles, markers, entry, stop, target, initTarget }:
  { candles: Candle[]; markers: Marker[]; entry: number | null; stop: number | null; target: number | null; initTarget: number | null }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volRef = useRef<ISeriesApi<"Histogram"> | null>(null);

  useEffect(() => {
    if (!wrapRef.current) return;
    const chart = createChart(wrapRef.current, {
      height: wrapRef.current.clientHeight || 520,
      layout: { background: { type: ColorType.Solid, color: "#0B0E14" }, textColor: "#8A93A6", fontSize: 10 },
      grid: { vertLines: { color: "#161B27" }, horzLines: { color: "#161B27" } },
      rightPriceScale: { borderColor: "#1B2030" },
      timeScale: { borderColor: "#1B2030", timeVisible: true, secondsVisible: false },
      crosshair: { mode: CrosshairMode.Normal },
    });
    const cs = chart.addCandlestickSeries({ upColor: "#26A69A", downColor: "#EF5350", borderUpColor: "#26A69A", borderDownColor: "#EF5350", wickUpColor: "#26A69A", wickDownColor: "#EF5350" });
    const vs = chart.addHistogramSeries({ priceFormat: { type: "volume" }, priceScaleId: "" });
    vs.priceScale().applyOptions({ scaleMargins: { top: 0.86, bottom: 0 } });
    chartRef.current = chart; seriesRef.current = cs; volRef.current = vs;

    const addLine = (price: number | null, color: string, title: string, style: LineStyle) => {
      if (price == null) return;
      cs.createPriceLine({ price, color, lineWidth: 1, lineStyle: style, axisLabelVisible: true, title });
    };
    addLine(entry, "#E2E8F0", "ENTRY", LineStyle.Solid);
    addLine(stop, "#EF5350", "STOP", LineStyle.Dashed);
    addLine(target, "#26A69A", "TARGET", LineStyle.Dashed);
    addLine(initTarget, "#F5A524", "INIT TGT", LineStyle.Dotted);

    const ro = new ResizeObserver(() => chart.applyOptions({ width: wrapRef.current!.clientWidth, height: wrapRef.current!.clientHeight }));
    ro.observe(wrapRef.current);
    return () => { ro.disconnect(); chart.remove(); chartRef.current = null; seriesRef.current = null; volRef.current = null; };
  }, [entry, stop, target, initTarget]);

  useEffect(() => {
    if (!seriesRef.current || !volRef.current) return;
    seriesRef.current.setData(candles.map((c) => ({ time: c.time as UTCTimestamp, open: c.open, high: c.high, low: c.low, close: c.close })) as CandlestickData[]);
    volRef.current.setData(candles.map((c) => ({ time: c.time as UTCTimestamp, value: c.volume, color: c.close >= c.open ? "rgba(38,166,154,.30)" : "rgba(239,83,80,.30)" })) as HistogramData[]);
    const sm: SeriesMarker<UTCTimestamp>[] = markers.map((m) => ({
      time: m.time as UTCTimestamp, position: m.side === "buy" ? "belowBar" : "aboveBar",
      color: m.side === "buy" ? "#26A69A" : "#EF5350", shape: m.side === "buy" ? "arrowUp" : "arrowDown", text: m.label,
    }));
    seriesRef.current.setMarkers(sm);
    chartRef.current?.timeScale().scrollToRealTime();
  }, [candles, markers]);

  return <div ref={wrapRef} className="h-full w-full" />;
}

/* ---------------- toolbar (real crosshair + honest disabled premium tools) ---------------- */
function ToolBtn({ icon, label, active, disabled, onClick }:
  { icon: React.ReactNode; label: string; active?: boolean; disabled?: boolean; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={disabled ? `${label} — premium charting (roadmap)` : label}
      className={cn(
        "grid h-8 w-8 place-items-center rounded-md transition-colors",
        active ? "bg-primary-500/20 text-primary-300" : "text-slate-400 hover:bg-white/5 hover:text-slate-200",
        disabled && "cursor-not-allowed opacity-40 hover:bg-transparent hover:text-slate-400",
      )}
    >
      {icon}
    </button>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "pos" | "neg" }) {
  return (
    <div className="flex items-center justify-between border-b border-white/5 py-1.5 last:border-0">
      <span className="text-[10px] uppercase tracking-wide text-slate-500">{label}</span>
      <span className={cn("text-[11px] font-bold tabular-nums", tone === "pos" ? "text-emerald-400" : tone === "neg" ? "text-rose-400" : "text-slate-200")}>{value}</span>
    </div>
  );
}

function SimpleLiveChart({ candles, markers, entry, stop, target, initTarget }: { candles: Candle[]; markers: Marker[]; entry: number | null; stop: number | null; target: number | null; initTarget: number | null }) {
  const fmtTime = (t: number) => new Date(t * 1000).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
  const data = candles.map((c) => ({ time: fmtTime(c.time), price: c.close }));
  const dots = markers.map((m) => ({ x: fmtTime(m.time), y: m.price, buy: m.side === "buy", label: m.label }));
  const allPrices = [...candles.flatMap((c) => [c.low, c.high, c.close]), ...markers.map((m) => m.price), ...(entry != null ? [entry] : []), ...(stop != null ? [stop] : []), ...(target != null ? [target] : []), ...(initTarget != null ? [initTarget] : [])];
  const yMin = allPrices.length ? Math.min(...allPrices) : 0;
  const yMax = allPrices.length ? Math.max(...allPrices) : 1;
  const pad = (yMax - yMin) * 0.12 || 1;
  const lineLabels = [
    ...(entry != null ? [{ price: entry, color: "#E2E8F0", label: "ENTRY" }] : []),
    ...(stop != null ? [{ price: stop, color: "#EF5350", label: "STOP" }] : []),
    ...(target != null ? [{ price: target, color: "#26A69A", label: "TARGET" }] : []),
    ...(initTarget != null ? [{ price: initTarget, color: "#F5A524", label: "INIT TGT" }] : []),
  ];

  return (
    <div className="h-full w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 14, left: 6, bottom: 0 }}>
          <defs>
            <linearGradient id="simpleLiveFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#8B5CF6" stopOpacity={0.38} />
              <stop offset="100%" stopColor="#8B5CF6" stopOpacity={0.08} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#1C2435" strokeDasharray="3 3" />
          <XAxis dataKey="time" tick={{ fontSize: 9, fill: "#9AA0B4" }} minTickGap={30} interval={0} />
          <YAxis domain={[yMin - pad, yMax + pad]} tick={{ fontSize: 9, fill: "#9AA0B4" }} tickFormatter={(v) => `$${Number(v).toFixed(2)}`} width={62} />
          {lineLabels.map((line) => (
            <ReferenceLine
              key={`${line.label}-${line.price}`}
              y={line.price}
              stroke={line.color}
              strokeDasharray="5 7"
              strokeWidth={1.2}
              ifOverflow="extendDomain"
              label={{ value: `${line.label} ${line.price.toFixed(2)}`, position: "right", fill: line.color, fontSize: 11, fontWeight: 700 }}
            />
          ))}
          {dots.map((pt, idx) => (
            <ReferenceDot
              key={`${pt.label}-${idx}`}
              x={pt.x}
              y={pt.y}
              r={4.5}
              fill={pt.buy ? "#12B981" : "#E5484D"}
              stroke="#0B0E14"
              strokeWidth={1.5}
            />
          ))}
          <Area type="monotone" dataKey="price" stroke="#C4B5FD" strokeWidth={2.5} fill="url(#simpleLiveFill)" isAnimationActive animationDuration={220} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function Chip({ text, tone }: { text: string; tone: "purple" | "amber" }) {
  return <span className={cn("rounded-full px-2 py-0.5 text-[9px] font-bold", tone === "purple" ? "bg-primary-500/20 text-primary-300" : "bg-amber-500/20 text-amber-300")}>{text}</span>;
}

/* ---------------- main immersive view ---------------- */
export function ReplayLiveView({ tradeId, day }: { tradeId: string | null; day: string | null }) {
  const router = useRouter();
  const tok = useCallback(() => clientGetToken() ?? undefined, []);
  const shellRef = useRef<HTMLDivElement>(null);

  const [activeId, setActiveId] = useState<string | null>(tradeId);
  const [data, setData] = useState<ReplayData | null>(null);
  const [dayTrades, setDayTrades] = useState<TradeSummary[]>([]);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [interval, setInterval] = useState("1m");
  const [chartStyle, setChartStyle] = useState<ChartStyle>("lightweight");
  const [idx, setIdx] = useState(1);            // revealed candle count
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [full, setFull] = useState(false);
  const [crosshairOn, setCrosshairOn] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const effDay = data?.day ?? day ?? null;

  useEffect(() => { api.users.getMe(tok()).then((u) => setChartStyle((u.chartStyle as ChartStyle) ?? "lightweight")).catch(() => {}); }, [tok]);

  async function saveStyle(s: ChartStyle) {
    setChartStyle(s);
    await api.users.setChartStyle(s, tok());
  }

  // resolve a trade when opened without one (today's latest)
  useEffect(() => {
    if (activeId) return;
    api.trades.forReplay(undefined, tok())
      .then((r) => { if (r.tradeId) setActiveId(r.tradeId); else { setLoading(false); setErr("No trades to replay today."); } })
      .catch(() => { setLoading(false); setErr("Could not resolve a trade."); });
  }, [activeId, tok]);

  // load selected trade's executions/stats
  useEffect(() => {
    if (!activeId) return;
    let alive = true; setLoading(true); setErr(null);
    api.trades.replay(activeId, "1m", tok())
      .then((d) => { if (alive) { setData(d); setIdx(1); setPlaying(false); } })
      .catch((e) => { if (alive) setErr(e instanceof Error ? e.message : "Failed to load replay"); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [activeId, tok]);

  // sibling trades for the symbol selector
  useEffect(() => {
    if (!effDay) { setDayTrades([]); return; }
    let alive = true;
    api.trades.byDay(effDay, tok()).then((l) => { if (alive) setDayTrades(l); }).catch(() => { if (alive) setDayTrades([]); });
    return () => { alive = false; };
  }, [effDay, tok]);

  // candles (with weekend/holiday fallback) — reset playback whenever they change
  useEffect(() => {
    const sym = data?.trade.symbol;
    if (!sym || !effDay) { setCandles([]); return; }
    let alive = true;
    (async () => {
      let cur = effDay, lastErr: string | null = null, got: Candle[] = [];
      for (let i = 0; i < 6; i++) {
        try { const c = await api.market.candles(sym, cur, interval, tok()); if (c && c.length) { got = c; break; } }
        catch (e) { lastErr = e instanceof Error ? e.message : "candles unavailable"; }
        cur = prevISO(cur);
      }
      if (!alive) return;
      setCandles(got); setIdx(1); setPlaying(false);
      if (!got.length && lastErr) setErr(lastErr);
    })();
    return () => { alive = false; };
  }, [data?.trade.symbol, effDay, interval, tok]);

  // playback ticker
  useEffect(() => {
    if (!playing || candles.length === 0) return;
    if (idx >= candles.length) { setPlaying(false); return; }
    const t = setTimeout(() => setIdx((i) => Math.min(candles.length, i + 1)), BASE_MS / speed);
    return () => clearTimeout(t);
  }, [playing, idx, speed, candles.length]);

  // fullscreen state sync
  useEffect(() => {
    const on = () => setFull(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", on);
    return () => document.removeEventListener("fullscreenchange", on);
  }, []);
  const toggleFull = () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else shellRef.current?.requestFullscreen().catch(() => {});
  };

  const visible = useMemo(() => candles.slice(0, idx), [candles, idx]);
  const curTime = visible.at(-1)?.time ?? 0;
  const visibleMarkers = useMemo(() => (data?.markers ?? []).filter((m) => m.time <= curTime), [data, curTime]);
  const printedFills = useMemo(
    () => (data?.executions ?? []).filter((e) => e.epoch <= curTime).sort((a, b) => b.epoch - a.epoch),
    [data, curTime],
  );
  const entryPrice = data?.markers?.[0]?.price ?? null;
  const durationSec = data ? Math.max(0, curTime - Math.floor(Date.parse(data.trade.openDate) / 1000)) : 0;
  const durLabel = `${Math.floor(durationSec / 60)}m ${durationSec % 60}s`;

  const togglePlay = () => {
    if (candles.length === 0) return;
    if (!playing && idx >= candles.length) setIdx(1);
    setPlaying((p) => !p);
  };
  const step = (n: number) => { setPlaying(false); setIdx((i) => Math.min(Math.max(1, i + n), Math.max(1, candles.length))); };
  const goTrade = (id: string) => { setActiveId(id); };
  const back = () => router.replace(effDay ? `/replay?trade=${activeId}&day=${effDay}` : "/replay");

  const setupChips = (data?.trade.setups ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const mistakeChips = (data?.trade.mistakes ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const customChips = (data?.trade.customTags ?? "").split(",").map((s) => s.trim()).filter(Boolean);

  return (
    <div ref={shellRef} className="flex h-screen w-screen flex-col overflow-hidden bg-[#0B0E14] text-slate-200">
      {/* ===== top bar: back · symbol · transport · scrubber · clock · date · speed · fullscreen ===== */}
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-white/5 bg-[#0E1117] px-3">
        <button onClick={back} className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-bold text-slate-300 hover:bg-white/5">
          <ArrowLeft size={14} /> BACK
        </button>

        <div className="relative">
          <select
            value={activeId ?? ""}
            onChange={(e) => goTrade(e.target.value)}
            className="appearance-none rounded-md border border-white/10 bg-[#161B27] py-1 pl-2.5 pr-7 text-[11px] font-bold text-slate-100 outline-none"
          >
            {dayTrades.length === 0 && activeId && <option value={activeId}>{data?.trade.symbol ?? "—"}</option>}
            {dayTrades.map((x) => <option key={x.id} value={x.id}>{x.symbol}</option>)}
          </select>
          <ChevronDown size={12} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-slate-500" />
        </div>

        <div className="flex items-center gap-1">
          <button onClick={() => step(-10)} title="Rewind 10" className="grid h-7 w-7 place-items-center rounded text-slate-300 hover:bg-white/5"><SkipBack size={14} /></button>
          <button onClick={togglePlay} title={playing ? "Pause" : "Play"} className="grid h-7 w-7 place-items-center rounded-full bg-primary-500 text-white hover:bg-primary-600">
            {playing ? <Pause size={14} /> : <Play size={14} className="ml-0.5" />}
          </button>
          <button onClick={() => step(10)} title="Forward 10" className="grid h-7 w-7 place-items-center rounded text-slate-300 hover:bg-white/5"><SkipForward size={14} /></button>
        </div>

        {/* scrubber */}
        <div className="relative flex-1 px-2">
          <div className="pointer-events-none absolute -top-0.5 left-1/2 -translate-x-1/2 text-[9px] font-bold tabular-nums text-slate-400">{curTime ? fmtHM(curTime) : ""}</div>
          <input
            type="range" min={1} max={Math.max(1, candles.length)} value={idx}
            onChange={(e) => { setPlaying(false); setIdx(Number(e.target.value)); }}
            className="h-1 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-primary-500"
          />
        </div>

        <span className="w-24 text-right text-[11px] font-bold tabular-nums text-slate-300">{curTime ? fmtClock(curTime) : "--:--:--"}</span>
        <span className="rounded border border-white/10 px-1.5 py-0.5 text-[9px] font-bold text-slate-400">{effDay ?? ""}</span>
        <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))} className="rounded border border-white/10 bg-[#161B27] px-1.5 py-0.5 text-[10px] font-bold text-slate-200 outline-none">
          {SPEEDS.map((s) => <option key={s} value={s}>{s}x</option>)}
        </select>
        <button onClick={toggleFull} title={full ? "Exit fullscreen" : "Fullscreen"} className="grid h-7 w-7 place-items-center rounded text-slate-300 hover:bg-white/5">
          {full ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
        </button>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* ===== left rail: real stats + tags + your executions ===== */}
        <aside className="flex w-60 shrink-0 flex-col gap-3 overflow-y-auto border-r border-white/5 bg-[#0E1117] p-3 scrollbar-thin">
          <div>
            <p className="text-base font-black text-white">{data?.trade.symbol ?? "—"}</p>
            <p className="text-[10px] text-slate-500">{data?.trade.dayLabel ?? ""}</p>
            <p className="text-[9px] text-slate-600">{data?.trade.instrument ?? ""}</p>
          </div>

          <div className="flex items-center justify-between rounded-md bg-white/[0.03] px-2 py-1.5">
            <span className="text-[10px] font-extrabold uppercase tracking-wide text-rose-400">Net P&L</span>
            <span className={cn("text-sm font-black tabular-nums", (data?.trade.netPnl ?? 0) >= 0 ? "text-emerald-400" : "text-rose-400")}>{money(data?.trade.netPnl ?? 0, { sign: true })}</span>
          </div>

          <div>
            <Stat label="Net ROI" value={data?.trade.netRoi == null ? "--" : `${data.trade.netRoi.toFixed(2)}%`} tone={data && data.trade.netRoi != null ? (data.trade.netRoi >= 0 ? "pos" : "neg") : undefined} />
            <Stat label="Options traded" value={String(data?.trade.optionsTraded ?? 0)} />
            <Stat label="Adjusted cost" value={money(data?.trade.adjustedCost ?? 0)} />
            <Stat label="Gross P&L" value={money(data?.trade.netPnl ?? 0)} tone={(data?.trade.netPnl ?? 0) >= 0 ? "pos" : "neg"} />
            <Stat label="Trade duration" value={durLabel} />
          </div>

          <div>
            <p className="mb-1 text-[9px] font-bold uppercase tracking-wide text-slate-500">Tags</p>
            <div className="flex flex-wrap gap-1">
              {setupChips.map((s, i) => <Chip key={`s${i}`} text={s} tone="purple" />)}
              {mistakeChips.map((s, i) => <Chip key={`m${i}`} text={s} tone="amber" />)}
              {customChips.map((s, i) => <span key={`c${i}`} className="rounded-full bg-white/5 px-2 py-0.5 text-[9px] font-bold text-slate-300">{s}</span>)}
              {!setupChips.length && !mistakeChips.length && !customChips.length && <span className="text-[9px] text-slate-600">no tags</span>}
            </div>
          </div>

          <div className="min-h-0 flex-1">
            <p className="mb-1 text-[9px] font-bold uppercase tracking-wide text-slate-500">Your executions</p>
            <div className="overflow-hidden rounded-md border border-white/5">
              <table className="w-full text-left text-[10px]">
                <thead><tr className="bg-white/[0.03] text-[8px] uppercase text-slate-500"><th className="px-2 py-1">Time</th><th className="px-2 py-1 text-right">Price</th><th className="px-2 py-1 text-right">Qty</th></tr></thead>
                <tbody>
                  {(data?.executions ?? []).map((e) => (
                    <tr key={e.id} className="border-t border-white/5">
                      <td className="px-2 py-1 tabular-nums text-slate-400">{e.time.slice(11, 19)}</td>
                      <td className={cn("px-2 py-1 text-right font-bold tabular-nums", e.side === "buy" ? "text-emerald-400" : "text-rose-400")}>{money(e.price)}</td>
                      <td className="px-2 py-1 text-right tabular-nums text-slate-300">{Math.abs(e.qty)}</td>
                    </tr>
                  ))}
                  {(!data || data.executions.length === 0) && <tr><td colSpan={3} className="px-2 py-3 text-center text-[9px] text-slate-600">booked‑outcome demo row (no recorded fills)</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </aside>

        {/* ===== center: toolbar + chart + bottom strip ===== */}
        <main className="flex min-w-0 flex-1 flex-col">
          <div className="flex min-h-0 flex-1">
            {/* drawing toolbar: crosshair real, rest honest-disabled */}
            <div className="flex w-9 shrink-0 flex-col items-center gap-0.5 border-r border-white/5 bg-[#0E1117] py-2">
              <ToolBtn icon={<Crosshair size={15} />} label="Crosshair" active={crosshairOn} onClick={() => setCrosshairOn((v) => !v)} />
              <ToolBtn icon={<TrendingUp size={15} />} label="Trendline" disabled />
              <ToolBtn icon={<Ruler size={15} />} label="Measure" disabled />
              <ToolBtn icon={<Type size={15} />} label="Text note" disabled />
              <ToolBtn icon={<Eraser size={15} />} label="Eraser" disabled />
              <ToolBtn icon={<Lock size={15} />} label="Lock drawings" disabled />
              <ToolBtn icon={<Eye size={15} />} label="Hide drawings" disabled />
              <ToolBtn icon={<Trash2 size={15} />} label="Clear drawings" disabled />
              <div className="my-1 h-px w-5 bg-white/10" />
              <ToolBtn icon={<Camera size={15} />} label="Snapshot" disabled />
              <ToolBtn icon={<Settings2 size={15} />} label="Chart settings" disabled />
            </div>

            <div className="relative min-w-0 flex-1">
              {/* interval row */}
              <div className="absolute left-2 top-2 z-10 flex items-center gap-1">
                {INTERVALS.map((iv) => (
                  <button key={iv} onClick={() => setInterval(iv)} className={cn("rounded px-1.5 py-0.5 text-[9px] font-bold", interval === iv ? "bg-primary-500 text-white" : "text-slate-400 hover:bg-white/5")}>{iv}</button>
                ))}
                <select value={chartStyle} onChange={(e) => saveStyle(e.target.value as ChartStyle)} className="ml-2 rounded border border-white/10 bg-[#161B27] px-1.5 py-0.5 text-[9px] font-bold text-slate-200 outline-none">
                  <option value="lightweight">Lightweight chart</option>
                  <option value="simple">Simple chart</option>
                </select>
              </div>
              {candles.length === 0 ? (
                <div className="grid h-full place-items-center px-6 text-center text-[11px] text-slate-500">
                  {loading ? "Loading market data…" : (err ?? "No candles for this symbol/day. Yahoo free feed = OHLCV only; try a wider interval or another date.")}
                </div>
              ) : chartStyle === "simple" ? (
                <div className="h-full w-full p-2 pt-10">
                  <SimpleLiveChart
                    candles={visible}
                    markers={visibleMarkers}
                    entry={entryPrice}
                    stop={data?.trade.stopLoss ?? null}
                    target={data?.trade.profitTarget ?? null}
                    initTarget={data?.trade.initialTarget ?? null}
                  />
                </div>
              ) : (
                <LiveChart candles={visible} markers={visibleMarkers} entry={entryPrice} stop={data?.trade.stopLoss ?? null} target={data?.trade.profitTarget ?? null} initTarget={data?.trade.initialTarget ?? null} />
              )}
            </div>
          </div>

          {/* bottom strip: real own-fills tape + honest Level II placeholder */}
          <div className="grid h-44 shrink-0 grid-cols-2 gap-px border-t border-white/5 bg-white/5">
            <section className="flex min-h-0 flex-col bg-[#0E1117]">
              <p className="border-b border-white/5 px-3 py-1.5 text-[9px] font-bold uppercase tracking-wide text-slate-500">Time &amp; Sales · your fills</p>
              <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">
                <table className="w-full text-left text-[10px]">
                  <thead className="sticky top-0 bg-[#0E1117] text-[8px] uppercase text-slate-600"><tr><th className="px-3 py-1">Time</th><th className="px-3 py-1 text-right">Price</th><th className="px-3 py-1 text-right">Qty</th><th className="px-3 py-1">Side</th></tr></thead>
                  <tbody>
                    {printedFills.map((e, i) => (
                      <tr key={e.id} className={cn("border-t border-white/5", i === 0 && "animate-pulse bg-primary-500/10")}>
                        <td className="px-3 py-1 tabular-nums text-slate-400">{e.time.slice(11, 19)}</td>
                        <td className="px-3 py-1 text-right font-bold tabular-nums text-slate-200">{money(e.price)}</td>
                        <td className="px-3 py-1 text-right tabular-nums text-slate-300">{Math.abs(e.qty)}</td>
                        <td className={cn("px-3 py-1 font-bold uppercase", e.side === "buy" ? "text-emerald-400" : "text-rose-400")}>{e.side}</td>
                      </tr>
                    ))}
                    {printedFills.length === 0 && <tr><td colSpan={4} className="px-3 py-4 text-center text-[9px] text-slate-600">press play — your fills print here as time advances</td></tr>}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="flex min-h-0 flex-col bg-[#0E1117]">
              <p className="border-b border-white/5 px-3 py-1.5 text-[9px] font-bold uppercase tracking-wide text-slate-500">Level II · order book</p>
              <div className="grid flex-1 place-items-center px-6 text-center">
                <div>
                  <p className="text-[11px] font-bold text-slate-300">Requires a premium market‑data feed</p>
                  <p className="mt-1 text-[10px] leading-relaxed text-slate-500">
                    Live bid/ask depth &amp; the exchange print tape aren't in Yahoo's free OHLCV feed (which powers the playback above).
                    Connect Polygon / Databento / IBKR in <span className="font-mono text-slate-400">market_data.py</span> to unlock this panel — same interface, no UI rework.
                  </p>
                </div>
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}