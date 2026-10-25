"use client";
import { cn, money, pct } from "@/lib/utils";
import { MiniCandles } from "./mini-candles";
import type { TradePreview } from "@/types";

const STATUS: Record<string, string> = { win: "border-success text-success", loss: "border-danger text-danger", break_even: "border-ink-mute text-ink-soft", open: "border-warn text-warn" };

function Line({ label, value, tone }: { label: string; value: string; tone?: "pos" | "neg" }) {
  return <div className="flex items-center justify-between gap-6 py-0.5"><span className="text-[10px] text-ink-mute">{label}</span><span className={cn("text-[11px] font-bold tabular-nums", tone === "pos" ? "text-success" : tone === "neg" ? "text-danger" : "text-ink")}>{value}</span></div>;
}

export function HoverCard({ data, x, y }: { data: TradePreview | null; x: number; y: number }) {
  if (!data) return null;
  const W = 300, H = 320;
  const left = Math.min(x + 16, window.innerWidth - W - 12);
  const top = Math.min(y + 16, window.innerHeight - H - 12);
  return (
    <div className="pointer-events-none fixed z-50 w-[300px] rounded-card border border-line bg-surface p-3 shadow-card" style={{ left, top }}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-black">{data.symbol}</p>
          <p className="text-[10px] text-ink-mute">{data.dayLabel}</p>
        </div>
        <span className={cn("rounded border px-1.5 py-0.5 text-[9px] font-extrabold uppercase", STATUS[data.status] ?? STATUS.break_even)}>{data.status === "break_even" ? "BE" : data.status}</span>
      </div>
      <div className="mt-2">
        {data.candles.length ? <MiniCandles candles={data.candles} entry={data.entryPrice} exit={data.exitPrice} />
          : <div className="grid h-24 place-items-center rounded bg-canvas text-[10px] text-ink-mute">no market data (rate‑limit / closed)</div>}
      </div>
      <div className="mt-2 border-t border-line pt-1.5">
        <Line label="Net P&L" value={money(data.netPnl, { sign: true })} tone={data.netPnl >= 0 ? "pos" : "neg"} />
        <Line label="Net ROI" value={data.netRoi == null ? "--" : pct(data.netRoi)} tone={data.netRoi == null ? undefined : data.netRoi >= 0 ? "pos" : "neg"} />
        <Line label="Entry → Exit" value={`${data.entryPrice == null ? "--" : money(data.entryPrice)} → ${data.exitPrice == null ? "--" : money(data.exitPrice)}`} />
        <Line label="Realized R" value={data.realizedR == null ? "--" : `${data.realizedR.toFixed(2)}R`} />
        <Line label="MAE / MFE" value={`${data.mae == null ? "--" : money(data.mae)} / ${data.mfe == null ? "--" : money(data.mfe)}`} />
        <Line label="Best Exit" value={data.bestExitPct == null ? "--" : `${data.bestExitPct.toFixed(2)}%`} tone="pos" />
        {data.setups && <p className="mt-1 truncate text-[10px] font-semibold text-primary-600">{data.setups}</p>}
        {data.accountName && <p className="text-[9px] text-ink-mute">{data.accountName}</p>}
      </div>
    </div>
  );
}