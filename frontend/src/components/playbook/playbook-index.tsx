"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Grid2x2, List, MoreHorizontal, Pencil, Share2, Lock, Users, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { cn, money, pct } from "@/lib/utils";
import { api } from "@/lib/api";
import { clientGetToken } from "@/lib/auth";
import type { PlaybookListItem } from "@/types";

const PAGE = 9;
const SORTS = ["Recently created", "Name A-Z", "Name Z-A", "Net P&L", "Trades", "Win Rate"];

export function PlaybookIndex({ initial }: { initial: PlaybookListItem[] }) {
  const tok = () => clientGetToken() ?? undefined;
  const [scope, setScope] = useState<"my" | "shared">("my");
  const [view, setView] = useState<"grid" | "table">("grid");
  const [sort, setSort] = useState(SORTS[0]);
  const [list, setList] = useState(initial);
  const [page, setPage] = useState(1);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [renameFor, setRenameFor] = useState<PlaybookListItem | null>(null);
  const [renameVal, setRenameVal] = useState("");
  const [shareFor, setShareFor] = useState<PlaybookListItem | null>(null);
  const [shareEmail, setShareEmail] = useState("");

  async function reload(sc: string = scope) {
    setList(await api.playbooks.list(sc, tok()));
    setPage(1);
  }
  useEffect(() => { reload(scope); }, [scope]);

  const sorted = useMemo(() => {
    const a = [...list];
    switch (sort) {
      case "Name A-Z": a.sort((x, y) => x.name.localeCompare(y.name)); break;
      case "Name Z-A": a.sort((x, y) => y.name.localeCompare(x.name)); break;
      case "Net P&L": a.sort((x, y) => y.netPnl - x.netPnl); break;
      case "Trades": a.sort((x, y) => y.trades - x.trades); break;
      case "Win Rate": a.sort((x, y) => y.winRate - x.winRate); break;
      default: break;
    }
    return a;
  }, [list, sort]);

  const pages = Math.max(1, Math.ceil(sorted.length / PAGE));
  const slice = sorted.slice((page - 1) * PAGE, page * PAGE);

  async function doDelete(id: string) {
    if (!confirm("Delete this playbook? Trades keep their data but lose the playbook link.")) return;
    await api.playbooks.remove(id, tok());
    setMenuFor(null);
    reload();
  }
  async function doToggleShare(p: PlaybookListItem) {
    await api.playbooks.setVisibility(p.id, p.visibility === "shared" ? "private" : "shared", tok());
    setMenuFor(null);
    reload();
  }
  async function doRename() {
    if (!renameFor || !renameVal.trim()) return;
    await api.playbooks.rename(renameFor.id, { name: renameVal.trim() }, tok());
    setRenameFor(null);
    reload();
  }
  async function doShare() {
    if (!shareFor || !shareEmail.trim()) return;
    try { await api.playbooks.share(shareFor.id, shareEmail.trim(), tok()); }
    catch (e) { alert(e instanceof Error ? e.message : "Share failed"); return; }
    setShareFor(null); setShareEmail("");
    reload();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex rounded-card border border-line bg-surface p-1">
          {(["my", "shared"] as const).map((s) => (
            <button key={s} onClick={() => setScope(s)}
              className={cn("rounded px-3 py-1.5 text-[11px] font-bold", scope === s ? "bg-primary-50 text-primary-600" : "text-ink-mute hover:text-ink-soft")}>
              {s === "my" ? "My Playbook" : "Shared Playbook"}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Select className="h-8 w-40 text-[11px]" value={sort} onChange={(e) => setSort(e.target.value)}>
            {SORTS.map((s) => <option key={s}>{s}</option>)}
          </Select>
          <div className="flex rounded-card border border-line bg-surface p-0.5">
            <button onClick={() => setView("table")} className={cn("grid h-7 w-7 place-items-center rounded", view === "table" ? "bg-primary-50 text-primary-600" : "text-ink-mute")}><List size={13} /></button>
            <button onClick={() => setView("grid")} className={cn("grid h-7 w-7 place-items-center rounded", view === "grid" ? "bg-primary-50 text-primary-600" : "text-ink-mute")}><Grid2x2 size={13} /></button>
          </div>
          <Link href="/playbook/create"><Button size="sm">+ Create Playbook</Button></Link>
        </div>
      </div>

      {slice.length === 0 && (
        <Card className="p-12 text-center text-[11px] text-ink-mute">
          {scope === "my" ? "No playbooks yet. Create your first trading playbook." : "Nothing shared with you yet."}
        </Card>
      )}

      {view === "grid" ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {slice.map((p) => (
            <Card key={p.id} className="relative p-4">
              <div className="flex items-start gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-base" style={{ background: `${p.color}22` }}>
                  {p.icon || <span className="h-4 w-4 rounded" style={{ background: p.color }} />}
                </span>
                <div className="min-w-0 flex-1">
                  <Link href={`/playbook/${p.id}`} className="block truncate text-xs font-bold hover:text-primary-600">{p.name}</Link>
                  <p className="mt-0.5 text-[10px] font-semibold text-primary-600">{p.trades} trade{p.trades === 1 ? "" : "s"}</p>
                </div>
                <div className="relative">
                  <button onClick={() => setMenuFor(menuFor === p.id ? null : p.id)} className="rounded p-1 text-ink-mute hover:bg-canvas"><MoreHorizontal size={14} /></button>
                  {menuFor === p.id && (
                    <div className="absolute right-0 top-7 z-20 w-36 rounded-card border border-line bg-surface py-1 shadow-card">
                      <button onClick={() => { setRenameFor(p); setRenameVal(p.name); setMenuFor(null); }} className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[11px] hover:bg-canvas"><Pencil size={12} /> Rename</button>
                      <button onClick={() => { setShareFor(p); setMenuFor(null); }} className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[11px] hover:bg-canvas"><Share2 size={12} /> Share…</button>
                      <button onClick={() => doToggleShare(p)} className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[11px] hover:bg-canvas">{p.visibility === "shared" ? <><Lock size={12} /> Make private</> : <><Users size={12} /> Make shared</>}</button>
                      <button onClick={() => doDelete(p.id)} className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[11px] text-danger hover:bg-danger-soft"><Trash2 size={12} /> Delete</button>
                    </div>
                  )}
                </div>
              </div>
              {p.description && <p className="mt-2 line-clamp-2 text-[10px] text-ink-soft">{p.description}</p>}
              <div className="mt-3 flex items-center justify-between">
                <span className={cn("text-[11px] font-bold tabular-nums", p.netPnl >= 0 ? "text-success" : "text-danger")}>{money(p.netPnl, { sign: true })}</span>
                <Badge tone={p.visibility === "shared" ? "primary" : "warn"}>
                  {p.visibility === "shared" ? "Shared" : "Private"}
                </Badge>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-left text-[11px]">
            <thead><tr className="bg-primary-50/60 text-[10px] font-bold text-ink-soft">
              <th className="px-4 py-2">Playbook Name</th><th className="px-4 py-2 text-right">Trades</th>
              <th className="px-4 py-2 text-right">Net P&L</th><th className="px-4 py-2 text-right">Win Rate</th>
              <th className="px-4 py-2 text-right">Missed Trades</th><th className="px-4 py-2 text-right">Expectancy</th>
              <th className="px-4 py-2">Shared</th><th className="px-4 py-2"></th>
            </tr></thead>
            <tbody>
              {slice.map((p) => (
                <tr key={p.id} className="border-t border-line hover:bg-canvas/60">
                  <td className="px-4 py-2.5">
                    <Link href={`/playbook/${p.id}`} className="flex items-center gap-2 font-semibold hover:text-primary-600">
                      <span className="grid h-6 w-6 place-items-center rounded" style={{ background: `${p.color}22` }}>
                        {p.icon || <span className="h-3 w-3 rounded" style={{ background: p.color }} />}
                      </span>
                      {p.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{p.trades}</td>
                  <td className={cn("px-4 py-2.5 text-right font-bold tabular-nums", p.netPnl >= 0 ? "text-success" : "text-danger")}>{money(p.netPnl)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{pct(p.winRate)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{p.missedTrades}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{money(p.expectancy)}</td>
                  <td className="px-4 py-2.5">{p.visibility === "shared" ? <Badge tone="primary">Shared</Badge> : <span className="text-ink-mute">-</span>}</td>
                  <td className="px-4 py-2.5 text-right">
                    <button onClick={() => setMenuFor(menuFor === p.id ? null : p.id)} className="rounded p-1 text-ink-mute hover:bg-canvas"><MoreHorizontal size={14} /></button>
                    {menuFor === p.id && (
                      <div className="absolute right-6 z-20 mt-1 w-36 rounded-card border border-line bg-surface py-1 shadow-card">
                        <button onClick={() => { setRenameFor(p); setRenameVal(p.name); setMenuFor(null); }} className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[11px] hover:bg-canvas"><Pencil size={12} /> Rename</button>
                        <button onClick={() => doToggleShare(p)} className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[11px] hover:bg-canvas">{p.visibility === "shared" ? "Make private" : "Make shared"}</button>
                        <button onClick={() => doDelete(p.id)} className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[11px] text-danger hover:bg-danger-soft"><Trash2 size={12} /> Delete</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <Pagination page={page} pages={pages} total={sorted.length}
        from={sorted.length ? (page - 1) * PAGE + 1 : 0} to={Math.min(page * PAGE, sorted.length)} onPage={setPage} />

      <Dialog open={!!renameFor} onClose={() => setRenameFor(null)} title="Rename playbook"
        footer={<><Button variant="ghost" size="sm" onClick={() => setRenameFor(null)}>Cancel</Button><Button size="sm" onClick={doRename}>Save</Button></>}>
        <Input value={renameVal} onChange={(e) => setRenameVal(e.target.value)} placeholder="Playbook name" />
      </Dialog>

      <Dialog open={!!shareFor} onClose={() => setShareFor(null)} title={`Share "${shareFor?.name ?? ""}"`}
        footer={<><Button variant="ghost" size="sm" onClick={() => setShareFor(null)}>Cancel</Button><Button size="sm" onClick={doShare}>Share</Button></>}>
        <p className="mb-2 text-[11px] text-ink-soft">Share with a user inside your workspace (same tenant). They'll see it under "Shared Playbook".</p>
        <Input type="email" value={shareEmail} onChange={(e) => setShareEmail(e.target.value)} placeholder="teammate@email.com" />
      </Dialog>
    </div>
  );
}