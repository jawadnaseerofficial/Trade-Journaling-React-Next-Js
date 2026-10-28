"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, BarChart3, CalendarDays, ChevronDown, Clock, Crosshair, Eraser, FileText, Lock, Maximize2, Minimize2,
  Pause, Play, Ruler, SkipBack, SkipForward, Trash2, TrendingUp, Type, X,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { cn, money } from "@/lib/utils";
import { api } from "@/lib/api";
import { clientGetToken } from "@/lib/auth";
import { FACTOR, aggregate, simulate } from "@/lib/backtest-engine";
import { BacktestChart } from "./backtest-chart";
import { OrderPanel } from "./order-panel";
import { SessionAnalytics } from "./session-analytics";
import type { BtAction, BtOrderPayload, BtRun, Candle } from "@/types";

const INTERVALS = ["1m", "5m", "15m", "1h", "1d"];
const SPEEDS = [0.5, 1, 2, 5, 10];
const BASE_MS = 320;
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2));
const fmtClock = (t: number) => new Date(t * 1000).toLocaleString("en-US", { weekday: "short", month: "short", day: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, timeZone: "America/New_York" });
const fmtHM = (t: number) => new Date(t * 1000).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, timeZone: "America/New_York" });

export function RunnerView({ initial }: { initial: BtRun }) {
  const router = useRouter();
  const tok = () => clientGetToken() ?? undefined;
  const [run, setRun] = useState(initial);
  const [idx, setIdx] = useState(() => {
    if (!initial.session.lastTime) return 1;
    const i = initial.candles.findIndex((c) => c.time > (initial.session.lastTime as number));
    return i === -1 ? initial.candles.length : i;
  });
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [displayIv, setDisplayIv] = useState(initial.baseInterval);
  const [sync, setSync] = useState(true);
  const [scale, setScale] = useState<"normal" | "log">("normal");
  const [simple, setSimple] = useState(false);
  const [full, setFull] = useState(false);
  const [rail, setRail] = useState<"order" | "details" | "calendar" | "orders">("order");
  const [showPanel, setShowPanel] = useState(true);
  const [drawer, setDrawer] = useState(true);
  const [showEma, setShowEma] = useState(false);
  const [showVwap, setShowVwap] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [actions, setActions] = useState<BtAction[]>(initial.actions);
  const shell = useRef<HTMLDivElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const base = run.candles;
  const factor = FACTOR[displayIv] ?? 1;
  const dispCandles = useMemo(() => aggregate(base, factor), [base, factor]);
  const uptoTime = base[Math.min(idx, base.length) - 1]?.time ?? 0;
  const revealedBase = useMemo(() => base.slice(0, idx), [base, idx]);
  const revealedDisp = useMemo(() => aggregate(revealedBase, factor), [revealedBase, factor]);
  const state = useMemo(() => simulate(base, actions, uptoTime, run.session.startBalance), [base, actions, uptoTime, run.session.startBalance]);
  const curPrice = revealedBase.at(-1)?.close ?? 0;
  const notes = useMemo(() => { const m: Record<string, string> = {}; for (const a of actions) if (a.kind === "note") m[String((a.payload as { day?: string }).day ?? "")] = String((a.payload as { text?: string }).text ?? ""); return m; }, [actions]);

  useEffect(() => {
    if (!playing || base.length === 0) return;
    if (idx >= base.length) { setPlaying(false); return; }
    const step = () => {
      setIdx((i) => {
        if (!sync) return Math.min(base.length, i + 1);
        const curT = base[i - 1]?.time ?? 0;
        const stepSec = factor * 60;
        let j = i; while (j < base.length && base[j].time < curT + stepSec) j++;
        return Math.min(base.length, j === i ? i + 1 : j);
      });
    };
    const t = setTimeout(step, BASE_MS / speed);
    return () => clearTimeout(t);
  }, [playing, idx, speed, sync, factor, base.length]);

  useEffect(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => { api.backtests.progress(run.session.id, uptoTime || null, tok()).catch(() => {}); }, 600);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [uptoTime, run.session.id]);

  useEffect(() => { const on = () => setFull(Boolean(document.fullscreenElement)); document.addEventListener("fullscreenchange", on); return () => document.removeEventListener("fullscreenchange", on); }, []);
  const toggleFull = () => { if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); else shell.current?.requestFullscreen().catch(() => {}); };

  const pushAction = useCallback(async (a: BtAction) => {
    setActions((prev) => [...prev, a]);
    await api.backtests.addAction(run.session.id, { id: a.id, at_time: a.atTime, kind: a.kind, payload: a.payload }, tok()).catch(() => {});
  }, [run.session.id]);

  function placeOrder(p: BtOrderPayload) { pushAction({ id: uid(), atTime: uptoTime, kind: "order", payload: p as unknown as Record<string, unknown> }); }
  function closePos(id: string) { pushAction({ id: uid(), atTime: uptoTime, kind: "close", payload: { targetId: id } }); }
  function cancelPend(id: string) { pushAction({ id: uid(), atTime: uptoTime, kind: "cancel", payload: { targetId: id } }); }
  function closeAll() { state.open.forEach((p) => closePos(p.id)); }
  const onAdjust = useCallback((posId: string, field: "tp" | "sl", price: number) => { pushAction({ id: uid(), atTime: uptoTime, kind: "modify", payload: { targetId: posId, [field]: price } }); }, [uptoTime, pushAction]);
  const addNote = useCallback((day: string, text: string) => { pushAction({ id: uid(), atTime: uptoTime, kind: "note", payload: { day, text } }); }, [uptoTime, pushAction]);

  function jumpToTime(target: number) { const i = base.findIndex((c) => c.time >= target); if (i >= 0) { setPlaying(false); setIdx(i + 1); } }
  function nextDayOpen() { if (!uptoTime) return; const d = new Date(uptoTime * 1000); d.setUTCDate(d.getUTCDate() + 1); d.setUTCHours(14, 30, 0, 0); jumpToTime(d.getTime() / 1000); }
  function onGoTo(e: React.ChangeEvent<HTMLInputElement>) { const [ds, tm] = e.target.value.split("T"); if (!ds) return; const [h, m] = (tm || "00:00").split(":"); const dt = new Date(`${ds}T${h.padStart(2, "0")}:${m.padStart(2, "0")}:00Z`); jumpToTime(dt.getTime() / 1000); }

  const dd = useMemo(() => { let peak = -Infinity, d = 0; for (const e of state.equity) { peak = Math.max(peak, e.value); d = Math.max(d, peak - e.value); } return d; }, [state.equity]);
  const completion = base.length ? (idx / base.length) * 100 : 0;
  const wins = state.realized.filter((r) => r.pnl > 0).length;
  const winRate = state.realized.length ? (wins / state.realized.length) * 100 : 0;

  if (base.length === 0) {
    return (
      <Card className="mx-auto max-w-md p-10 text-center">
        <p className="text-sm font-bold">No market data for this range</p>
        <p className="mt-1 text-[11px] text-ink-soft">The free feed (Yahoo) has no candles for <b>{run.session.symbol}</b> between {run.session.startDate} and {run.session.endDate}. Pick a recent range, a major symbol (AAPL, SPY, QQQ, BTC‑USD, ^GSPC), or connect a premium feed (Polygon/Databento) for full history.</p>
        <Button className="mt-4" size="sm" onClick={() => router.push("/backtesting")}><ArrowLeft size={13} /> Back to sessions</Button>
      </Card>
    );
  }

  return (
    <div ref={shell} className="flex h-[calc(100vh-3.5rem)] flex-col overflow-hidden bg-canvas">
      <div className="flex items-center gap-3 border-b border-line bg-surface px-4 py-2">
        <Button variant="outline" size="sm" onClick={() => router.push("/backtesting")}><ArrowLeft size={13} /> Sessions</Button>
        <div className="flex flex-1 items-center gap-3">
          <span className="whitespace-nowrap text-[11px] font-bold tabular-nums">{fmtClock(uptoTime)}</span>
          <input type="range" min={1} max={base.length} value={idx} onChange={(e) => { setPlaying(false); setIdx(Number(e.target.value)); }} className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-line accent-primary-500" />
          <span className="whitespace-nowrap text-[10px] text-ink-mute">{new Date(base.at(-1)!.time * 1000).toLocaleDateString("en-US", { month: "short", day: "2-digit" })}</span>
        </div>
        <Button variant="outline" size="sm" onClick={() => setStatsOpen(true)}><BarChart3 size={13} /> Stats</Button>
        <Button variant="icon" size="iconSm" onClick={toggleFull}>{full ? <Minimize2 size={14} /> : <Maximize2 size={14} />}</Button>
      </div>

      <div className="flex min-h-0 flex-1">
        <div className="flex w-9 shrink-0 flex-col items-center gap-0.5 border-r border-line bg-surface py-2">
          {[{ i: <Crosshair size={15} />, l: "Crosshair", on: true }, { i: <TrendingUp size={15} />, l: "Trendline" }, { i: <Ruler size={15} />, l: "Measure" },
            { i: <Type size={15} />, l: "Text" }, { i: <Eraser size={15} />, l: "Eraser" }, { i: <Lock size={15} />, l: "Lock" }, { i: <Trash2 size={15} />, l: "Clear" }].map((b, k) => (
            <button key={k} disabled={!b.on} title={b.on ? b.l : `${b.l} — premium charting (roadmap)`}
              className={cn("grid h-8 w-8 place-items-center rounded-md", b.on ? "text-primary-600" : "cursor-not-allowed text-ink-mute opacity-50")}>{b.i}</button>
          ))}
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center justify-between border-b border-line bg-surface px-3 py-1.5">
            <div className="flex items-center gap-1">
              {INTERVALS.map((iv) => (
                <button key={iv} onClick={() => setDisplayIv(iv)} className={cn("rounded px-2 py-1 text-[10px] font-bold", displayIv === iv ? "bg-primary-500 text-white" : "text-ink-soft hover:bg-canvas")}>{iv}</button>
              ))}
              <button onClick={() => setSync((v) => !v)} title="sync: step a full candle vs form it tick-by-tick" className={cn("ml-1 rounded px-2 py-1 text-[9px] font-bold", sync ? "bg-success-soft text-success-deep" : "bg-canvas text-ink-mute")}>{sync ? "SYNC" : "TICK"}</button>
              <button onClick={() => setSimple((v) => !v)} className="ml-1 rounded px-2 py-1 text-[9px] font-bold text-ink-soft hover:bg-canvas">{simple ? "SIMPLE" : "CANDLES"}</button>
              <button onClick={() => setShowEma((v) => !v)} className={cn("ml-1 rounded px-2 py-1 text-[9px] font-bold", showEma ? "bg-primary-50 text-primary-600" : "text-ink-mute hover:bg-canvas")}>EMA</button>
              <button onClick={() => setShowVwap((v) => !v)} className={cn("rounded px-2 py-1 text-[9px] font-bold", showVwap ? "bg-primary-50 text-primary-600" : "text-ink-mute hover:bg-canvas")}>VWAP</button>
            </div>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1 text-[10px] font-semibold text-ink-soft"><Clock size={11} /> Go to<input type="datetime-local" onChange={onGoTo} className="h-7 rounded border border-line bg-surface px-1 text-[10px]" /></label>
              <Button variant="outline" size="sm" onClick={nextDayOpen}>Next day open</Button>
              <Select className="h-7 w-20 text-[10px]" value={scale} onChange={(e) => setScale(e.target.value as "normal" | "log")}><option value="normal">% lin</option><option value="log">log</option></Select>
            </div>
          </div>

          <div className="relative min-h-0 flex-1">
            <BacktestChart candles={revealedDisp} positions={state.open} realized={state.realized} simple={simple} onAdjust={onAdjust} showEma={showEma} showVwap={showVwap} />
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-line bg-surface px-3 py-2">
            <div className="flex items-center gap-2 text-[10px] font-semibold text-ink-soft">
              <span className="rounded bg-canvas px-2 py-1">{run.session.symbol} · {displayIv}</span>
              <span className="tabular-nums">{fmtHM(uptoTime)} (ET)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold tabular-nums text-ink-soft">{speed}x</span>
              <input type="range" min={0} max={SPEEDS.length - 1} value={SPEEDS.indexOf(speed)} onChange={(e) => setSpeed(SPEEDS[Number(e.target.value)])} className="h-1 w-24 cursor-pointer accent-primary-500" />
              <Button variant="icon" size="iconSm" onClick={() => { setPlaying(false); setIdx((i) => Math.max(1, i - (sync ? factor : 1))); }}><SkipBack size={14} /></Button>
              <Button variant="icon" size="iconSm" className="rounded-full bg-primary-500 text-white hover:bg-primary-600" onClick={() => { if (!playing && idx >= base.length) setIdx(1); setPlaying((p) => !p); }}>{playing ? <Pause size={14} /> : <Play size={14} className="ml-0.5" />}</Button>
              <Button variant="icon" size="iconSm" onClick={() => { setPlaying(false); setIdx((i) => Math.min(base.length, i + (sync ? factor : 1))); }}><SkipForward size={14} /></Button>
              <Select className="h-7 w-20 text-[10px]" value={displayIv} onChange={(e) => setDisplayIv(e.target.value)}>{INTERVALS.map((iv) => <option key={iv}>{iv}</option>)}</Select>
            </div>
            <div className="flex items-center gap-3 text-[10px] font-bold tabular-nums">
              <span className={cn(state.balance >= run.session.startBalance ? "text-success" : "text-danger")}>Equity {money(state.balance + state.open.reduce((s, p) => s + (curPrice - p.entry) * p.qty * (p.side === "buy" ? 1 : -1), 0))}</span>
              <span className="text-ink-mute">{completion.toFixed(0)}% played</span>
            </div>
          </div>

          <div className={cn("border-t border-line bg-surface", drawer ? "h-44" : "h-9")}>
            <button onClick={() => setDrawer((v) => !v)} className="flex w-full items-center justify-between px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-ink-soft">
              <span>Positions · {state.open.length} open / {state.pending.length} pending</span>
              <span className="flex items-center gap-2"><ChevronDown size={13} className={cn("transition-transform", drawer ? "" : "-rotate-90")} /></span>
            </button>
            {drawer && (
              <div className="h-[calc(100%-2.25rem)] overflow-auto scrollbar-thin px-3">
                <table className="w-full text-left text-[10px]">
                  <thead><tr className="text-[9px] uppercase text-ink-mute"><th className="py-1">ID</th><th>Side</th><th className="text-right">Qty</th><th className="text-right">Entry</th><th className="text-right">Cur</th><th className="text-right">uP&L</th><th className="text-right">TP</th><th className="text-right">SL</th><th></th></tr></thead>
                  <tbody>
                    {state.open.map((p) => {
                      const up = (curPrice - p.entry) * p.qty * (p.side === "buy" ? 1 : -1);
                      return (
                        <tr key={p.id} className="border-t border-line/60">
                          <td className="py-1 font-mono text-ink-mute">{p.id.slice(0, 6)}</td>
                          <td className={cn("font-bold uppercase", p.side === "buy" ? "text-success" : "text-danger")}>{p.side}</td>
                          <td className="text-right tabular-nums">{p.qty}</td>
                          <td className="text-right tabular-nums">{money(p.entry)}</td>
                          <td className="text-right tabular-nums">{money(curPrice)}</td>
                          <td className={cn("text-right font-bold tabular-nums", up >= 0 ? "text-success" : "text-danger")}>{money(up, { sign: true })}</td>
                          <td className="text-right"><NumEdit value={p.tp} onCommit={(v) => onAdjust(p.id, "tp", v)} /></td>
                          <td className="text-right"><NumEdit value={p.sl} onCommit={(v) => onAdjust(p.id, "sl", v)} /></td>
                          <td className="text-right"><button onClick={() => closePos(p.id)} className="rounded px-1.5 py-0.5 text-[9px] font-bold text-danger hover:bg-danger-soft">Close</button></td>
                        </tr>
                      );
                    })}
                    {state.pending.map((o) => (
                      <tr key={o.id} className="border-t border-line/60 text-ink-mute">
                        <td className="py-1 font-mono">{o.id.slice(0, 6)}</td><td className="uppercase">{o.side}</td>
                        <td className="text-right tabular-nums">{o.qty}</td><td className="text-right">limit {money(o.limit)}</td><td colSpan={4} className="text-right italic">pending</td>
                        <td className="text-right"><button onClick={() => cancelPend(o.id)} className="rounded px-1.5 py-0.5 text-[9px] font-bold text-ink-soft hover:bg-canvas">Cancel</button></td>
                      </tr>
                    ))}
                    {state.open.length === 0 && state.pending.length === 0 && <tr><td colSpan={9} className="py-6 text-center text-ink-mute">No open orders. Place one from the panel →</td></tr>}
                  </tbody>
                </table>
                {state.open.length > 0 && <button onClick={closeAll} className="my-2 text-[10px] font-bold text-danger hover:underline">Close all positions</button>}
              </div>
            )}
          </div>
        </div>

        <div className="flex w-72 shrink-0 flex-col border-l border-line bg-surface">
          <div className="flex border-b border-line">
            {([["order", <FileText size={13} key="o" />, "Order"], ["details", <Clock size={13} key="d" />, "Details"], ["calendar", <CalendarDays size={13} key="c" />, "Calendar"], ["orders", <TrendingUp size={13} key="r" />, "Orders"]] as const).map(([id, ic, lbl]) => (
              <button key={id} onClick={() => { setRail(id); setShowPanel(true); }} className={cn("flex flex-1 flex-col items-center gap-0.5 py-2 text-[9px] font-bold", rail === id ? "bg-primary-50 text-primary-600" : "text-ink-mute hover:bg-canvas")}>{ic}{lbl}</button>
            ))}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">
            {rail === "order" && showPanel && (
              <OrderPanel symbol={run.session.symbol} currentPrice={curPrice} balance={state.balance} startBalance={run.session.startBalance}
                onClose={() => setShowPanel(false)} onSubmit={placeOrder} />
            )}
            {rail === "order" && !showPanel && <div className="p-4 text-center"><Button size="sm" onClick={() => setShowPanel(true)}>Open order panel</Button></div>}
            {rail === "details" && (
              <div className="space-y-2 p-4 text-[11px]">
                <Row k="Session" v={run.session.name} /><Row k="Symbol" v={`${run.session.symbol} · ${run.session.assetType}`} />
                <Row k="Range" v={`${run.session.startDate} → ${run.session.endDate}`} /><Row k="Base feed" v={run.baseInterval} />
                <Row k="Start balance" v={money(run.session.startBalance)} /><Row k="Current equity" v={money(state.equity.at(-1)?.value ?? run.session.startBalance)} />
                <Row k="Realized P&L" v={money(state.realized.reduce((s, r) => s + r.pnl, 0), { sign: true })} tone={state.realized.reduce((s, r) => s + r.pnl, 0) >= 0 ? "pos" : "neg"} />
                <Row k="Win rate" v={`${winRate.toFixed(1)}% (${wins}/${state.realized.length})`} /><Row k="Max drawdown" v={money(dd)} tone="neg" />
                <Row k="Completion" v={`${completion.toFixed(0)}%`} />
                {run.session.description && <p className="pt-2 text-ink-soft">{run.session.description}</p>}
                <p className="pt-2 text-[9px] text-ink-mute">Tip: drag the green/red dashed lines on the chart to move TARGET/STOP, or edit them in the Positions drawer.</p>
              </div>
            )}
            {rail === "calendar" && <MiniCalendar candles={base} upto={uptoTime} onPick={jumpToTime} />}
            {rail === "orders" && (
              <div className="p-2">
                {[...state.events].reverse().slice(0, 80).map((e, i) => (
                  <div key={i} className="flex items-center justify-between border-b border-line/50 py-1.5 text-[10px]">
                    <span className="text-ink-soft">{fmtHM(e.time)}</span><span className="flex-1 px-2 truncate">{e.label}</span>
                    {e.pnl !== 0 && <span className={cn("font-bold tabular-nums", e.pnl >= 0 ? "text-success" : "text-danger")}>{money(e.pnl, { sign: true })}</span>}
                  </div>
                ))}
                {state.events.length === 0 && <p className="py-8 text-center text-[10px] text-ink-mute">No order activity yet.</p>}
              </div>
            )}
          </div>
        </div>
      </div>

      {statsOpen && (
        <SessionAnalytics state={state} session={{ name: run.session.name, symbol: run.session.symbol, startBalance: run.session.startBalance }}
          completion={completion} notes={notes} onAddNote={addNote} onJump={jumpToTime} onClose={() => setStatsOpen(false)} />
      )}
    </div>
  );
}

function NumEdit({ value, onCommit }: { value: number | null; onCommit: (v: number) => void }) {
  return (
    <input type="number" step="any" defaultValue={value ?? ""} placeholder="--"
      onBlur={(e) => { const v = Number(e.target.value); if (e.target.value !== "" && v > 0) onCommit(v); }}
      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
      className="h-6 w-16 rounded border border-line bg-surface px-1 text-right text-[10px] tabular-nums outline-none focus:border-primary-500" />
  );
}
function Row({ k, v, tone }: { k: string; v: string; tone?: "pos" | "neg" }) {
  return <div className="flex items-center justify-between border-b border-line/50 py-1"><span className="text-ink-mute">{k}</span><span className={cn("font-bold tabular-nums", tone === "pos" ? "text-success" : tone === "neg" ? "text-danger" : "")}>{v}</span></div>;
}

function MiniCalendar({ candles, upto, onPick }: { candles: Candle[]; upto: number; onPick: (t: number) => void }) {
  const days = useMemo(() => { const m = new Map<string, number>(); for (const c of candles) { const k = new Date(c.time * 1000).toLocaleDateString("en-CA", { timeZone: "America/New_York" }); if (!m.has(k)) m.set(k, c.time); } return m; }, [candles]);
  const months = useMemo(() => {
    const set = new Set<string>();
    for (const c of candles) set.add(new Date(c.time * 1000).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "America/New_York" }));
    return Array.from(set);
  }, [candles]);
  const [mo, setMo] = useState(months[0] ?? "");
  const grid = useMemo(() => {
    if (!mo) return [];
    const [mName, yStr] = mo.split(" "); const y = Number(yStr); const m = new Date(`${mName} 1, ${y}`).getMonth();
    const first = new Date(y, m, 1).getDay(); const dim = new Date(y, m + 1, 0).getDate();
    const cells: ({ d: number; t?: number; played?: boolean } | null)[] = Array(first).fill(null);
    for (let d = 1; d <= dim; d++) { const key = new Date(y, m, d).toLocaleDateString("en-CA", { timeZone: "America/New_York" }); const t = days.get(key); cells.push({ d, t, played: t != null && t <= upto }); }
    return cells;
  }, [mo, days, upto]);
  return (
    <div className="p-3 text-[10px]">
      <div className="mb-2 flex items-center justify-between">
        <button onClick={() => setMo(months[Math.max(0, months.indexOf(mo) - 1)] ?? mo)} className="text-ink-mute hover:text-ink">‹</button>
        <span className="font-bold">{mo}</span>
        <button onClick={() => setMo(months[Math.min(months.length - 1, months.indexOf(mo) + 1)] ?? mo)} className="text-ink-mute hover:text-ink">›</button>
      </div>
      <div className="grid grid-cols-7 gap-0.5 text-center text-ink-mute">{["S", "M", "T", "W", "T", "F", "S"].map((w, i) => <span key={i}>{w}</span>)}</div>
      <div className="mt-0.5 grid grid-cols-7 gap-0.5">
        {grid.map((c, i) => c == null ? <span key={i} /> : (
          <button key={i} disabled={c.t == null} onClick={() => c.t != null && onPick(c.t)}
            className={cn("aspect-square rounded text-[9px] font-bold", c.t == null ? "text-ink-mute/40" : c.played ? "bg-primary-500 text-white" : "bg-canvas text-ink-soft hover:bg-primary-50")}>{c.d}</button>
        ))}
      </div>
      <p className="mt-2 text-center text-[9px] text-ink-mute">click a played day to jump the playback there</p>
    </div>
  );
}