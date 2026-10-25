"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Camera, ChevronLeft, ChevronRight, Eye, EyeOff, Maximize2, Play, Share2, SlidersHorizontal, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { StarRating } from "@/components/ui/star-rating";
import { TagInput } from "@/components/ui/tag-input";
import { cn, money } from "@/lib/utils";
import { api } from "@/lib/api";
import { clientGetToken } from "@/lib/auth";
import { CandleChart } from "./candle-chart";
import { RunningPnlChart } from "./running-pnl-chart";
import { ExecutionsTable } from "./executions-table";
import { NoteEditor } from "./note-editor";
import { PlaybooksPanel } from "./playbooks-panel";
import type { Candle, ChartStyle, Marker, ReplayData, ReplayTrade, ReplayExecution, RunningPoint, TradeSummary } from "@/types";

const INTERVALS = ["1m", "5m", "15m", "1h", "1d"];
const todayISO = () => new Date().toISOString().slice(0, 10);
const prevISO = (d: string) => { const x = new Date(d + "T00:00:00Z"); x.setUTCDate(x.getUTCDate() - 1); return x.toISOString().slice(0, 10); };
const r2 = (v: number) => Math.round(v * 100) / 100;

function containing(candles: Candle[], t: number): Candle | null {
  if (!candles.length) return null;
  let ch: Candle | null = null;
  for (const c of candles) { if (c.time <= t) ch = c; else break; }
  return ch ?? candles[0];
}

function computeMarkers(trade: ReplayTrade | null, execs: ReplayExecution[], candles: Candle[]): Marker[] {
  if (!trade || !candles.length) return [];
  const pts = execs.length
    ? execs.map((e) => ({ time: e.epoch, price: e.price, side: e.side, qty: Math.abs(e.qty) }))
    : [
        { time: Math.floor(Date.parse(trade.openDate) / 1000), price: NaN, side: "buy", qty: trade.optionsTraded || 1 },
        ...(trade.closeDate ? [{ time: Math.floor(Date.parse(trade.closeDate) / 1000), price: NaN, side: "sell", qty: trade.optionsTraded || 1 }] : []),
      ];
  return pts.map((p) => {
    const cd = containing(candles, p.time)!;
    const price = Number.isFinite(p.price) ? Math.min(Math.max(p.price, cd.low), cd.high) : cd.close;
    return { time: cd.time, price: r2(price), side: p.side, qty: r2(p.qty), label: `${p.side === "buy" ? "BUY" : "SELL"} ${r2(p.qty)} @ ${r2(price)}` };
  });
}

async function loadCandlesWithFallback(symbol: string, day: string, interval: string, token?: string) {
  let cur = day, lastErr: string | null = null;
  for (let i = 0; i < 6; i++) {
    try {
      const c = await api.market.candles(symbol, cur, interval, token);
      if (c && c.length) return { candles: c, usedDay: cur, err: null as string | null };
    } catch (e) { lastErr = e instanceof Error ? e.message : "candles unavailable"; }
    cur = prevISO(cur);
  }
  return { candles: [] as Candle[], usedDay: day, err: lastErr };
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="flex items-center justify-between border-b border-line/60 py-2 last:border-0"><span className="text-[11px] text-ink-soft">{label}</span><span className="text-[11px] font-bold tabular-nums">{children}</span></div>;
}

export function ReplayView({ tradeId, day }: { tradeId: string | null; day: string | null }) {
  const router = useRouter();
  const tok = useCallback(() => clientGetToken() ?? undefined, []);
  const [data, setData] = useState<ReplayData | null>(null);
  const [dayTrades, setDayTrades] = useState<TradeSummary[]>([]);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [fallbackNote, setFallbackNote] = useState("");
  const [interval, setInterval] = useState("1m");
  const [style, setStyle] = useState<ChartStyle>("lightweight");
  const [hidePnl, setHidePnl] = useState(false);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [loadingReplay, setLoadingReplay] = useState(false);
  const [loadingList, setLoadingList] = useState(false);
  const [loadingCandles, setLoadingCandles] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [leftTab, setLeftTab] = useState<"stats" | "playbooks">("stats");

  const effDay = day ?? data?.day ?? null;

  useEffect(() => { api.users.getMe(tok()).then((u) => setStyle((u.chartStyle as ChartStyle) ?? "lightweight")).catch(() => {}); }, [tok]);

  useEffect(() => {
    if (!tradeId) { setData(null); return; }
    let alive = true;
    setLoadingReplay(true);
    api.trades.replay(tradeId, "1m", tok())
      .then((d) => { if (alive) { setData(d); setErr(null); } })
      .catch((e) => { if (alive) { setErr(e instanceof Error ? e.message : "Failed to load replay"); setData(null); } })
      .finally(() => { if (alive) setLoadingReplay(false); });
    return () => { alive = false; };
  }, [tradeId, reloadNonce, tok]);

  useEffect(() => {
    if (!effDay) { setDayTrades([]); return; }
    let alive = true;
    setLoadingList(true);
    api.trades.byDay(effDay, tok())
      .then((list) => {
        if (!alive) return;
        setDayTrades(list);
        const ids = new Set(list.map((x) => x.id));
        if ((!tradeId || !ids.has(tradeId)) && list.length) {
          router.replace(`/replay?trade=${list[0].id}&day=${effDay}`);
        }
      })
      .catch(() => { if (alive) setDayTrades([]); })
      .finally(() => { if (alive) setLoadingList(false); });
    return () => { alive = false; };
  }, [effDay, tradeId, router, tok]);

  useEffect(() => {
    const sym = data?.trade.symbol;
    if (!sym || !effDay) { setCandles([]); setFallbackNote(""); return; }
    let alive = true;
    setLoadingCandles(true);
    loadCandlesWithFallback(sym, effDay, interval, tok())
      .then(({ candles: c, usedDay, err: ce }) => {
        if (!alive) return;
        setCandles(c);
        setFallbackNote(usedDay !== effDay && c.length ? `Market closed on ${effDay} — showing ${usedDay}` : "");
        if (!c.length && ce) setErr(ce);
      })
      .finally(() => { if (alive) setLoadingCandles(false); });
    return () => { alive = false; };
  }, [data?.trade.symbol, effDay, interval, tok]);

  const markers = useMemo(() => computeMarkers(data?.trade ?? null, data?.executions ?? [], candles), [data, candles]);

  const derived = useMemo(() => {
    if (!data) return { running: [] as RunningPoint[], mae: null as number | null, mfe: null as number | null };
    const execs = [...data.executions].sort((a, b) => a.epoch - b.epoch);
    if (!execs.length || !candles.length) return { running: data.runningPnl, mae: data.maeMfe.mae, mfe: data.maeMfe.mfe };
    let pos = 0, basis = 0, fees = 0, realized = 0, ei = 0;
    const running: RunningPoint[] = [];
    for (const c of candles) {
      while (ei < execs.length && execs[ei].epoch <= c.time) {
        const e = execs[ei]; const q = Math.abs(e.qty) * (e.side === "buy" ? 1 : -1); const px = e.price; fees += e.commission + e.fee;
        if (pos === 0 || (pos > 0) === (q > 0)) { pos += q; basis += q * px; }
        else { const closing = Math.min(Math.abs(q), Math.abs(pos)); const avg = basis / pos; realized += (pos > 0 ? (px - avg) : (avg - px)) * closing; pos += q; basis = pos ? avg * pos : 0; }
        ei++;
      }
      const unreal = pos ? (c.close - basis / pos) * pos : 0;
      running.push({ time: c.time, pnl: r2(realized + unreal - fees) });
    }
    const entryExec = execs[0];
    let mae: number | null = null, mfe: number | null = null;
    const after = candles.filter((c) => c.time >= entryExec.epoch);
    if (after.length) {
      if (entryExec.side === "buy") { mae = r2(entryExec.price - Math.min(...after.map((c) => c.low))); mfe = r2(Math.max(...after.map((c) => c.high)) - entryExec.price); }
      else { mae = r2(Math.max(...after.map((c) => c.high)) - entryExec.price); mfe = r2(entryExec.price - Math.min(...after.map((c) => c.low))); }
    }
    return { running, mae, mfe };
  }, [data, candles]);

  async function patch(fields: Record<string, unknown>) {
    if (!data) return;
    await api.trades.patch(data.trade.id, fields, tok());
    setData({ ...data, trade: { ...data.trade, ...fields } as ReplayTrade });
  }
  async function saveStyle(s: ChartStyle) { setStyle(s); await api.users.setChartStyle(s, tok()); }
  const onDate = (v: string) => router.replace(`/replay?day=${v}`);
  const onChip = (id: string) => effDay && router.replace(`/replay?trade=${id}&day=${effDay}`);
  const onNeighbor = (id: string | null) => id && router.replace(`/replay?trade=${id}`);
  const openLiveTab = () => { if (data && effDay) window.open(`/replay-live?trade=${data.trade.id}&day=${effDay}`, "_blank", "noopener,noreferrer"); };

  const busy = loadingReplay || loadingList || loadingCandles;
  const t = data?.trade ?? null;
  const maeMfeTotal = ((derived.mae ?? 0) + (derived.mfe ?? 0)) || 1;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Link href="/journal" className="flex items-center gap-1 text-[11px] font-bold text-ink-soft hover:text-primary-600"><ArrowLeft size={13} /> BACK</Link>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm"><Play size={12} /> REPLAY</Button>
          <Button variant="outline" size="sm" onClick={openLiveTab} disabled={!data}><Maximize2 size={12} /> Open new Tab</Button>
          <Button variant="icon" size="iconSm" disabled={!data?.prevTradeId} onClick={() => onNeighbor(data?.prevTradeId ?? null)}><ChevronLeft size={14} /></Button>
          <span className="text-[10px] font-bold text-ink-mute">Previous / Next Trade</span>
          <Button variant="icon" size="iconSm" disabled={!data?.nextTradeId} onClick={() => onNeighbor(data?.nextTradeId ?? null)}><ChevronRight size={14} /></Button>
          <Button variant="icon" size="iconSm"><Share2 size={14} /></Button>
        </div>
      </div>

      {busy && <div className="h-0.5 w-full overflow-hidden rounded bg-canvas"><div className="h-full w-1/3 animate-pulse bg-primary-500" /></div>}

      {dayTrades.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wide text-ink-mute">{effDay} · {dayTrades.length} trade{dayTrades.length > 1 ? "s" : ""}</span>
          {dayTrades.map((x) => (
            <button key={x.id} onClick={() => onChip(x.id)}
              className={cn("flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold transition-colors",
                x.id === tradeId ? "border-primary-500 bg-primary-500 text-white" : "border-line bg-surface text-ink-soft hover:border-primary-300")}>
              <span className={cn("h-1.5 w-1.5 rounded-full", x.status === "open" ? "bg-warn" : x.netPnl >= 0 ? "bg-success" : "bg-danger")} />
              {x.symbol}
              <span className={cn("tabular-nums", x.id === tradeId ? "text-white/90" : x.netPnl >= 0 ? "text-success" : "text-danger")}>{money(x.netPnl, { sign: true })}</span>
            </button>
          ))}
        </div>
      )}

      {!t ? (
        <Card className="p-10 text-center">
          <p className="text-sm font-bold">{err ? "Replay unavailable" : dayTrades.length === 0 && effDay ? "No trades on this day" : "Loading…"}</p>
          <p className="mt-1 text-[11px] text-ink-soft">{err ?? (effDay ? `Pick a trading day that has fills, or add/import a trade for ${effDay}.` : "Resolving your latest trade…")}</p>
          <Button className="mt-4" size="sm" onClick={() => router.back()}><ArrowLeft size={13} /> Back</Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[360px_1fr]">
          <Card className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-lg font-black">{t.symbol}</p>
                <p className="text-[11px] font-semibold text-ink-soft">{t.dayLabel}</p>
                <p className="text-[10px] text-ink-mute">{t.instrument}</p>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="icon" size="iconSm"><SlidersHorizontal size={13} /></Button>
                <Button variant="icon" size="iconSm" onClick={openLiveTab}><Maximize2 size={13} /></Button>
                <Button variant="icon" size="iconSm"><Trash2 size={13} /></Button>
              </div>
            </div>

            <div className="mt-3 flex gap-4 border-b border-line pb-2 text-[11px] font-bold">
              <button onClick={() => setLeftTab("stats")} className={cn("pb-2", leftTab === "stats" ? "border-b-2 border-primary-500 text-primary-600" : "text-ink-mute")}>Stats</button>
              <button onClick={() => setLeftTab("playbooks")} className={cn("pb-2", leftTab === "playbooks" ? "border-b-2 border-primary-500 text-primary-600" : "text-ink-mute")}>Playbooks</button>
            </div>

            {leftTab === "stats" ? (
              <>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-xs font-extrabold uppercase tracking-wide text-danger">Net P&L</span>
                  <div className="flex items-center gap-1.5">
                    <span className={cn("text-sm font-black tabular-nums", hidePnl ? "blur-sm" : t.netPnl >= 0 ? "text-success" : "text-danger")}>{money(t.netPnl, { sign: true })}</span>
                    <button onClick={() => setHidePnl((v) => !v)} className="text-ink-mute hover:text-ink">{hidePnl ? <EyeOff size={13} /> : <Eye size={13} />}</button>
                  </div>
                </div>

                <div className="mt-2">
                  <Row label="Options traded">{t.optionsTraded}</Row>
                  <Row label="Commissions & Fees">{money(t.commissionsFees)}</Row>
                  <Row label="Net ROI"><span className={t.netRoi == null ? "text-ink-mute" : t.netRoi >= 0 ? "text-success" : "text-danger"}>{t.netRoi == null ? "--" : `${t.netRoi.toFixed(2)}%`}</span></Row>
                  <Row label="Gross P&L"><span className={t.netPnl >= 0 ? "text-success" : "text-danger"}>{money(t.netPnl)}</span></Row>
                  <Row label="Adjusted cost">{money(t.adjustedCost)}</Row>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <label className="text-[10px] font-semibold text-ink-soft">Profit Target
                    <Input type="number" step="any" className="mt-1 h-8 text-[11px]" defaultValue={t.profitTarget ?? ""} placeholder="$"
                      onBlur={(e) => patch({ profit_target: e.target.value === "" ? null : Number(e.target.value) })} />
                  </label>
                  <label className="text-[10px] font-semibold text-ink-soft">Stop Loss
                    <Input type="number" step="any" className="mt-1 h-8 text-[11px]" defaultValue={t.stopLoss ?? ""} placeholder="$"
                      onBlur={(e) => patch({ stop_loss: e.target.value === "" ? null : Number(e.target.value) })} />
                  </label>
                  <label className="text-[10px] font-semibold text-ink-soft">Initial Target
                    <Input type="number" step="any" className="mt-1 h-8 text-[11px]" defaultValue={t.initialTarget ?? ""} placeholder="$"
                      onBlur={(e) => patch({ initial_target: e.target.value === "" ? null : Number(e.target.value) })} />
                  </label>
                  <label className="text-[10px] font-semibold text-ink-soft">Planned R-Multiple
                    <Input type="number" step="any" className="mt-1 h-8 text-[11px]" defaultValue={t.plannedR ?? ""} placeholder="--"
                      onBlur={(e) => patch({ planned_r: e.target.value === "" ? null : Number(e.target.value) })} />
                  </label>
                </div>

                <div className="mt-2">
                  <Row label="Trade Risk">--</Row>
                  <Row label="Realized R-Multiple">{t.realizedR == null ? "--" : t.realizedR.toFixed(2)}</Row>
                </div>

                <div className="mt-3 space-y-2">
                  <label className="block text-[10px] font-semibold text-ink-soft">Setups<TagInput value={t.setups} onChange={(v) => patch({ setups: v })} /></label>
                  <label className="block text-[10px] font-semibold text-ink-soft">Mistakes<TagInput value={t.mistakes} onChange={(v) => patch({ mistakes: v })} /></label>
                  <label className="block text-[10px] font-semibold text-ink-soft">Custom<TagInput value={t.customTags} onChange={(v) => patch({ custom_tags: v })} /></label>
                  <label className="block text-[10px] font-semibold text-ink-soft">Playbook
                    <Input className="mt-1 h-8 text-[11px]" defaultValue={t.playbook ?? ""} placeholder="e.g. ORB, VWAP pullback"
                      onBlur={(e) => patch({ playbook: e.target.value || null })} />
                  </label>
                  <label className="block text-[10px] font-semibold text-ink-soft">Tags<TagInput value={t.tags} onChange={(v) => patch({ tags: v })} /></label>
                </div>

                <div className="mt-4">
                  <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-ink-mute">Zella Scale · MAE / MFE</p>
                  <div className="flex h-2 overflow-hidden rounded-full bg-canvas">
                    <div className="bg-danger" style={{ width: `${((derived.mae ?? 0) / maeMfeTotal) * 100}%` }} />
                    <div className="bg-success" style={{ width: `${((derived.mfe ?? 0) / maeMfeTotal) * 100}%` }} />
                  </div>
                  <div className="mt-1 flex justify-between text-[10px] font-bold tabular-nums"><span className="text-danger">{derived.mae == null ? "--" : money(derived.mae)}</span><span className="text-success">{derived.mfe == null ? "--" : money(derived.mfe)}</span></div>
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wide text-ink-mute">Trade Rating</span>
                  <StarRating value={t.rating} onChange={(v) => patch({ rating: v })} />
                </div>
              </>
            ) : (
              <PlaybooksPanel trade={t} onChanged={() => setReloadNonce((n) => n + 1)} />
            )}
          </Card>

          <div className="flex flex-col gap-4">
            <Card className="p-3">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1">
                  <Button variant="icon" size="iconSm"><Camera size={13} /></Button>
                  <span className="text-[10px] font-bold text-ink-mute">{t.symbol}, {interval}</span>
                  {fallbackNote && <span className="ml-1 rounded bg-warn/15 px-1.5 py-0.5 text-[9px] font-bold text-warn">{fallbackNote}</span>}
                </div>
                <div className="flex items-center gap-1">
                  {INTERVALS.map((iv) => (
                    <button key={iv} onClick={() => setInterval(iv)} className={cn("rounded px-2 py-1 text-[10px] font-bold", interval === iv ? "bg-primary-500 text-white" : "text-ink-soft hover:bg-canvas")}>{iv}</button>
                  ))}
                  <Input type="date" className="h-7 w-32 text-[10px]" value={effDay ?? ""} onChange={(e) => onDate(e.target.value)} />
                  <Select className="h-7 w-28 text-[10px]" value={style} onChange={(e) => saveStyle(e.target.value as ChartStyle)}>
                    <option value="lightweight">Lightweight chart</option>
                    <option value="simple">Simple chart</option>
                  </Select>
                </div>
              </div>
              {candles.length === 0 ? (
                <div className="grid h-[360px] place-items-center text-center text-[11px] text-ink-mute">
                  {err ?? "No market data for this symbol/day (Yahoo rate-limit or closed market). Try a wider interval or another date."}
                  <Button size="sm" variant="outline" className="ml-3" onClick={() => setReloadNonce((n) => n + 1)}>Retry</Button>
                </div>
              ) : (
                <CandleChart candles={candles} markers={markers} simple={style === "simple"} />
              )}
            </Card>

            <Card className="p-3">
              <p className="mb-1 text-center text-[11px] font-bold">Running P&L</p>
              {derived.running.length ? <RunningPnlChart series={derived.running} /> : <p className="py-10 text-center text-[11px] text-ink-mute">No fill-level data to plot running P&L (booked-outcome demo row). Real imported/synced trades show this.</p>}
            </Card>

            <div>
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-ink-mute">Executions</p>
              <ExecutionsTable tradeId={t.id} rows={data!.executions} onChanged={() => setReloadNonce((n) => n + 1)} />
            </div>

            <div>
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-ink-mute">History / Notes</p>
              <NoteEditor initial={t.note} onSave={(v) => patch({ note: v })} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}