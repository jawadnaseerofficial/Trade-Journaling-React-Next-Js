// compare-view.tsx
"use client";
import { useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { cn, money } from "@/lib/utils";
import { api } from "@/lib/api";
import { clientGetToken } from "@/lib/auth";
import type { RpCompare, RpCompareGroup } from "@/types";

type G = { symbol: string; tags: string; side: string; start: string; end: string; pnl: string };
const empty: G = { symbol: "", tags: "", side: "", start: "", end: "", pnl: "net" };

export function CompareView({ symbols }: { symbols: string[] }) {
  const tok = () => clientGetToken() ?? undefined;
  const [a, setA] = useState<G>({ ...empty, symbol: symbols[0] || "" });
  const [b, setB] = useState<G>({ ...empty });
  const [res, setRes] = useState<RpCompare | null>(null);
  function toFilter(g: G) { return { start: g.start || undefined, end: g.end || undefined, symbols: g.symbol ? [g.symbol] : undefined, sides: g.side ? [g.side] : undefined, pnlBasis: g.pnl }; }
  async function gen() { setRes(await api.reports.compare(toFilter(a), toFilter(b), tok()).catch(() => null)); }
  const Grp = ({ title, g }: { title: string; g?: RpCompareGroup }) => (
    <Card className="p-4">
      <p className="text-[11px] font-black uppercase text-ink-soft">Statistics ({title})</p>
      <div className="mt-1">{(g?.stats || []).map((s, i) => <div key={i} className="flex justify-between border-b border-line/50 py-1 text-[11px]"><span className="text-ink-soft">{s.label}</span><span className={cn("font-bold tabular-nums", s.tone === "pos" ? "text-success" : s.tone === "neg" ? "text-danger" : "")}>{s.value}</span></div>)}</div>
      <p className="mt-3 text-[11px] font-black uppercase text-ink-soft">Overall evaluation</p>
      <div className="mt-1 flex items-center gap-4">
        <Donut pct={g?.winRate ?? 0} />
        <div className="text-[11px]"><p className="flex items-center gap-1 text-success"><span className="h-2 w-2 rounded-sm bg-success" />{g?.winners ?? 0} winners</p><p className="flex items-center gap-1 text-danger"><span className="h-2 w-2 rounded-sm bg-danger" />{g?.losers ?? 0} losers</p></div>
      </div>
      <p className="mt-3 text-[11px] font-black uppercase text-ink-soft">Daily net cumulative P&L</p>
      <div className="mt-1 h-32">{(g?.curve || []).length ? <ResponsiveContainer width="100%" height="100%"><AreaChart data={g!.curve} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}><CartesianGrid stroke="#F1F2F8" vertical={false} /><XAxis dataKey="t" tick={{ fontSize: 8 }} minTickGap={20} /><YAxis hide /><Tooltip contentStyle={{ fontSize: 10 }} /><Area type="monotone" dataKey="v" stroke="#0E9F6E" fill="url(#cmpG)" /></AreaChart></ResponsiveContainer> : <p className="grid h-full place-items-center text-[10px] text-ink-mute">Generate a report.</p>}<defs><linearGradient id="cmpG" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#12B981" stopOpacity={0.4} /><stop offset="100%" stopColor="#E5484D" stopOpacity={0.3} /></linearGradient></defs></div>
    </Card>
  );
  const Field = ({ label, children }: any) => <label className="flex items-center justify-between gap-2 text-[11px] font-semibold text-ink-soft"><span className="w-20">{label}</span>{children}</label>;
  const Form = ({ title, g, set }: any) => (
    <Card className="p-4"><p className="mb-2 text-[11px] font-black uppercase text-ink-soft">{title}</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Field label="Symbol"><Select className="h-7 text-[11px]" value={g.symbol} onChange={(e) => set({ ...g, symbol: e.target.value })}><option value="">—</option>{symbols.map((s) => <option key={s}>{s}</option>)}</Select></Field>
        <Field label="Tags"><Input className="h-7 text-[11px]" value={g.tags} onChange={(e) => set({ ...g, tags: e.target.value })} placeholder="tag" /></Field>
        <Field label="Side"><Select className="h-7 text-[11px]" value={g.side} onChange={(e) => set({ ...g, side: e.target.value })}><option value="">Any</option><option value="long">Long</option><option value="short">Short</option></Select></Field>
        <Field label="Start date"><Input type="date" className="h-7 text-[11px]" value={g.start} onChange={(e) => set({ ...g, start: e.target.value })} /></Field>
        <Field label="Trade P&L"><Select className="h-7 text-[11px]" value={g.pnl} onChange={(e) => set({ ...g, pnl: e.target.value })}><option value="net">Net</option><option value="gross">Gross</option></Select></Field>
        <Field label="End date"><Input type="date" className="h-7 text-[11px]" value={g.end} onChange={(e) => set({ ...g, end: e.target.value })} /></Field>
      </div>
    </Card>
  );
  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end gap-2"><Button variant="outline" size="sm" onClick={() => { setA({ ...empty }); setB({ ...empty }); setRes(null); }}>Reset</Button><Button size="sm" onClick={gen}>Generate report</Button></div>
      {!res ? <div className="grid grid-cols-1 gap-4 lg:grid-cols-2"><Form title="Group #1" g={a} set={setA} /><Form title="Group #2" g={b} set={setB} /></div>
            : <div className="grid grid-cols-1 gap-4 lg:grid-cols-2"><Grp title="Group #1" g={res.a} /><Grp title="Group #2" g={res.b} /></div>}
    </div>
  );
}
function Donut({ pct }: { pct: number }) {
  const r = 28, c = 2 * Math.PI * r, off = c * (1 - pct / 100);
  return <svg width="72" height="72" viewBox="0 0 72 72"><circle cx="36" cy="36" r={r} fill="none" stroke="#F1F2F8" strokeWidth="8" /><circle cx="36" cy="36" r={r} fill="none" stroke="#12B981" strokeWidth="8" strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round" transform="rotate(-90 36 36)" /><text x="36" y="34" textAnchor="middle" className="fill-ink text-[13px] font-black">{pct}%</text><text x="36" y="46" textAnchor="middle" className="fill-ink-mute text-[7px] uppercase">winrate</text></svg>;
}