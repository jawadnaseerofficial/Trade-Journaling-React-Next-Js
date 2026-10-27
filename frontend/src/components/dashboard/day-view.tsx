"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, CalendarDays, FileText, Inbox, Loader2, PlayCircle, RefreshCw, AlertTriangle,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn, money, pct } from "@/lib/utils";
import { api } from "@/lib/api";
import { clientGetToken } from "@/lib/auth";
import type { DaySummary, MonthJournal, TradeLogRow, TradeSummary } from "@/types";

type Row = {
  id: string; when: string; symbol: string; side: string;
  status: string; net: number; r: number | null; playbook: string | null; tags: string | null;
};

function normJournal(t: TradeLogRow): Row {
  const net = Number(t.netPnl ?? 0);
  return {
    id: t.id, when: t.openTime ?? "", symbol: t.ticker ?? "—", side: t.side ?? "",
    status: net > 0 ? "win" : net < 0 ? "loss" : "break_even",
    net, r: t.realizedR ?? null, playbook: t.playbook ?? null, tags: t.tags ?? null,
  };
}
function normSummary(t: TradeSummary): Row {
  const net = Number(t.netPnl ?? 0);
  return {
    id: t.id, when: t.openDate ?? "", symbol: t.symbol ?? "—", side: "",
    status: t.status ?? (net > 0 ? "win" : net < 0 ? "loss" : "break_even"),
    net, r: null, playbook: null, tags: null,
  };
}

function StatusBadge({ s }: { s: string }) {
  const map: Record<string, string> = {
    win: "border-success text-success", loss: "border-danger text-danger",
    break_even: "border-ink-mute text-ink-soft", open: "border-warn text-warn",
  };
  return (
    <span className={cn("rounded border px-1.5 py-0.5 text-[9px] font-extrabold uppercase", map[s] ?? map.break_even)}>
      {s === "break_even" ? "BE" : s}
    </span>
  );
}

function Tile({ label, value, tone }: { label: string; value: string; tone?: "pos" | "neg" | null }) {
  return (
    <div className="rounded-card border border-line bg-surface p-3">
      <p className="text-[9px] font-bold uppercase text-ink-mute">{label}</p>
      <p className={cn("mt-0.5 text-base font-black tabular-nums", tone === "pos" ? "text-success" : tone === "neg" ? "text-danger" : "text-ink")}>{value}</p>
    </div>
  );
}

export function DayView({ date }: { date: string }) {
  const tok = () => clientGetToken() ?? undefined;
  const [rows, setRows] = useState<TradeSummary[]>([]);
  const [day, setDay] = useState<DaySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(date);

  useEffect(() => {
    if (!validDate) { setLoading(false); setError("Invalid date."); return; }
    let alive = true;
    setLoading(true); setError(null);
    Promise.all([
      api.trades.byDay(date, tok()).catch(() => [] as TradeSummary[]),
      api.journal.month(date.slice(0, 7), tok()).catch(() => null as MonthJournal | null),
    ])
      .then(([r, mj]) => {
        if (!alive) return;
        setRows(Array.isArray(r) ? r : []);
        setDay(mj?.days?.find((d) => d.date === date) ?? null);
      })
      .catch((e: any) => { if (alive) setError(e?.message || "Could not load this day."); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, tick, validDate]);

  const normRows = useMemo<Row[]>(
    () => (day?.trades?.length ? day.trades.map(normJournal) : rows.map(normSummary)),
    [day, rows]
  );

  const agg = useMemo(() => {
    if (day) {
      return {
        net: day.netPnl, trades: day.totalTrades, wins: day.winners, losses: day.losers,
        winRate: day.winrate, gross: day.grossPnl, comm: day.commissions, vol: day.volume, pf: day.profitFactor,
      };
    }
    const ns = normRows.map((r) => r.net);
    const trades = ns.length;
    const wins = ns.filter((n) => n > 0).length;
    const losses = ns.filter((n) => n < 0).length;
    const net = ns.reduce((a, b) => a + b, 0);
    return {
      net, trades, wins, losses,
      winRate: trades ? +((wins / trades) * 100).toFixed(2) : null,
      gross: null as number | null, comm: null as number | null, vol: null as number | null, pf: null as number | null,
    };
  }, [day, normRows]);

  const avg = agg.trades ? agg.net / agg.trades : null;

  const pretty = useMemo(() => {
    if (!validDate) return date;
    try {
      return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", {
        weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "UTC",
      });
    } catch { return date; }
  }, [date, validDate]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/" className="grid h-8 w-8 place-items-center rounded-lg border border-line bg-surface text-ink-soft transition-colors hover:border-primary-300 hover:text-primary-600" aria-label="Back to dashboard">
            <ArrowLeft size={15} />
          </Link>
          <div>
            <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-ink-mute"><CalendarDays size={12} /> Trading day</p>
            <h2 className="text-lg font-black leading-tight text-ink">{pretty}</h2>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setTick((t) => t + 1)}><RefreshCw size={12} /> Reload</Button>
          <Link href="/trades"><Button size="sm">Open trade log</Button></Link>
        </div>
      </div>

      {loading && (
        <Card className="grid place-items-center gap-2 p-10 text-[12px] text-ink-mute">
          <Loader2 size={18} className="animate-spin text-primary-500" /> Loading this day…
        </Card>
      )}

      {!loading && error && (
        <Card className="flex flex-col items-center gap-2 p-8 text-center">
          <AlertTriangle size={18} className="text-danger" />
          <p className="text-[12px] font-bold text-ink">{error}</p>
          <Button variant="outline" size="sm" onClick={() => setTick((t) => t + 1)}><RefreshCw size={12} /> Try again</Button>
        </Card>
      )}

      {!loading && !error && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <Tile label="Net P&L" value={money(agg.net, { sign: true })} tone={agg.net >= 0 ? "pos" : "neg"} />
            <Tile label="Trades" value={String(agg.trades)} />
            <Tile label="Wins" value={String(agg.wins)} tone="pos" />
            <Tile label="Losses" value={String(agg.losses)} tone="neg" />
            <Tile label="Win rate" value={agg.winRate != null ? pct(agg.winRate) : "--"} />
            <Tile label="Avg / trade" value={avg != null ? money(avg, { sign: true }) : "--"} tone={avg != null && avg >= 0 ? "pos" : avg != null ? "neg" : null} />
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Tile label="Gross P&L" value={agg.gross != null ? money(agg.gross, { sign: true }) : "--"} />
            <Tile label="Commissions" value={agg.comm != null ? money(agg.comm) : "--"} />
            <Tile label="Volume" value={agg.vol != null ? String(agg.vol) : "--"} />
            <Tile label="Profit factor" value={agg.pf != null ? String(agg.pf) : "--"} />
          </div>

          {day?.note ? (
            <Card className="p-4">
              <p className="mb-1 flex items-center gap-1.5 text-[11px] font-black uppercase text-ink-soft"><FileText size={13} className="text-primary-600" /> Day note</p>
              <p className="whitespace-pre-wrap text-[12px] leading-relaxed text-ink-soft">{day.note}</p>
            </Card>
          ) : null}

          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
              <p className="text-[11px] font-black uppercase text-ink-soft">Trades · {normRows.length}</p>
              <span className="text-[10px] text-ink-mute">click a row to replay</span>
            </div>
            {normRows.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[11px]">
                  <thead>
                    <tr className="bg-canvas/60 text-[10px] font-bold uppercase text-ink-mute">
                      <th className="px-3 py-2">Time</th>
                      <th className="px-3 py-2">Symbol</th>
                      <th className="px-3 py-2">Side</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2 text-right">Net P&L</th>
                      <th className="px-3 py-2 text-right">R</th>
                      <th className="px-3 py-2">Playbook</th>
                      <th className="px-3 py-2">Tags</th>
                      <th className="px-3 py-2 text-right">Replay</th>
                    </tr>
                  </thead>
                  <tbody>
                    {normRows.map((r) => (
                      <tr key={r.id} className="border-t border-line/60">
                        <td className="px-3 py-2 text-ink-soft">{r.when || "--"}</td>
                        <td className="px-3 py-2 font-bold">{r.symbol}</td>
                        <td className="px-3 py-2 uppercase text-ink-soft">{r.side || "--"}</td>
                        <td className="px-3 py-2"><StatusBadge s={r.status} /></td>
                        <td className={cn("px-3 py-2 text-right font-bold tabular-nums", r.net >= 0 ? "text-success" : "text-danger")}>{money(r.net, { sign: true })}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-ink-soft">{r.r != null ? r.r.toFixed(2) : "--"}</td>
                        <td className="px-3 py-2 text-ink-soft">{r.playbook || "--"}</td>
                        <td className="px-3 py-2 text-ink-soft">{r.tags || "--"}</td>
                        <td className="px-3 py-2 text-right">
                          <Link href={`/replay?trade=${r.id}`} className="inline-flex items-center gap-1 rounded-md border border-line px-1.5 py-0.5 text-[10px] font-bold text-ink-soft transition-colors hover:border-primary-300 hover:text-primary-600">
                            <PlayCircle size={11} /> Replay
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="grid place-items-center gap-1.5 p-10 text-center">
                <Inbox size={20} className="text-ink-mute" />
                <p className="text-[12px] font-bold text-ink-soft">No trades recorded for this day.</p>
                <p className="text-[10px] text-ink-mute">Import a CSV or log a trade, then reload.</p>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}