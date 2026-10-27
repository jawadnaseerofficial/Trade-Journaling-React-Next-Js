"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Grid2x2, List, MoreHorizontal, Pencil, Play, Lock, Users, Trash2, ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn, money, pct } from "@/lib/utils";
import { api } from "@/lib/api";
import { clientGetToken } from "@/lib/auth";
import { useDataRefresh } from "@/lib/data-refresh";
import type { BtSessionListItem, BtShare } from "@/types";

const SORTS = ["Recently created", "Name A-Z", "Realised P&L", "Win %", "Trade count"];

export function SessionsView({ initial }: { initial: BtSessionListItem[] }) {
  const router = useRouter();
  const tok = () => clientGetToken() ?? undefined;
  const [scope, setScope] = useState<"my" | "shared">("my");
  const [view, setView] = useState<"grid" | "table">("grid");
  const [sort, setSort] = useState(SORTS[0]);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [list, setList] = useState(initial);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [renameFor, setRenameFor] = useState<BtSessionListItem | null>(null);
  const [renameVal, setRenameVal] = useState("");
  const [shareFor, setShareFor] = useState<BtSessionListItem | null>(null);
  const [shareEmail, setShareEmail] = useState("");
  const [shareList, setShareList] = useState<BtShare[]>([]);
  const [shareBusy, setShareBusy] = useState(false);
  const [shareErr, setShareErr] = useState<string | null>(null);

  async function reload(sc: string = scope) { setList(await api.backtests.list(sc, tok()).catch(() => [])); }
  useDataRefresh(() => setRefreshNonce((n) => n + 1));
  useEffect(() => { reload(scope); }, [scope, refreshNonce]);

  async function openShare(s: BtSessionListItem) {
    setShareFor(s); setShareEmail(""); setShareErr(null); setMenuFor(null);
    setShareList(await api.backtests.shares(s.id, tok()).catch(() => []));
  }
  async function doShare() {
    if (!shareFor || !shareEmail.trim()) return;
    setShareBusy(true); setShareErr(null);
    try {
      await api.backtests.share(shareFor.id, shareEmail.trim(), tok());
      setShareList(await api.backtests.shares(shareFor.id, tok()).catch(() => []));
      setShareEmail(""); reload();
    } catch (e) { setShareErr(e instanceof Error ? e.message : "Share failed"); }
    finally { setShareBusy(false); }
  }
  async function doUnshare(uid: string) {
    if (!shareFor) return;
    await api.backtests.unshare(shareFor.id, uid, tok()).catch(() => {});
    setShareList((l) => l.filter((x) => x.userId !== uid)); reload();
  }

  const sorted = useMemo(() => {
    const a = [...list];
    if (sort === "Name A-Z") a.sort((x, y) => x.name.localeCompare(y.name));
    else if (sort === "Realised P&L") a.sort((x, y) => y.realizedPnl - x.realizedPnl);
    else if (sort === "Win %") a.sort((x, y) => y.winRate - x.winRate);
    else if (sort === "Trade count") a.sort((x, y) => y.tradeCount - x.tradeCount);
    return a;
  }, [list, sort]);

  async function doDelete(id: string) { if (!confirm("Delete this backtest session and its order history?")) return; await api.backtests.remove(id, tok()); setMenuFor(null); reload(); }
  async function doToggleShare(s: BtSessionListItem) { await api.backtests.setVisibility(s.id, s.visibility === "shared" ? "private" : "shared", tok()); setMenuFor(null); reload(); }
  async function doRename() { if (!renameFor || !renameVal.trim()) return; await api.backtests.rename(renameFor.id, { name: renameVal.trim() }, tok()); setRenameFor(null); reload(); }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex rounded-card border border-line bg-surface p-1">
          {(["my", "shared"] as const).map((s) => (
            <button key={s} onClick={() => setScope(s)} className={cn("rounded px-3 py-1.5 text-[11px] font-bold", scope === s ? "bg-primary-50 text-primary-600" : "text-ink-mute hover:text-ink-soft")}>{s === "my" ? "My sessions" : "Shared sessions"}</button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Select className="h-8 w-40 text-[11px]" value={sort} onChange={(e) => setSort(e.target.value)}>{SORTS.map((s) => <option key={s}>{s}</option>)}</Select>
          <div className="flex rounded-card border border-line bg-surface p-0.5">
            <button onClick={() => setView("table")} className={cn("grid h-7 w-7 place-items-center rounded", view === "table" ? "bg-primary-50 text-primary-600" : "text-ink-mute")}><List size={13} /></button>
            <button onClick={() => setView("grid")} className={cn("grid h-7 w-7 place-items-center rounded", view === "grid" ? "bg-primary-50 text-primary-600" : "text-ink-mute")}><Grid2x2 size={13} /></button>
          </div>
          <Link href="/backtesting/new"><Button size="sm">+ Create session</Button></Link>
        </div>
      </div>

      {sorted.length === 0 && <Card className="p-12 text-center text-[11px] text-ink-mute">{scope === "shared" ? "Nothing shared with you yet." : "No backtest sessions yet. Create one to go back in time and test a strategy."}</Card>}

      {view === "grid" ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {sorted.map((s) => (
            <Card key={s.id} className="relative p-4">
              <div className="flex items-start justify-between">
                <Link href={`/backtesting/${s.id}`} className="flex items-center gap-2 text-xs font-bold hover:text-primary-600"><span className="grid h-6 w-6 place-items-center rounded-full bg-primary-50 text-primary-600"><Play size={12} /></span>{s.name}</Link>
                <div className="relative">
                  <button onClick={() => setMenuFor(menuFor === s.id ? null : s.id)} className="rounded p-1 text-ink-mute hover:bg-canvas"><MoreHorizontal size={14} /></button>
                  {menuFor === s.id && (
                    <div className="absolute right-0 top-7 z-20 w-44 rounded-card border border-line bg-surface py-1 shadow-card">
                      <button onClick={() => { setRenameFor(s); setRenameVal(s.name); setMenuFor(null); }} className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[11px] hover:bg-canvas"><Pencil size={12} /> Rename</button>
                      <button onClick={() => openShare(s)} className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[11px] hover:bg-canvas"><Users size={12} /> Share with teammate</button>
                      <button onClick={() => doToggleShare(s)} className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[11px] hover:bg-canvas">{s.visibility === "shared" ? <><Lock size={12} /> Make private</> : <><Users size={12} /> Make shared (workspace)</>}</button>
                      <button onClick={() => doDelete(s.id)} className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[11px] text-danger hover:bg-danger-soft"><Trash2 size={12} /> Delete</button>
                    </div>
                  )}
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-[10px] font-bold text-primary-600">{s.symbol}</span>
                <Badge tone={s.visibility === "shared" ? "primary" : "warn"}>{s.visibility === "shared" ? "Shared" : "Private"}</Badge>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-[10px]">
                <div><p className="text-ink-mute">Start balance</p><p className="font-bold tabular-nums">{money(s.startBalance)}</p></div>
                <div className="text-right"><p className="text-ink-mute">Current balance</p><p className={cn("font-bold tabular-nums", s.currentBalance >= s.startBalance ? "text-success" : "text-danger")}>{money(s.currentBalance)}</p></div>
              </div>
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-canvas"><div className="h-full bg-primary-500" style={{ width: `${s.completionPct}%` }} /></div>
              <div className="mt-1 flex justify-between text-[9px] text-ink-mute"><span>{s.startDate}</span><span>{s.endDate}</span></div>
              <div className="mt-3 grid grid-cols-3 gap-2 border-t border-line pt-2 text-center">
                <div><p className="text-[9px] text-ink-mute">Win %</p><p className="text-[11px] font-bold tabular-nums">{pct(s.winRate)}</p></div>
                <div><p className="text-[9px] text-ink-mute">Realised P&L</p><p className={cn("text-[11px] font-bold tabular-nums", s.realizedPnl >= 0 ? "text-success" : "text-danger")}>{money(s.realizedPnl, { sign: true })}</p></div>
                <div><p className="text-[9px] text-ink-mute">Trade count</p><p className="text-[11px] font-bold tabular-nums">{s.tradeCount}</p></div>
              </div>
              {s.description && <p className="mt-2 line-clamp-2 text-[10px] text-ink-soft">{s.description}</p>}
              <Link href={`/backtesting/${s.id}`} className="mt-3 flex items-center justify-end gap-1 text-[10px] font-bold text-primary-600 hover:underline">Continue session <ArrowRight size={11} /></Link>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-left text-[11px]">
            <thead><tr className="bg-primary-50/60 text-[10px] font-bold text-ink-soft">
              <th className="px-4 py-2">Session</th><th className="px-4 py-2">Symbol</th><th className="px-4 py-2 text-right">Start bal.</th>
              <th className="px-4 py-2 text-right">Current bal.</th><th className="px-4 py-2 text-right">Realised P&L</th>
              <th className="px-4 py-2 text-right">Win %</th><th className="px-4 py-2 text-right">Trades</th><th className="px-4 py-2">Visibility</th><th className="px-4 py-2"></th>
            </tr></thead>
            <tbody>
              {sorted.map((s) => (
                <tr key={s.id} className="border-t border-line hover:bg-canvas/60">
                  <td className="px-4 py-2.5"><Link href={`/backtesting/${s.id}`} className="font-bold hover:text-primary-600">{s.name}</Link></td>
                  <td className="px-4 py-2.5 text-primary-600">{s.symbol}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{money(s.startBalance)}</td>
                  <td className={cn("px-4 py-2.5 text-right font-bold tabular-nums", s.currentBalance >= s.startBalance ? "text-success" : "text-danger")}>{money(s.currentBalance)}</td>
                  <td className={cn("px-4 py-2.5 text-right font-bold tabular-nums", s.realizedPnl >= 0 ? "text-success" : "text-danger")}>{money(s.realizedPnl, { sign: true })}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{pct(s.winRate)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{s.tradeCount}</td>
                  <td className="px-4 py-2.5">{s.visibility === "shared" ? <Badge tone="primary">Shared</Badge> : <span className="text-ink-mute">Private</span>}</td>
                  <td className="px-4 py-2.5 text-right"><button onClick={() => openShare(s)} className="mr-2 text-ink-mute hover:text-primary-600" title="Share"><Users size={13} /></button><Link href={`/backtesting/${s.id}`} className="text-[10px] font-bold text-primary-600 hover:underline">Open</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <Dialog open={!!renameFor} onClose={() => setRenameFor(null)} title="Rename session"
        footer={<><Button variant="ghost" size="sm" onClick={() => setRenameFor(null)}>Cancel</Button><Button size="sm" onClick={doRename}>Save</Button></>}>
        <Input value={renameVal} onChange={(e) => setRenameVal(e.target.value)} placeholder="Session name" />
      </Dialog>

      <Dialog open={!!shareFor} onClose={() => setShareFor(null)} title={`Share “${shareFor?.name ?? ""}”`}
        footer={<><Button variant="ghost" size="sm" onClick={() => setShareFor(null)}>Close</Button>
          <Button size="sm" disabled={shareBusy || !shareEmail.trim()} onClick={doShare}>{shareBusy ? "Sharing…" : "Grant access"}</Button></>}>
        <p className="text-[11px] text-ink-soft">Grant a teammate in your workspace access to this session. They’ll see it under <b>Shared sessions</b>, even if it’s private.</p>
        <div className="mt-3 flex gap-2">
          <Input value={shareEmail} onChange={(e) => setShareEmail(e.target.value)} placeholder="teammate@email.com" />
        </div>
        {shareErr && <p className="mt-2 text-[11px] font-semibold text-danger">{shareErr}</p>}
        <div className="mt-4">
          <p className="text-[10px] font-bold uppercase text-ink-mute">Currently shared with</p>
          <div className="mt-1 flex flex-col gap-1">
            {shareList.length === 0 && <p className="text-[11px] text-ink-mute">Nobody yet.</p>}
            {shareList.map((sh) => (
              <div key={sh.id} className="flex items-center justify-between rounded-lg border border-line px-3 py-1.5 text-[11px]">
                <span className="font-semibold">{sh.name} <span className="text-ink-mute">· {sh.email}</span></span>
                <button onClick={() => doUnshare(sh.userId)} className="text-ink-mute hover:text-danger" title="Revoke"><Trash2 size={13} /></button>
              </div>
            ))}
          </div>
        </div>
      </Dialog>
    </div>
  );
}