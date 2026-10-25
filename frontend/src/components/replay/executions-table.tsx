"use client";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { cn, money } from "@/lib/utils";
import { api } from "@/lib/api";
import { clientGetToken } from "@/lib/auth";
import type { ReplayExecution } from "@/types";

const today = () => new Date().toISOString().slice(0, 10);

export function ExecutionsTable({ tradeId, rows, onChanged }:
  { tradeId: string; rows: ReplayExecution[]; onChanged: () => void }) {
  const tok = () => clientGetToken() ?? undefined;
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ date: today(), time: "09:30", qty: 1, side: "buy" as "buy" | "sell", price: 0, commission: 0, fee: 0 });
  const [busy, setBusy] = useState(false);

  async function add() {
    setBusy(true);
    try { await api.trades.addExecution(tradeId, draft, tok()); setAdding(false); onChanged(); }
    finally { setBusy(false); }
  }
  async function del(id: string) { await api.trades.deleteExecution(id, tok()); onChanged(); }

  return (
    <div className="rounded-card border border-line bg-surface">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-[11px]">
          <thead><tr className="bg-primary-50/60 text-[9px] font-bold uppercase tracking-wide text-ink-soft">
            <th className="px-2 py-2"></th>
            <th className="px-2 py-2">Date/Time</th><th className="px-2 py-2">Spread</th><th className="px-2 py-2">Instrument</th>
            <th className="px-2 py-2 text-right">Qty</th><th className="px-2 py-2 text-right">Price</th>
            <th className="px-2 py-2 text-right">Commission</th><th className="px-2 py-2 text-right">Fee</th>
            <th className="px-2 py-2 text-right">Position</th><th className="px-2 py-2 text-right">Adj. Cost</th>
            <th className="px-2 py-2 text-right">Adj. Proceed</th><th className="px-2 py-2 text-right">Gross P&L</th>
          </tr></thead>
          <tbody>
            {rows.map((e) => (
              <tr key={e.id} className="border-t border-line">
                <td className="px-2 py-2"><button onClick={() => del(e.id)} className="text-ink-mute hover:text-danger" aria-label="Delete execution"><Trash2 size={13} /></button></td>
                <td className="px-2 py-2 text-ink-soft">{e.time}</td>
                <td className="px-2 py-2 text-ink-soft">{e.spread}</td>
                <td className="px-2 py-2 text-ink-soft">{e.instrument}</td>
                <td className={cn("px-2 py-2 text-right font-semibold tabular-nums", e.qty < 0 ? "text-danger" : "text-success")}>{e.qty}</td>
                <td className="px-2 py-2 text-right tabular-nums">{money(e.price)}</td>
                <td className="px-2 py-2 text-right tabular-nums text-ink-soft">{money(e.commission)}</td>
                <td className="px-2 py-2 text-right tabular-nums text-ink-soft">{money(e.fee)}</td>
                <td className="px-2 py-2 text-right tabular-nums text-ink-soft">{e.position ?? "--"}</td>
                <td className="px-2 py-2 text-right tabular-nums text-ink-soft">{e.adjustedCost == null ? "--" : money(e.adjustedCost)}</td>
                <td className="px-2 py-2 text-right tabular-nums text-ink-soft">{e.adjustedProceed == null ? "--" : money(e.adjustedProceed)}</td>
                <td className={cn("px-2 py-2 text-right font-bold tabular-nums", (e.grossPnl ?? 0) > 0 ? "text-success" : (e.grossPnl ?? 0) < 0 ? "text-danger" : "text-ink-mute")}>{e.grossPnl == null ? "--" : money(e.grossPnl)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {adding ? (
        <div className="flex flex-wrap items-end gap-2 border-t border-line p-3">
          <Input type="date" className="h-8 w-32 text-[11px]" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} />
          <Input type="time" className="h-8 w-24 text-[11px]" value={draft.time} onChange={(e) => setDraft({ ...draft, time: e.target.value })} />
          <Select className="h-8 w-20 text-[11px]" value={draft.side} onChange={(e) => setDraft({ ...draft, side: e.target.value as "buy" | "sell" })}><option value="buy">Buy</option><option value="sell">Sell</option></Select>
          <Input type="number" step="any" className="h-8 w-20 text-[11px]" value={draft.qty} onChange={(e) => setDraft({ ...draft, qty: Number(e.target.value) })} placeholder="Qty" />
          <Input type="number" step="any" className="h-8 w-24 text-[11px]" value={draft.price} onChange={(e) => setDraft({ ...draft, price: Number(e.target.value) })} placeholder="Price" />
          <Input type="number" step="any" className="h-8 w-20 text-[11px]" value={draft.commission} onChange={(e) => setDraft({ ...draft, commission: Number(e.target.value) })} placeholder="Comm" />
          <Input type="number" step="any" className="h-8 w-20 text-[11px]" value={draft.fee} onChange={(e) => setDraft({ ...draft, fee: Number(e.target.value) })} placeholder="Fee" />
          <Button size="sm" disabled={busy || draft.qty <= 0} onClick={add}>{busy ? "…" : "Save"}</Button>
          <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
        </div>
      ) : (
        <div className="p-3"><Button size="sm" onClick={() => setAdding(true)}><Plus size={13} /> Add Execution</Button></div>
      )}
    </div>
  );
}