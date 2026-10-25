"use client";
import { useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, money, pct } from "@/lib/utils";
import type { BtRealized, BtState } from "@/types";

const etDay = (t: number) => new Date(t * 1000).toLocaleDateString("en-CA", { timeZone: "America/New_York" });
const etLabel = (t: number) => new Date(t * 1000).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "2-digit", timeZone: "America/New_York" });

export function SessionAnalytics({ state, session, completion, notes, onAddNote, onJump, onClose }:
  { state: BtState; session: { name: string; symbol: string; startBalance: number };
    completion: number; notes: Record<string, string>;
    onAddNote: (day: string, text: string) => void; onJump: (t: number) => void; onClose: () => void }) {
  const [open, setOpen] = useState<string | null>(null);

  const eq = useMemo(() => {
    let peak = -Infinity;
    return state.equity.map((e) => { peak = Math.max(peak, e.value); return { t: e.time, value: e.value, dd: Math.round((e.value - peak) * 100) / 100 }; });
  }, [state.equity]);
  const maxDD = useMemo(() => Math.min(0, ...eq.map((e) => e.dd)), [eq]);
  const realizedTotal = useMemo(() => Math.round(state.realized.reduce((s, r) => s + r.pnl, 0) * 100) / 100, [state.realized]);
  const wins = state.realized.filter((r) => r.pnl > 0).length;
  const winRate = state.realized.length ? (wins / state.realized.length) * 100 : 0;

  const days = useMemo(() => {
    const m = new Map<string, BtRealized[]>();
    for (const r of state.realized) { const k = etDay(r.exitTime); (m.get(k) ?? m.set(k, []).get(k)!).push(r); }
    return [...m.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [state.realized]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-card border border-line bg-surface shadow-card">
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          <div><p className="text-sm font-black">{session.name} · session dashboard</p><p className="text-[10px] text-ink-mute">{session.symbol} · {state.realized.length} trades · {completion.toFixed(0)}% completed</p></div>
          <button onClick={onClose} className="text-ink-mute hover:text-ink"><X size={18} /></button>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-y-auto p-5 lg:grid-cols-[1fr_360px]">
          {/* left: curves + tiles */}
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Tile label="Realised P&L" value={money(realizedTotal, { sign: true })} tone={realizedTotal >= 0 ? "pos" : "neg"} />
              <Tile label="Current equity" value={money(state.balance)} />
              <Tile label="Win rate" value={pct(winRate)} />
              <Tile label="Max drawdown" value={money(maxDD)} tone="neg" />
            </div>
            <div className="rounded-card border border-line p-3">
              <p className="mb-1 text-[11px] font-bold">Equity curve</p>
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={eq} margin={{ top: 6, right: 6, left: -10, bottom: 0 }}>
                    <defs><linearGradient id="eqFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#12B981" stopOpacity={0.4} /><stop offset="100%" stopColor="#12B981" stopOpacity={0.02} /></linearGradient></defs>
                    <CartesianGrid vertical={false} stroke="#F1F2F8" />
                    <XAxis dataKey="t" hide /><YAxis tick={{ fontSize: 9, fill: "#9AA0B4" }} width={62} tickFormatter={(v) => money(Number(v))} />
                    <Tooltip labelFormatter={(v) => etLabel(Number(v))} formatter={(v) => [money(Number(v)), "Equity"]} contentStyle={{ borderRadius: 8, border: "1px solid #E9EAF3", fontSize: 11 }} />
                    <Area type="monotone" dataKey="value" stroke="#0E9F6E" strokeWidth={1.6} fill="url(#eqFill)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="rounded-card border border-line p-3">
              <p className="mb-1 text-[11px] font-bold">Drawdown</p>
              <div className="h-28">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={eq} margin={{ top: 6, right: 6, left: -10, bottom: 0 }}>
                    <defs><linearGradient id="ddFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#E5484D" stopOpacity={0.05} /><stop offset="100%" stopColor="#E5484D" stopOpacity={0.4} /></linearGradient></defs>
                    <CartesianGrid vertical={false} stroke="#F1F2F8" />
                    <XAxis dataKey="t" hide /><YAxis tick={{ fontSize: 9, fill: "#9AA0B4" }} width={62} tickFormatter={(v) => money(Number(v))} />
                    <Tooltip labelFormatter={(v) => etLabel(Number(v))} formatter={(v) => [money(Number(v)), "Drawdown"]} contentStyle={{ borderRadius: 8, border: "1px solid #E9EAF3", fontSize: 11 }} />
                    <ReferenceLine y={0} stroke="#E9EAF3" />
                    <Area type="monotone" dataKey="dd" stroke="#C93A3F" strokeWidth={1.4} fill="url(#ddFill)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* right: per-day accordion + notes */}
          <div className="flex flex-col gap-2">
            <p className="text-[11px] font-bold">By day</p>
            {days.length === 0 && <p className="rounded-card border border-line p-6 text-center text-[10px] text-ink-mute">No closed trades yet in this session.</p>}
            {days.map(([day, rs]) => {
              const dayPnl = Math.round(rs.reduce((s, r) => s + r.pnl, 0) * 100) / 100;
              const isOpen = open === day;
              return (
                <div key={day} className="rounded-card border border-line">
                  <button onClick={() => setOpen(isOpen ? null : day)} className="flex w-full items-center justify-between px-3 py-2 text-left">
                    <span className="text-[11px] font-bold">{etLabel(rs[0].exitTime)}</span>
                    <span className="flex items-center gap-2">
                      <span className="flex gap-0.5">{rs.map((r, i) => <span key={i} className={cn("h-1.5 w-1.5 rounded-full", r.pnl > 0 ? "bg-success" : r.pnl < 0 ? "bg-danger" : "bg-ink-mute")} />)}</span>
                      <span className={cn("text-[11px] font-extrabold tabular-nums", dayPnl >= 0 ? "text-success" : "text-danger")}>{money(dayPnl, { sign: true })}</span>
                    </span>
                  </button>
                  {isOpen && (
                    <div className="border-t border-line px-3 py-2">
                      {rs.map((r) => (
                        <div key={r.id} className="flex items-center justify-between border-b border-line/50 py-1 text-[10px] last:border-0">
                          <span className="font-bold uppercase text-ink-soft">{r.side}</span>
                          <span className="flex-1 px-2 text-ink-mute">{r.qty} @ {money(r.entry)} → {money(r.exit)}</span>
                          <span className={cn("rounded px-1 text-[8px] font-bold uppercase", r.reason === "take_profit" ? "bg-success-soft text-success-deep" : r.reason === "stop_loss" ? "bg-danger-soft text-danger-deep" : "bg-canvas text-ink-soft")}>{r.reason.replace("_", " ")}</span>
                          <span className={cn("ml-2 w-16 text-right font-bold tabular-nums", r.pnl >= 0 ? "text-success" : "text-danger")}>{money(r.pnl, { sign: true })}</span>
                          <button onClick={() => { onJump(r.entryTime); onClose(); }} className="ml-2 rounded px-1.5 py-0.5 text-[9px] font-bold text-primary-600 hover:bg-primary-50">Replay</button>
                        </div>
                      ))}
                      <NoteBox day={day} initial={notes[day] ?? ""} onSave={onAddNote} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function Tile({ label, value, tone }: { label: string; value: string; tone?: "pos" | "neg" }) {
  return <div className="rounded-card border border-line p-3"><p className="text-[9px] font-semibold uppercase text-ink-mute">{label}</p><p className={cn("mt-1 text-sm font-black tabular-nums", tone === "pos" ? "text-success" : tone === "neg" ? "text-danger" : "")}>{value}</p></div>;
}
function NoteBox({ day, initial, onSave }: { day: string; initial: string; onSave: (day: string, text: string) => void }) {
  const [v, setV] = useState(initial);
  return (
    <div className="mt-2">
      <p className="mb-1 text-[9px] font-bold uppercase text-ink-mute">Note for this day</p>
      <textarea value={v} onChange={(e) => setV(e.target.value)} onBlur={() => v !== initial && onSave(day, v)}
        placeholder="What did you learn today? (saved to the session log)"
        className="h-16 w-full resize-none rounded-lg border border-line bg-surface p-2 text-[10px] outline-none focus:border-primary-500" />
    </div>
  );
}