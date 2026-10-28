import type { BtAction, BtEvent, BtEquityPoint, BtPending, BtPos, BtRealized, BtState, Candle } from "@/types";

const r2 = (v: number) => Math.round(v * 100) / 100;
const r4 = (v: number) => Math.round(v * 10000) / 10000;
const dirOf = (side: string) => (side === "buy" ? 1 : -1);

export function simulate(candles: Candle[], actions: BtAction[], uptoTime: number, startBalance: number): BtState {
  const acts = [...actions].sort((a, b) => a.atTime - b.atTime);
  let ai = 0;
  let balance = startBalance;
  const pending = new Map<string, BtPending>();
  const open = new Map<string, BtPos>();
  const realized: BtRealized[] = [];
  const events: BtEvent[] = [];
  const equity: BtEquityPoint[] = [];

  const book = (pid: string, exit: number, t: number, reason: string) => {
    const p = open.get(pid); if (!p) return;
    open.delete(pid);
    const d = dirOf(p.side);
    const pnl = r2((exit - p.entry) * p.qty * d);
    balance = r2(balance + pnl);
    realized.push({ id: pid, side: p.side, qty: p.qty, entry: p.entry, exit, entryTime: p.entryTime, exitTime: t, pnl, reason, tp: p.tp, sl: p.sl });
    events.push({ time: t, type: reason, label: `${reason.replace("_", " ").toUpperCase()} · ${pnl >= 0 ? "+" : ""}${pnl}`, pnl });
  };

  for (const c of candles) {
    if (c.time > uptoTime) break;
    while (ai < acts.length && acts[ai].atTime <= c.time) {
      const a = acts[ai++]; const pl = (a.payload || {}) as Record<string, unknown>; const aid = a.id;
      if (a.kind === "order") {
        const side = (pl.side as "buy" | "sell") || "buy";
        const type = (pl.type as "market" | "limit") || "market";
        const qty = Number(pl.qty) || 0;
        const tp = pl.tp != null && pl.tp !== "" && Number(pl.tp) !== 0 ? Number(pl.tp) : null;
        const sl = pl.sl != null && pl.sl !== "" && Number(pl.sl) !== 0 ? Number(pl.sl) : null;
        if (type === "limit") {
          const lp = Number(pl.limitPrice) || 0;
          pending.set(aid, { id: aid, side, qty, limit: lp, tp, sl });
          events.push({ time: c.time, type: "placed", label: `LIMIT ${side.toUpperCase()} ${qty} @ ${lp}`, pnl: 0 });
        } else {
          open.set(aid, { id: aid, side, qty, entry: c.close, entryTime: c.time, tp, sl });
          events.push({ time: c.time, type: "filled", label: `MARKET ${side.toUpperCase()} ${qty} @ ${c.close}`, pnl: 0 });
        }
      } else if (a.kind === "cancel") {
        const tid = String(pl.targetId ?? "");
        if (pending.delete(tid)) events.push({ time: c.time, type: "cancelled", label: "Order cancelled", pnl: 0 });
      } else if (a.kind === "close") {
        const tid = String(pl.targetId ?? "");
        if (open.has(tid)) book(tid, c.close, c.time, "closed");
      } else if (a.kind === "modify") {
        const tid = String(pl.targetId ?? "");
        const tgt = open.get(tid) || pending.get(tid);
        if (tgt) {
          if (pl.tp !== undefined) (tgt as BtPos & BtPending).tp = pl.tp === null || pl.tp === "" ? null : Number(pl.tp);
          if (pl.sl !== undefined) (tgt as BtPos & BtPending).sl = pl.sl === null || pl.sl === "" ? null : Number(pl.sl);
        }
      }
    }
    for (const [pid, o] of [...pending]) {
      const hit = (o.side === "buy" && c.low <= o.limit) || (o.side === "sell" && c.high >= o.limit);
      if (hit) {
        pending.delete(pid);
        open.set(pid, { id: pid, side: o.side, qty: o.qty, entry: o.limit, entryTime: c.time, tp: o.tp, sl: o.sl });
        events.push({ time: c.time, type: "filled", label: `LIMIT ${o.side.toUpperCase()} filled @ ${o.limit}`, pnl: 0 });
      }
    }
    for (const [pid, p] of [...open]) {
      const d = dirOf(p.side);
      const slHit = p.sl != null && ((d === 1 && c.low <= p.sl) || (d === -1 && c.high >= p.sl));
      const tpHit = p.tp != null && ((d === 1 && c.high >= p.tp) || (d === -1 && c.low <= p.tp));
      if (slHit) book(pid, p.sl as number, c.time, "stop_loss");
      else if (tpHit) book(pid, p.tp as number, c.time, "take_profit");
    }
    let upnl = 0;
    for (const p of open.values()) upnl += (c.close - p.entry) * p.qty * dirOf(p.side);
    equity.push({ time: c.time, value: r2(balance + upnl) });
  }
  return { balance: r2(balance), open: Array.from(open.values()), pending: Array.from(pending.values()), realized, events, equity };
}

/** Aggregate base candles up to a coarser timeframe (exact; powers the playback interval selector). */
export function aggregate(candles: Candle[], factorMin: number): Candle[] {
  if (factorMin <= 1) return candles;
  const step = factorMin * 60;
  const buckets = new Map<number, Candle[]>();
  for (const c of candles) {
    const k = Math.floor(c.time / step) * step;
    (buckets.get(k) ?? buckets.set(k, []).get(k)!).push(c);
  }
  return Array.from(buckets.entries()).sort((a, b) => a[0] - b[0]).map(([k, cs]) => ({
    time: k, open: cs[0].open, high: Math.max(...cs.map((x) => x.high)),
    low: Math.min(...cs.map((x) => x.low)), close: cs.at(-1)!.close, volume: cs.reduce((s, x) => s + x.volume, 0),
  }));
}

export const FACTOR: Record<string, number> = { "1m": 1, "5m": 5, "15m": 15, "1h": 60, "1d": 1440 };

/** Risk-based position size (advanced order). Returns null when it can't be derived (no stop / zero distance). */
export function sizeFromRisk(opts: { balance: number; entry: number; sl: number | null; riskPct: number }): number | null {
  if (opts.sl == null) return null;
  const dist = Math.abs(opts.entry - opts.sl);
  if (dist <= 0) return null;
  const riskAmount = opts.balance * (opts.riskPct / 100);
  return r4(riskAmount / dist);
}