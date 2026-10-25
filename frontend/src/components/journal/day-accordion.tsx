"use client";
import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, PenLine } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, YAxis } from "recharts";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn, compactMoney, money, pct } from "@/lib/utils";
import type { DaySummary } from "@/types";

function Stat({ label, value, tone }: { label: string; value: string; tone?: "pos" | "neg" }) {
  return (
    <div className="flex items-center justify-between border-b border-line/60 py-1.5 last:border-0">
      <span className="text-[10px] text-ink-mute">{label}</span>
      <span className={cn("text-[11px] font-bold tabular-nums", tone === "pos" ? "text-success" : tone === "neg" ? "text-danger" : "text-ink")}>{value}</span>
    </div>
  );
}

export function DayAccordion({ day, expanded, onToggle, onNote }:
  { day: DaySummary; expanded: boolean; onToggle: () => void; onNote: (d: DaySummary) => void }) {
  // synthetic intraday curve from the day's trades (cumulative netPnl in open order)
  const spark = (() => {
    let run = 0;
    return day.trades.map((t, i) => { run += t.netPnl; return { i, v: run }; });
  })();
  const pos = day.netPnl >= 0;
  return (
    <Card className="overflow-hidden">
      <button onClick={onToggle} className="flex w-full items-center gap-2 px-4 py-3 text-left hover:bg-canvas/50">
        {expanded ? <ChevronDown size={15} className="text-ink-mute" /> : <ChevronRight size={15} className="text-ink-mute" />}
        <span className="text-xs font-bold">{day.label}</span>
        <span className="text-[11px] text-ink-mute">·</span>
        <span className={cn("text-[11px] font-bold", pos ? "text-success" : "text-danger")}>Net P&L {money(day.netPnl, { sign: true })}</span>
        {day.hasNote && <Badge tone="primary" className="ml-1">note</Badge>}
      </button>

      {expanded && (
        <div className="border-t border-line px-4 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-1 items-start gap-4">
              <div className="h-16 w-40 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={spark} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id={`spk-${day.date}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={pos ? "#34D399" : "#F87171"} stopOpacity={0.5} />
                        <stop offset="100%" stopColor={pos ? "#34D399" : "#F87171"} stopOpacity={0.04} />
                      </linearGradient>
                    </defs>
                    <YAxis hide domain={["dataMin", "dataMax"]} />
                    <Area type="monotone" dataKey="v" stroke={pos ? "#12B981" : "#E5484D"} strokeWidth={1.4} fill={`url(#spk-${day.date})`} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="grid flex-1 grid-cols-2 gap-x-6 gap-y-0 md:grid-cols-4">
                <Stat label="Total Traders" value={String(day.totalTrades)} />
                <Stat label="Winners" value={String(day.winners)} tone="pos" />
                <Stat label="Gross P&L" value={money(day.grossPnl)} />
                <Stat label="Commissions" value={money(day.commissions)} />
                <Stat label="Winrate" value={pct(day.winrate)} />
                <Stat label="Losers" value={String(day.losers)} tone="neg" />
                <Stat label="Volume" value={String(day.volume)} />
                <Stat label="Profit Factor" value={day.profitFactor.toFixed(2)} />
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => onNote(day)}><PenLine size={12} /> Add Note</Button>
          </div>

          <div className="mt-4 overflow-x-auto rounded-card border border-line">
            <table className="w-full text-left text-[11px]">
              <thead><tr className="bg-primary-50/60 text-[10px] font-bold text-ink-soft">
                <th className="px-3 py-2">Open Time</th><th className="px-3 py-2">Ticker</th><th className="px-3 py-2">Side</th>
                <th className="px-3 py-2">Instrument</th><th className="px-3 py-2 text-right">Net P&L</th>
                <th className="px-3 py-2 text-right">Net ROI</th><th className="px-3 py-2 text-right">Realized R-Multiple</th>
                <th className="px-3 py-2">Playbook</th><th className="px-3 py-2">Tags</th>
              </tr></thead>
              <tbody>
                {day.trades.map((t) => (
                  <tr key={t.id} className="border-t border-line hover:bg-canvas/60">
                    <td className="px-3 py-2.5 text-ink-soft">{t.openTime}</td>
                    <td className="px-3 py-2.5 font-bold">{t.ticker}</td>
                    <td className="px-3 py-2.5 text-ink-soft">{t.side}</td>
                    <td className="px-3 py-2.5 text-ink-soft">{t.instrument}</td>
                    <td className={cn("px-3 py-2.5 text-right font-bold tabular-nums", t.netPnl > 0 ? "text-success" : t.netPnl < 0 ? "text-danger" : "text-ink-mute")}>{money(t.netPnl)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-ink-soft">{t.netRoi == null ? "--" : `${t.netRoi.toFixed(2)}%`}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-ink-soft">{t.realizedR == null ? "--" : t.realizedR.toFixed(2)}</td>
                    <td className="px-3 py-2.5 text-ink-soft">{t.playbook ?? "--"}</td>
                    <td className="px-3 py-2.5">
                    <Link href={`/replay?trade=${t.id}`} className="grid h-5 w-5 place-items-center rounded-full border border-line text-primary-500 hover:bg-primary-50" aria-label="Open in replay">+</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Card>
  );
}