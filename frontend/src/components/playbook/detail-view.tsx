"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Pencil, Plus, Share2, Trash2 } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Pagination } from "@/components/ui/pagination";
import { cn, money, pct } from "@/lib/utils";
import { api } from "@/lib/api";
import { clientGetToken } from "@/lib/auth";
import type { ExecutedRow, MissedRow, PlaybookDetail, PlaybookNote, PlaybookOverview } from "@/types";

const TABS = ["Overview", "Playbook Rules", "Executed Trades", "Missed Trades", "Notes"];

function Kpi({ label, value, tone }: { label: string; value: string; tone?: "pos" | "neg" }) {
  return (
    <div className="border-r border-line/60 px-4 py-3 last:border-0">
      <p className="text-[10px] font-semibold text-ink-soft">{label}</p>
      <p className={cn("mt-1 text-sm font-extrabold tabular-nums", tone === "pos" ? "text-success" : tone === "neg" ? "text-danger" : "text-ink")}>{value}</p>
    </div>
  );
}

function StatusBadge({ s }: { s: string }) {
  const map: Record<string, string> = { win: "border-success text-success", loss: "border-danger text-danger", break_even: "border-ink-mute text-ink-soft" };
  return <span className={cn("rounded border px-2 py-0.5 text-[9px] font-extrabold uppercase", map[s] ?? map.break_even)}>{s === "break_even" ? "BE" : s}</span>;
}

export function PlaybookDetail_({ initial }: { initial: PlaybookDetail }) {
  const tok = () => clientGetToken() ?? undefined;
  const [pb, setPb] = useState(initial);
  const [tab, setTab] = useState("Overview");
  const [ov, setOv] = useState<PlaybookOverview | null>(null);
  const [executed, setExecuted] = useState<ExecutedRow[] | null>(null);
  const [missed, setMissed] = useState<MissedRow[] | null>(null);
  const [notes, setNotes] = useState<PlaybookNote[] | null>(null);
  const [selNote, setSelNote] = useState<string | null>(null);
  const [ruleModal, setRuleModal] = useState<string | null>(null); // group id
  const [ruleName, setRuleName] = useState("");
  const [missedModal, setMissedModal] = useState(false);
  const [mForm, setMForm] = useState({ symbol: "", side: "buy", qty: 1, openDate: new Date().toISOString().slice(0, 10), closeDate: new Date().toISOString().slice(0, 10), entryPrice: 0, exitPrice: 0, status: "win", setups: "" });

  const load = useCallback(async (t: string) => {
    if (t === "Overview" && !ov) setOv(await api.playbooks.overview(pb.id, tok()).catch(() => null));
    if (t === "Executed Trades" && !executed) setExecuted(await api.playbooks.trades(pb.id, tok()).catch(() => []));
    if (t === "Missed Trades" && !missed) setMissed(await api.playbooks.missed(pb.id, tok()).catch(() => []));
    if (t === "Notes" && !notes) { const n = await api.playbooks.notes(pb.id, tok()).catch(() => []); setNotes(n); setSelNote(n[0]?.id ?? null); }
  }, [pb.id, ov, executed, missed, notes]);
  useEffect(() => { load(tab); }, [tab, load]);

  async function refreshDetail() { setPb(await api.playbooks.get(pb.id, tok())); }

  const note = notes?.find((n) => n.id === selNote) ?? null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold text-ink-soft">
          <Link href="/playbook" className="hover:text-primary-600">Playbook</Link> / <span className="text-ink">{pb.name}</span> / <span className="font-bold text-ink">{tab}</span>
        </p>
        <Button variant="outline" size="sm"><Share2 size={12} /> Share</Button>
      </div>

      <div className="flex rounded-card border border-line bg-surface px-2 pt-1 w-fit">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={cn("-mb-px border-b-2 px-3 pb-2 pt-2.5 text-[11px] font-bold", tab === t ? "border-primary-500 text-primary-600" : "border-transparent text-ink-mute hover:text-ink-soft")}>
            {t}
          </button>
        ))}
      </div>

      {tab === "Overview" && ov && (
        <Card>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
            <Kpi label="Net P&L" value={money(ov.kpis.netPnl, { sign: true })} tone={ov.kpis.netPnl >= 0 ? "pos" : "neg"} />
            <Kpi label="Trades" value={String(ov.kpis.trades)} />
            <Kpi label="Win Rate %" value={pct(ov.kpis.winRate)} />
            <Kpi label="Profit Factor" value={ov.kpis.profitFactor.toFixed(2)} />
            <Kpi label="Missed Trades" value={String(ov.kpis.missedTrades)} />
            <Kpi label="Expectancy" value={money(ov.kpis.expectancy)} />
            <Kpi label="Rules Followed" value={ov.kpis.rulesFollowed == null ? "--" : pct(ov.kpis.rulesFollowed)} />
            <Kpi label="Average Winner" value={money(ov.kpis.averageWinner)} tone="pos" />
            <Kpi label="Average Loser" value={money(ov.kpis.averageLoser)} tone="neg" />
            <Kpi label="Largest Profit" value={money(ov.kpis.largestProfit)} tone="pos" />
            <Kpi label="Largest Loss" value={money(ov.kpis.largestLoss)} tone="neg" />
            <Kpi label="Total R Multiple" value={ov.kpis.totalRMultiple == null ? "--" : ov.kpis.totalRMultiple.toFixed(2)} />
          </div>
          <div className="border-t border-line p-4">
            <p className="mb-2 text-xs font-bold">Daily Net Cumulative P&L</p>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={ov.cumulative} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                  <defs><linearGradient id="pbFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#34D399" stopOpacity={0.5} /><stop offset="100%" stopColor="#34D399" stopOpacity={0.03} /></linearGradient></defs>
                  <CartesianGrid vertical={false} stroke="#EEF0F7" />
                  <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#9AA0B4" }} />
                  <YAxis tick={{ fontSize: 9, fill: "#9AA0B4" }} width={64} tickFormatter={(v) => money(Number(v))} />
                  <Tooltip formatter={(v) => [money(Number(v)), "Cumulative"]} contentStyle={{ borderRadius: 8, border: "1px solid #E9EAF3", fontSize: 11 }} />
                  <Area type="monotone" dataKey="value" stroke="#5A49D6" strokeWidth={1.6} fill="url(#pbFill)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </Card>
      )}

      {tab === "Playbook Rules" && (
        <Card className="p-4">
          <div className="mb-3 flex justify-end"><Button variant="outline" size="sm" onClick={async () => { await api.playbooks.addGroup(pb.id, "New Group", tok()); refreshDetail(); }}><Plus size={12} /> Create Group</Button></div>
          <table className="w-full text-left text-[11px]">
            <thead><tr className="bg-primary-50/60 text-[10px] font-bold text-ink-soft">
              <th className="px-3 py-2"></th><th className="px-3 py-2 text-right">Follow Rate</th>
              <th className="px-3 py-2 text-right">Net Profit / Loss</th><th className="px-3 py-2 text-right">Profit Factor</th>
              <th className="px-3 py-2 text-right">Win Rate</th><th className="px-3 py-2"></th>
            </tr></thead>
            <tbody>
              {pb.groups.map((g) => (
                <>
                  <tr key={g.id} className="border-t border-line bg-canvas/40">
                    <td className="px-3 py-2 font-bold" colSpan={5}>{g.name}</td>
                    <td className="px-3 py-2 text-right">
                      <button onClick={async () => { if (confirm(`Delete group "${g.name}" and its rules?`)) { await api.playbooks.removeGroup(g.id, tok()); refreshDetail(); } }} className="text-[10px] font-bold text-danger hover:underline"><Trash2 size={11} className="inline" /> Delete</button>
                    </td>
                  </tr>
                  {g.rules.map((r) => (
                    <tr key={r.id} className="border-t border-line/60">
                      <td className="px-3 py-2 pl-8">{r.name}</td>
                      <td className={cn("px-3 py-2 text-right font-bold tabular-nums", (r.followRate ?? 0) < 100 ? "text-danger" : "text-success")}>{r.followRate == null ? "--" : `${r.followRate.toFixed(0)} %`}</td>
                      <td className={cn("px-3 py-2 text-right font-bold tabular-nums", (r.netPnl ?? 0) >= 0 ? "text-success" : "text-danger")}>{r.netPnl == null ? "--" : money(r.netPnl)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{r.profitFactor == null ? "N/A" : r.profitFactor.toFixed(2)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{r.winRate == null ? "--" : `${r.winRate.toFixed(2)} %`}</td>
                      <td className="px-3 py-2 text-right">
                        <button onClick={async () => { if (confirm(`Delete rule "${r.name}"?`)) { await api.playbooks.removeRule(r.id, tok()); refreshDetail(); } }} className="text-ink-mute hover:text-danger"><Trash2 size={12} /></button>
                      </td>
                    </tr>
                  ))}
                  <tr key={`${g.id}-add`} className="border-t border-line/60">
                    <td colSpan={6} className="px-3 py-2 pl-8">
                      <button onClick={() => { setRuleModal(g.id); setRuleName(""); }} className="flex items-center gap-1 text-[11px] font-bold text-primary-600 hover:underline"><Plus size={12} /> Create new rule</button>
                    </td>
                  </tr>
                </>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {(tab === "Executed Trades" || tab === "Missed Trades") && (
        <Card className="overflow-hidden">
          <div className="flex justify-between p-3">
            <p className="text-xs font-bold">{tab}</p>
            {tab === "Missed Trades" && <Button size="sm" onClick={() => setMissedModal(true)}><Plus size={12} /> Create Missed Trades</Button>}
          </div>
          <table className="w-full text-left text-[11px]">
            <thead><tr className="bg-primary-50/60 text-[10px] font-bold text-ink-soft">
              <th className="px-4 py-2">Open Date</th><th className="px-4 py-2">Symbol</th><th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Close Date</th><th className="px-4 py-2 text-right">Entry Price</th>
              <th className="px-4 py-2 text-right">Exit Price</th><th className="px-4 py-2 text-right">Net P&L</th>
              <th className="px-4 py-2 text-right">Net ROI</th><th className="px-4 py-2">Setups</th>
              {tab === "Executed Trades" && <th className="px-4 py-2">Account Name</th>}
              <th className="px-4 py-2"></th>
            </tr></thead>
            <tbody>
              {tab === "Executed Trades" && (executed ?? []).map((r) => (
                <tr key={r.id} className="border-t border-line hover:bg-canvas/60">
                  <td className="px-4 py-2.5 text-ink-soft">{r.openDate}</td>
                  <td className="px-4 py-2.5"><Link href={`/replay?trade=${r.id}`} className="font-bold hover:text-primary-600">{r.symbol}</Link></td>
                  <td className="px-4 py-2.5"><StatusBadge s={r.status} /></td>
                  <td className="px-4 py-2.5 text-ink-soft">{r.closeDate ?? "--"}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{r.entryPrice == null ? "--" : money(r.entryPrice)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{r.exitPrice == null ? "--" : money(r.exitPrice)}</td>
                  <td className={cn("px-4 py-2.5 text-right font-bold tabular-nums", r.netPnl >= 0 ? "text-success" : "text-danger")}>{money(r.netPnl)}</td>
                  <td className={cn("px-4 py-2.5 text-right tabular-nums", (r.netRoi ?? 0) >= 0 ? "text-success" : "text-danger")}>{r.netRoi == null ? "--" : `${r.netRoi.toFixed(2)}%`}</td>
                  <td className="px-4 py-2.5">{(r.setups ?? "").split(",").filter(Boolean).map((s) => <Badge key={s} tone="primary" className="mr-1">{s.trim()}</Badge>)}</td>
                  <td className="px-4 py-2.5 text-ink-soft">{r.accountName ?? "--"}</td>
                  <td className="px-4 py-2.5 text-right"><button onClick={async () => { await api.trades.setPlaybook(r.id, { playbookId: null, rules: [] }, tok()); setExecuted(null); load("Executed Trades"); }} className="text-ink-mute hover:text-danger"><Trash2 size={12} /></button></td>
                </tr>
              ))}
              {tab === "Missed Trades" && (missed ?? []).map((r) => (
                <tr key={r.id} className="border-t border-line hover:bg-canvas/60">
                  <td className="px-4 py-2.5 text-ink-soft">{r.openDate}</td>
                  <td className="px-4 py-2.5 font-bold">{r.symbol}</td>
                  <td className="px-4 py-2.5"><StatusBadge s={r.status} /></td>
                  <td className="px-4 py-2.5 text-ink-soft">{r.closeDate}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{money(r.entryPrice)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{money(r.exitPrice)}</td>
                  <td className={cn("px-4 py-2.5 text-right font-bold tabular-nums", r.netPnl >= 0 ? "text-success" : "text-danger")}>{money(r.netPnl)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{r.netRoi.toFixed(2)}%</td>
                  <td className="px-4 py-2.5 text-ink-soft">{r.setups ?? "-"}</td>
                  <td className="px-4 py-2.5 text-right"><button onClick={async () => { await api.playbooks.removeMissed(r.id, tok()); setMissed(null); load("Missed Trades"); }} className="text-ink-mute hover:text-danger"><Trash2 size={12} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination page={1} pages={1} total={(tab === "Executed Trades" ? executed : missed)?.length ?? 0}
            from={1} to={(tab === "Executed Trades" ? executed : missed)?.length ?? 0} onPage={() => {}} />
        </Card>
      )}

      {tab === "Notes" && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[240px_1fr]">
          <Card className="p-3">
            <Button variant="outline" size="sm" className="w-full" onClick={async () => {
              const r = await api.playbooks.addNote(pb.id, "New Note", tok());
              const n = await api.playbooks.notes(pb.id, tok());
              setNotes(n); setSelNote(r.id);
            }}><Plus size={12} /> Add Note</Button>
            <div className="mt-3 flex flex-col gap-1">
              {(notes ?? []).map((n) => (
                <button key={n.id} onClick={() => setSelNote(n.id)}
                  className={cn("rounded px-2 py-1.5 text-left text-[11px] font-semibold", selNote === n.id ? "bg-primary-50 text-primary-600" : "text-ink-soft hover:bg-canvas")}>
                  {n.title}
                </button>
              ))}
            </div>
          </Card>
          <Card className="p-4">
            {note ? (
              <>
                <Input className="text-sm font-bold" value={note.title}
                  onChange={(e) => setNotes((ns) => (ns ?? []).map((n) => n.id === note.id ? { ...n, title: e.target.value } : n))}
                  onBlur={(e) => api.playbooks.updateNote(note.id, { title: e.target.value }, tok())} />
                <p className="mt-1 text-[10px] text-ink-mute">Created: {new Date(note.createdAt).toLocaleString()} · Last updated: {new Date(note.updatedAt).toLocaleString()}</p>
                <textarea
                  key={note.id}
                  defaultValue={note.body ?? ""}
                  onBlur={(e) => api.playbooks.updateNote(note.id, { body: e.target.value }, tok())}
                  placeholder="Write your playbook notes… (markdown supported: **bold**, - bullets)"
                  className="mt-3 h-72 w-full resize-none rounded-card border border-line bg-surface p-3 text-xs outline-none focus:border-primary-500"
                />
              </>
            ) : <p className="py-10 text-center text-[11px] text-ink-mute">No note selected.</p>}
          </Card>
        </div>
      )}

      {/* create rule modal */}
      <Dialog open={!!ruleModal} onClose={() => setRuleModal(null)} title="Create new rule"
        footer={<><Button variant="ghost" size="sm" onClick={() => setRuleModal(null)}>Cancel</Button>
          <Button size="sm" disabled={!ruleName.trim()} onClick={async () => {
            if (!ruleModal) return;
            await api.playbooks.addRule(ruleModal, { name: ruleName.trim() }, tok());
            setRuleModal(null); setRuleName(""); refreshDetail();
          }}>Create</Button></>}>
        <Input value={ruleName} onChange={(e) => setRuleName(e.target.value)} placeholder="How do you call this rule?" />
      </Dialog>

      {/* create missed trade modal */}
      <Dialog open={missedModal} onClose={() => setMissedModal(false)} title="Create Missed Trade"
        footer={<><Button variant="ghost" size="sm" onClick={() => setMissedModal(false)}>Cancel</Button>
          <Button size="sm" disabled={!mForm.symbol.trim() || mForm.entryPrice <= 0} onClick={async () => {
            await api.playbooks.addMissed(pb.id, mForm, tok());
            setMissedModal(false); setMissed(null); load("Missed Trades");
          }}>Create</Button></>}>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-[11px] font-semibold">Symbol<Input className="mt-1" value={mForm.symbol} onChange={(e) => setMForm({ ...mForm, symbol: e.target.value.toUpperCase() })} /></label>
          <label className="text-[11px] font-semibold">Side
            <select className="mt-1 h-9 w-full rounded-lg border border-line bg-surface px-2 text-xs" value={mForm.side} onChange={(e) => setMForm({ ...mForm, side: e.target.value })}>
              <option value="buy">Buy</option><option value="sell">Sell</option>
            </select>
          </label>
          <label className="text-[11px] font-semibold">Open date<Input type="date" className="mt-1" value={mForm.openDate} onChange={(e) => setMForm({ ...mForm, openDate: e.target.value })} /></label>
          <label className="text-[11px] font-semibold">Close date<Input type="date" className="mt-1" value={mForm.closeDate} onChange={(e) => setMForm({ ...mForm, closeDate: e.target.value })} /></label>
          <label className="text-[11px] font-semibold">Entry price<Input type="number" step="any" className="mt-1" value={mForm.entryPrice} onChange={(e) => setMForm({ ...mForm, entryPrice: Number(e.target.value) })} /></label>
          <label className="text-[11px] font-semibold">Exit price<Input type="number" step="any" className="mt-1" value={mForm.exitPrice} onChange={(e) => setMForm({ ...mForm, exitPrice: Number(e.target.value) })} /></label>
          <label className="text-[11px] font-semibold">Qty<Input type="number" step="any" className="mt-1" value={mForm.qty} onChange={(e) => setMForm({ ...mForm, qty: Number(e.target.value) })} /></label>
          <label className="text-[11px] font-semibold">Status
            <select className="mt-1 h-9 w-full rounded-lg border border-line bg-surface px-2 text-xs" value={mForm.status} onChange={(e) => setMForm({ ...mForm, status: e.target.value })}>
              <option value="win">Win</option><option value="loss">Loss</option><option value="break_even">Break even</option>
            </select>
          </label>
        </div>
      </Dialog>
    </div>
  );
}