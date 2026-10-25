"use client";
import { useEffect, useRef } from "react";
import {
  createChart, ColorType, CrosshairMode, LineStyle,
  type IChartApi, type ISeriesApi, type IPriceLine, type UTCTimestamp, type LineWidth,
  type CandlestickData, type HistogramData, type LineData, type SeriesMarker,
} from "lightweight-charts";
import { Area, AreaChart, ReferenceDot, ResponsiveContainer, XAxis, YAxis } from "recharts";
import type { BtPos, BtRealized, Candle } from "@/types";

const fmt = (t: number) => new Date(t * 1000).toLocaleString("en-US", { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });
const dayKey = (t: number) => new Date(t * 1000).toLocaleDateString("en-CA", { timeZone: "America/New_York" });

function ema(values: number[], period: number): (number | null)[] {
  const k = 2 / (period + 1); const out: (number | null)[] = []; let prev: number | null = null;
  values.forEach((v, i) => { if (i < period - 1) { out.push(null); return; } if (prev == null) { const s = values.slice(0, period).reduce((a, b) => a + b, 0) / period; prev = s; out.push(s); return; } prev = v * k + prev * (1 - k); out.push(prev); });
  return out;
}
function vwap(candles: Candle[]): (number | null)[] {
  const out: (number | null)[] = []; let pk = ""; let cpv = 0; let cv = 0;
  for (const c of candles) { const dk = dayKey(c.time); if (dk !== pk) { pk = dk; cpv = 0; cv = 0; } const tp = (c.high + c.low + c.close) / 3; cpv += tp * c.volume; cv += c.volume; out.push(cv ? cpv / cv : null); }
  return out;
}

export function BacktestChart({ candles, positions, realized, simple, onAdjust, showEma, showVwap }:
  { candles: Candle[]; positions: BtPos[]; realized: BtRealized[]; simple: boolean;
    onAdjust?: (posId: string, field: "tp" | "sl", price: number) => void;
    showEma?: boolean; showVwap?: boolean }) {
  const wrap = useRef<HTMLDivElement>(null);
  const chart = useRef<IChartApi | null>(null);
  const series = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const vol = useRef<ISeriesApi<"Histogram"> | null>(null);
  const ema9 = useRef<ISeriesApi<"Line"> | null>(null);
  const ema21 = useRef<ISeriesApi<"Line"> | null>(null);
  const vw = useRef<ISeriesApi<"Line"> | null>(null);
  const priceLines = useRef<IPriceLine[]>([]);
  const lineMap = useRef<Map<string, IPriceLine>>(new Map()); // `${posId}:${field}` -> draggable line
  const posRef = useRef<BtPos[]>(positions); posRef.current = positions;
  const drag = useRef<{ posId: string; field: "tp" | "sl"; price: number } | null>(null);

  // create / destroy chart (and indicator series) when simple toggles
  useEffect(() => {
    if (simple || !wrap.current) return;
    const c = createChart(wrap.current, {
      autoSize: true,
      layout: { background: { type: ColorType.Solid, color: "#ffffff" }, textColor: "#5D6175", fontSize: 10 },
      grid: { vertLines: { color: "#F1F2F8" }, horzLines: { color: "#F1F2F8" } },
      rightPriceScale: { borderColor: "#E9EAF3" }, timeScale: { borderColor: "#E9EAF3", timeVisible: true, secondsVisible: false },
      crosshair: { mode: CrosshairMode.Normal },
    });
    const cs = c.addCandlestickSeries({ upColor: "#12B981", downColor: "#E5484D", borderUpColor: "#12B981", borderDownColor: "#E5484D", wickUpColor: "#12B981", wickDownColor: "#E5484D" });
    const vs = c.addHistogramSeries({ priceFormat: { type: "volume" }, priceScaleId: "" });
    vs.priceScale().applyOptions({ scaleMargins: { top: 0.85, bottom: 0 } });
    const mk = (color: string, w: LineWidth) => c.addLineSeries({ color, lineWidth: w, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
    const e9 = mk("#6D5DE7", 1); const e21 = mk("#F5A524", 1); const vp = mk("#0EA5E9", 1);
    e9.applyOptions({ visible: false }); e21.applyOptions({ visible: false }); vp.applyOptions({ visible: false });
    chart.current = c; series.current = cs; vol.current = vs; ema9.current = e9; ema21.current = e21; vw.current = vp;
    priceLines.current = []; lineMap.current = new Map();
    return () => { c.remove(); chart.current = null; series.current = null; vol.current = null; ema9.current = null; ema21.current = null; vw.current = null; priceLines.current = []; lineMap.current = new Map(); };
  }, [simple]);

  // toggle indicator visibility without rebuilding
  useEffect(() => {
    ema9.current?.applyOptions({ visible: !!showEma });
    ema21.current?.applyOptions({ visible: !!showEma });
    vw.current?.applyOptions({ visible: !!showVwap });
  }, [showEma, showVwap, simple]);

  // data + price lines + markers
  useEffect(() => {
    if (simple || !series.current || !vol.current) return;
    series.current.setData(candles.map((x) => ({ time: x.time as UTCTimestamp, open: x.open, high: x.high, low: x.low, close: x.close })) as CandlestickData[]);
    vol.current.setData(candles.map((x) => ({ time: x.time as UTCTimestamp, value: x.volume, color: x.close >= x.open ? "rgba(18,185,129,.30)" : "rgba(229,72,77,.30)" })) as HistogramData[]);
    const closes = candles.map((c) => c.close);
    const e9 = ema(closes, 9), e21 = ema(closes, 21), vp = vwap(candles);
    const toLine = (arr: (number | null)[]): LineData[] => candles.map((c, i) => (arr[i] == null ? null : { time: c.time as UTCTimestamp, value: arr[i] as number })).filter(Boolean) as LineData[];
    ema9.current?.setData(toLine(e9)); ema21.current?.setData(toLine(e21)); vw.current?.setData(toLine(vp));

    const sm: SeriesMarker<UTCTimestamp>[] = realized.map((rt) => ({
      time: rt.exitTime as UTCTimestamp, position: rt.pnl >= 0 ? "belowBar" : "aboveBar",
      color: rt.pnl >= 0 ? "#12B981" : "#E5484D", shape: rt.pnl >= 0 ? "arrowUp" : "arrowDown",
      text: `${rt.reason === "stop_loss" ? "SL" : rt.reason === "take_profit" ? "TP" : "X"} ${rt.pnl >= 0 ? "+" : ""}${rt.pnl}`,
    }));
    series.current.setMarkers(sm);

    priceLines.current.forEach((l) => { try { series.current!.removePriceLine(l); } catch { /* series gone */ } });
    priceLines.current = []; lineMap.current = new Map();
    for (const p of positions) {
      const add = (price: number | null, color: string, title: string, style: LineStyle, key?: string) => {
        if (price == null) return;
        const line = series.current!.createPriceLine({ price, color, lineWidth: 1, lineStyle: style, axisLabelVisible: true, title });
        priceLines.current.push(line); if (key) lineMap.current.set(key, line);
      };
      add(p.entry, "#15162E", "ENTRY", LineStyle.Solid);
      add(p.sl, "#E5484D", "STOP", LineStyle.Dashed, `${p.id}:sl`);
      add(p.tp, "#12B981", "TARGET", LineStyle.Dashed, `${p.id}:tp`);
    }
    chart.current?.timeScale().fitContent();
  }, [candles, positions, realized, simple]);

  // DRAG: capture-phase pointerdown on the host (fires before LWC's inner pan handlers),
  // window move/up during drag. coordinateToPrice/priceToCoordinate are stable across versions.
  useEffect(() => {
    if (simple) return;
    const host = wrap.current; if (!host) return;
    const rectY = (e: PointerEvent) => e.clientY - host.getBoundingClientRect().top;
    const hitTest = (offY: number) => {
      const s = series.current; if (!s) return null;
      for (const p of posRef.current) for (const f of ["tp", "sl"] as const) {
        const price = p[f]; if (price == null) continue;
        const coord = s.priceToCoordinate(price); if (coord == null) continue;
        if (Math.abs(coord - offY) <= 8) return { posId: p.id, field: f, price };
      }
      return null;
    };
    const onDown = (e: PointerEvent) => {
      const hit = hitTest(rectY(e)); if (!hit || !series.current) return;
      e.preventDefault(); e.stopPropagation(); // stop LWC from starting a time-pan
      chart.current?.applyOptions({ handleScroll: false, handleScale: false });
      drag.current = { ...hit };
    };
    const onMove = (e: PointerEvent) => {
      const offY = rectY(e);
      if (drag.current && series.current) {
        const price = series.current.coordinateToPrice(offY);
        if (price != null && price > 0) {
          drag.current.price = price;
          lineMap.current.get(`${drag.current.posId}:${drag.current.field}`)?.applyOptions({ price });
        }
        return;
      }
      host.style.cursor = hitTest(offY) ? "ns-resize" : "default";
    };
    const onUp = () => {
      if (!drag.current) return;
      const { posId, field, price } = drag.current; drag.current = null;
      chart.current?.applyOptions({ handleScroll: true, handleScale: true });
      host.style.cursor = "default";
      onAdjust?.(posId, field, Math.round(price * 100) / 100);
    };
    host.addEventListener("pointerdown", onDown, true);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => { host.removeEventListener("pointerdown", onDown, true); window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); };
  }, [simple, onAdjust]);

  if (simple) {
    const data = candles.map((c) => ({ t: fmt(c.time), c: c.close }));
    const ys = [...candles.flatMap((c) => [c.low, c.high]), ...positions.flatMap((p) => [p.entry, p.tp, p.sl].filter((v): v is number => v != null))];
    const lo = ys.length ? Math.min(...ys) : 0, hi = ys.length ? Math.max(...ys) : 1, pad = (hi - lo) * 0.08 || 1;
    return (
      <div className="h-full w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 10, left: 6, bottom: 0 }}>
            <defs><linearGradient id="btFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#6D5DE7" stopOpacity={0.22} /><stop offset="100%" stopColor="#6D5DE7" stopOpacity={0.02} /></linearGradient></defs>
            <XAxis dataKey="t" tick={{ fontSize: 9, fill: "#9AA0B4" }} interval="preserveStartEnd" minTickGap={48} />
            <YAxis domain={[lo - pad, hi + pad]} tick={{ fontSize: 9, fill: "#9AA0B4" }} width={64} tickFormatter={(v) => `$${Number(v).toFixed(2)}`} />
            <Area type="monotone" dataKey="c" stroke="#5A49D6" strokeWidth={1.5} fill="url(#btFill)" dot={false} />
            {positions.map((p) => <ReferenceDot key={p.id} x={fmt(p.entryTime)} y={p.entry} r={4} fill="#12B981" stroke="#fff" />)}
            {realized.map((rt) => <ReferenceDot key={rt.id} x={fmt(rt.exitTime)} y={rt.exit} r={4} fill={rt.pnl >= 0 ? "#12B981" : "#E5484D"} stroke="#fff" />)}
          </AreaChart>
        </ResponsiveContainer>
        <p className="px-3 pb-2 text-center text-[9px] text-ink-mute">drag-to-adjust TP/SL is available in CANDLES mode · edit numerically in the Positions drawer</p>
      </div>
    );
  }
  return <div ref={wrap} className="h-full w-full" />;
}