"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { clientGetToken } from "@/lib/auth";
import { money } from "@/lib/utils";
import type { Account, ExecutionInput } from "@/types";

const ASSET_TYPES = ["Stock", "Option", "Future", "Future Option", "Forex", "Crypto", "CFD"];
type Row = ExecutionInput & { _id: string };
const today = () => new Date().toISOString().slice(0, 10);
const newRow = (): Row => ({ _id: crypto.randomUUID(), date: today(), time: "09:30", qty: 1, side: "buy", price: 0, commission: 0, fee: 0 });

export function ManualTab({ accounts, timezone }: { accounts: Account[]; timezone: string }) {
  const router = useRouter();
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [assetType, setAssetType] = useState("Stock");
  const [symbol, setSymbol] = useState("");
  const [rows, setRows] = useState<Row[]>([newRow()]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedTz = accounts.find((a) => a.id === accountId)?.timezone ?? timezone;

  const preview = useMemo(() => {
    let realized = 0; const longs: number[][] = []; const shorts: number[][] = [];
    const sorted = [...rows].sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
    for (const r of sorted) {
      const fee = r.commission + r.fee; const fu = r.qty ? fee / r.qty : 0; let rem = r.qty;
      const queue = r.side === "buy" ? shorts : longs;
      while (rem > 1e-9 && queue.length) {
        const lot = queue[0]; const m = Math.min(rem, lot[1]);
        realized += (r.side === "buy" ? (lot[2] - r.price) : (r.price - lot[2])) * m - lot[3] * (m / lot[0]) - fu * m;
        lot[1] -= m; rem -= m; if (lot[1] <= 1e-9) queue.shift();
      }
      if (rem > 1e-9) (r.side === "buy" ? longs : shorts).push([r.qty, rem, r.price, fee * (rem / r.qty)]);
    }
    const open = longs.reduce((s, l) => s + l[1], 0) + shorts.reduce((s, l) => s + l[1], 0);
    return { realized: Math.round(realized * 100) / 100, status: open > 1e-9 ? "open" : "closed" };
  }, [rows]);

  const valid = symbol.trim().length > 0 && accountId && rows.every((r) => r.qty > 0 && r.price >= 0);

  function update(id: string, patch: Partial<Row>) { setRows((rs) => rs.map((r) => (r._id === id ? { ...r, ...patch } : r))); }
  function addRow() { setRows((rs) => [...rs, newRow()]); }
  function removeRow(id: string) { setRows((rs) => (rs.length > 1 ? rs.filter((r) => r._id !== id) : rs)); }

  async function save() {
    if (!valid) return;
    setBusy(true); setError(null);
    try {
      await api.trades.manual({
        accountId, symbol: symbol.toUpperCase(), assetType: assetType.toLowerCase().replace(" ", "_"),
        timezone: selectedTz,
        executions: rows.map(({ _id, ...e }) => e),
      }, clientGetToken() ?? undefined);
      router.push("/"); router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save trade"); setBusy(false); }
  }

  return (
    <Card className="p-6">
      <h2 className="text-base font-bold">Trade Details</h2>
      <p className="mt-1 text-[11px] text-ink-soft">Use your account time zone ({selectedTz})</p>

      <label className="mt-5 block text-[11px] font-semibold">Account</label>
      <Select className="mt-1.5" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
        {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
      </Select>

      <label className="mt-4 block text-[11px] font-semibold">Type</label>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {ASSET_TYPES.map((t) => (
          <button key={t} onClick={() => setAssetType(t)}
            className={`rounded px-2.5 py-1 text-[11px] font-bold transition-colors ${assetType === t ? "bg-primary-500 text-white" : "bg-canvas text-ink-soft hover:bg-primary-50"}`}>
            {t}
          </button>
        ))}
      </div>

      <label className="mt-4 block text-[11px] font-semibold">Symbol</label>
      <Input className="mt-1.5 max-w-xs" value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())} placeholder="e.g. AMD or BTC/USD" />

      <div className="mt-5 overflow-x-auto rounded-card border border-line">
        <table className="w-full text-left text-[11px]">
          <thead><tr className="bg-primary-50/60 text-[10px] font-bold text-ink-soft">
            <th className="px-3 py-2">Date</th><th className="px-3 py-2">Time</th><th className="px-3 py-2">Qty</th>
            <th className="px-3 py-2">Side</th><th className="px-3 py-2">Price, $</th><th className="px-3 py-2">Comm, $</th>
            <th className="px-3 py-2">Fee, $</th><th className="px-3 py-2"></th>
          </tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r._id} className="border-t border-line">
                <td className="px-2 py-1.5"><Input type="date" className="h-8 w-32 text-[11px]" value={r.date} onChange={(e) => update(r._id, { date: e.target.value })} /></td>
                <td className="px-2 py-1.5"><Input type="time" className="h-8 w-24 text-[11px]" value={r.time} onChange={(e) => update(r._id, { time: e.target.value })} /></td>
                <td className="px-2 py-1.5"><Input type="number" step="any" className="h-8 w-20 text-[11px]" value={r.qty} onChange={(e) => update(r._id, { qty: Number(e.target.value) })} /></td>
                <td className="px-2 py-1.5">
                  <Select className="h-8 w-24 text-[11px]" value={r.side} onChange={(e) => update(r._id, { side: e.target.value as "buy" | "sell" })}>
                    <option value="buy">Buy</option><option value="sell">Sell</option>
                  </Select>
                </td>
                <td className="px-2 py-1.5"><Input type="number" step="any" className="h-8 w-24 text-[11px]" value={r.price} onChange={(e) => update(r._id, { price: Number(e.target.value) })} /></td>
                <td className="px-2 py-1.5"><Input type="number" step="any" className="h-8 w-20 text-[11px]" value={r.commission} onChange={(e) => update(r._id, { commission: Number(e.target.value) })} /></td>
                <td className="px-2 py-1.5"><Input type="number" step="any" className="h-8 w-20 text-[11px]" value={r.fee} onChange={(e) => update(r._id, { fee: Number(e.target.value) })} /></td>
                <td className="px-2 py-1.5 text-right"><button onClick={() => removeRow(r._id)} className="text-ink-mute hover:text-danger" aria-label="Remove row"><Trash2 size={14} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button onClick={addRow} className="mt-2 flex items-center gap-1 text-[11px] font-bold text-primary-600"><Plus size={13} /> Create new execution</button>

      <div className="mt-4 flex items-center justify-between">
        <p className="text-[11px] text-ink-soft">Live P&L preview: <span className={`font-extrabold ${preview.realized >= 0 ? "text-success" : "text-danger"}`}>{money(preview.realized)}</span> <Badge tone={preview.status === "closed" ? "success" : "primary"}>{preview.status}</Badge></p>
        {error && <p className="text-[11px] font-semibold text-danger">{error}</p>}
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={() => router.push("/")}>Cancel</Button>
        <Button size="sm" disabled={!valid || busy} onClick={save}>{busy ? "Saving…" : "Save Trade"}</Button>
      </div>
    </Card>
  );
}