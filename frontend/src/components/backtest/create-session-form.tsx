"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { clientGetToken } from "@/lib/auth";
import type { WithRulesPlaybook } from "@/types";

const TYPES = ["forex", "stocks", "crypto", "futures", "indices"] as const;
const SUGGEST: Record<string, string[]> = {
  stocks: ["AAPL", "SPY", "QQQ", "TSLA", "NVDA", "MSFT"], crypto: ["BTC-USD", "ETH-USD", "SOL-USD"],
  forex: ["EURUSD=X", "GBPUSD=X", "USDJPY=X"], indices: ["^GSPC", "^DJI", "^IXIC", "US30"], futures: ["ES=F", "NQ=F", "CL=F", "GC=F"],
};
const today = () => new Date().toISOString().slice(0, 10);
const daysAgo = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };

export function CreateSessionForm({ playbooks }: { playbooks: WithRulesPlaybook[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [playbookId, setPlaybookId] = useState("");
  const [type, setType] = useState<(typeof TYPES)[number]>("stocks");
  const [symbol, setSymbol] = useState("AAPL");
  const [balance, setBalance] = useState(100000);
  const [startDate, setStartDate] = useState(daysAgo(20));
  const [endDate, setEndDate] = useState(today());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function create() {
    if (!name.trim()) { setErr("Session name is required"); return; }
    setBusy(true); setErr(null);
    try {
      const res = await api.backtests.create({
        name: name.trim(), description: description.trim() || null, playbookId: playbookId || null,
        assetType: type, symbol: symbol.trim().toUpperCase(), startBalance: balance, startDate, endDate, interval: "1m",
      }, clientGetToken() ?? undefined);
      router.push(`/backtesting/${res.id}`);
    } catch (e) { setErr(e instanceof Error ? e.message : "Create failed"); setBusy(false); }
  }

  return (
    <Card className="mx-auto w-full max-w-xl p-6">
      <p className="text-sm font-black">Create new session</p>
      <label className="mt-4 block text-[11px] font-semibold text-ink-soft">Session name*</label>
      <Input className="mt-1" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Opening Range Test" />
      <label className="mt-3 block text-[11px] font-semibold text-ink-soft">Description</label>
      <Input className="mt-1" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What are you testing?" />

      <div className="mt-3 flex items-center justify-between">
        <label className="text-[11px] font-semibold text-ink-soft">Connect to playbook</label>
        <Link href="/playbook/create" className="text-[10px] font-bold text-primary-600 hover:underline">Create new playbook</Link>
      </div>
      <Select className="mt-1" value={playbookId} onChange={(e) => setPlaybookId(e.target.value)}>
        <option value="">— none —</option>
        {playbooks.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </Select>

      <label className="mt-3 block text-[11px] font-semibold text-ink-soft">Type</label>
      <div className="mt-1 flex flex-wrap gap-1">
        {TYPES.map((t) => (
          <button key={t} onClick={() => { setType(t); setSymbol(SUGGEST[t][0]); }}
            className={cn("rounded-lg border px-3 py-1.5 text-[11px] font-bold capitalize", type === t ? "border-primary-500 bg-primary-50 text-primary-600" : "border-line text-ink-soft hover:bg-canvas")}>{t}</button>
        ))}
      </div>

      <label className="mt-3 block text-[11px] font-semibold text-ink-soft">Symbol</label>
      <Input className="mt-1" list="bt-symbols" value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())} />
      <datalist id="bt-symbols">{SUGGEST[type].map((s) => <option key={s} value={s} />)}</datalist>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[11px] font-semibold text-ink-soft">Start balance*</label>
          <Input type="number" step="any" className="mt-1" value={balance} onChange={(e) => setBalance(Number(e.target.value))} />
          <p className="mt-1 text-[9px] text-ink-mute">Leverage is 1:1</p>
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-ink-soft">Date range*</label>
          <div className="mt-1 flex items-center gap-1">
            <Input type="date" className="text-[11px]" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            <span className="text-ink-mute">–</span>
            <Input type="date" className="text-[11px]" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
          <p className="mt-1 text-[9px] text-ink-mute">Start time is 12 am US Eastern · intraday depth limited by free feed</p>
        </div>
      </div>

      {err && <p className="mt-3 text-[11px] font-semibold text-danger">{err}</p>}
      <div className="mt-5 flex gap-2">
        <Button disabled={busy} onClick={create}>{busy ? "Creating…" : "Create session"}</Button>
        <Button variant="outline" onClick={() => router.push("/backtesting")}>Cancel</Button>
      </div>
    </Card>
  );
}