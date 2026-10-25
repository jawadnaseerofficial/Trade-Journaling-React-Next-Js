"use client";
import { useEffect, useRef } from "react";
import {
  createChart, ColorType, CrosshairMode,
  type IChartApi, type ISeriesApi, type UTCTimestamp, type CandlestickData, type HistogramData, type SeriesMarker,
} from "lightweight-charts";
import { Area, AreaChart, ReferenceDot, ResponsiveContainer, XAxis, YAxis } from "recharts";
import type { Candle, Marker } from "@/types";

const fmtTime = (t: number) => new Date(t * 1000).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });

export function CandleChart({ candles, markers, simple }: { candles: Candle[]; markers: Marker[]; simple: boolean }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volRef = useRef<ISeriesApi<"Histogram"> | null>(null);

  useEffect(() => {
    if (simple || !wrapRef.current) return;
    const chart = createChart(wrapRef.current, {
      height: 360, layout: { background: { type: ColorType.Solid, color: "#ffffff" }, textColor: "#5D6175", fontSize: 10 },
      grid: { vertLines: { color: "#F1F2F8" }, horzLines: { color: "#F1F2F8" } },
      rightPriceScale: { borderColor: "#E9EAF3" }, timeScale: { borderColor: "#E9EAF3", timeVisible: true, secondsVisible: false },
      crosshair: { mode: CrosshairMode.Normal },
    });
    const cs = chart.addCandlestickSeries({ upColor: "#12B981", downColor: "#E5484D", borderUpColor: "#12B981", borderDownColor: "#E5484D", wickUpColor: "#12B981", wickDownColor: "#E5484D" });
    const vs = chart.addHistogramSeries({ priceFormat: { type: "volume" }, priceScaleId: "" });
    vs.priceScale().applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
    chartRef.current = chart; candleRef.current = cs; volRef.current = vs;
    const ro = new ResizeObserver(() => chart.applyOptions({ width: wrapRef.current!.clientWidth }));
    ro.observe(wrapRef.current);
    return () => { ro.disconnect(); chart.remove(); chartRef.current = null; };
  }, [simple]);

  useEffect(() => {
    if (simple || !candleRef.current || !volRef.current) return;
    candleRef.current.setData(candles.map((c) => ({ time: c.time as UTCTimestamp, open: c.open, high: c.high, low: c.low, close: c.close })) as CandlestickData[]);
    volRef.current.setData(candles.map((c) => ({ time: c.time as UTCTimestamp, value: c.volume, color: c.close >= c.open ? "rgba(18,185,129,.35)" : "rgba(229,72,77,.35)" })) as HistogramData[]);
    const sm: SeriesMarker<UTCTimestamp>[] = markers.map((m) => ({
      time: m.time as UTCTimestamp,
      position: m.side === "buy" ? "belowBar" : "aboveBar",
      color: m.side === "buy" ? "#12B981" : "#E5484D",
      shape: m.side === "buy" ? "arrowUp" : "arrowDown",
      text: m.label,
    }));
    candleRef.current.setMarkers(sm);
    chartRef.current?.timeScale().fitContent();
  }, [candles, markers, simple]);

  if (simple) {
    const data = candles.map((c) => ({ t: fmtTime(c.time), c: c.close }));
    const dots = markers.map((m) => ({ x: fmtTime(m.time), y: m.price, buy: m.side === "buy" }));
    const ys = [...candles.flatMap((c) => [c.low, c.high]), ...markers.map((m) => m.price)];
    const yMin = ys.length ? Math.min(...ys) : 0;
    const yMax = ys.length ? Math.max(...ys) : 1;
    const pad = (yMax - yMin) * 0.08 || 1;
    return (
      <div className="h-[360px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 10, left: 6, bottom: 0 }}>
            <defs><linearGradient id="simpleFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#6D5DE7" stopOpacity={0.25} /><stop offset="100%" stopColor="#6D5DE7" stopOpacity={0.02} /></linearGradient></defs>
            <XAxis dataKey="t" tick={{ fontSize: 9, fill: "#9AA0B4" }} interval="preserveStartEnd" minTickGap={40} />
            <YAxis domain={[yMin - pad, yMax + pad]} tick={{ fontSize: 9, fill: "#9AA0B4" }} width={62} tickFormatter={(v) => `$${Number(v).toFixed(2)}`} />
            <Area type="monotone" dataKey="c" stroke="#5A49D6" strokeWidth={1.6} fill="url(#simpleFill)" dot={false} />
            {dots.map((d, i) => <ReferenceDot key={i} x={d.x} y={d.y} r={4.5} fill={d.buy ? "#12B981" : "#E5484D"} stroke="#fff" strokeWidth={1.5} />)}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    );
  }
  return <div ref={wrapRef} className="h-[360px] w-full" />;
}