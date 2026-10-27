"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Area, AreaChart, ResponsiveContainer, YAxis } from "recharts";
import { Calendar, ChevronDown, ChevronRight, Clock, Download, FileText, Filter, MoreHorizontal, Plus, Search, Share2, Star, Trash2, Undo2, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, money } from "@/lib/utils";
import { api } from "@/lib/api";
import { clientGetToken } from "@/lib/auth";
import { useDataRefresh } from "@/lib/data-refresh";
import { NoteEditor, type EditorHandle } from "./note-editor";
import { TemplateModal } from "./template-modal";
import type { NbDetail, NbFolder, NbListItem, NbTag, NbTemplate, NbTree } from "@/types";

const SYS_COLORS: Record<string, string> = { trade: "#6D5DE7", daily: "#12B981", recap: "#F5A524", backtest: "#0EA5E9" };

export function NotebookView({ initialTree, initialNotes }: { initialTree: NbTree; initialNotes: NbListItem[] }) {
  const router = useRouter();
  const tok = () => clientGetToken() ?? undefined;
  const [tree, setTree] = useState(initialTree);
  const [folder, setFolder] = useState<string>(initialTree.folders.find((f) => f.linkType === "trade")?.id || "trade");
  const [folderKey, setFolderKey] = useState<string>("trade"); // system link_type or folder id or 'all'/'deleted'
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [notes, setNotes] = useState<NbListItem[]>(initialNotes);
  const [selId, setSelId] = useState<string | null>(initialNotes[0]?.id ?? null);
  const [detail, setDetail] = useState<NbDetail | null>(null);
  const [q, setQ] = useState(""); const [tag, setTag] = useState<string | null>(null);
  const [templates, setTemplates] = useState<NbTemplate[]>([]);
  const [tplOpen, setTplOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [menu, setMenu] = useState(false);
  const [newFolder, setNewFolder] = useState(false); const [nfName, setNfName] = useState(""); const [nfColor, setNfColor] = useState("#6D5DE7");
  const [renaming, setRenaming] = useState(false); const [titleDraft, setTitleDraft] = useState("");
  const [tagDraft, setTagDraft] = useState(""); const [savedAt, setSavedAt] = useState<string | null>(null);
  const edRef = useRef<EditorHandle>(null);
  const loadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reloadTree = useCallback(async () => setTree(await api.notebook.tree(tok()).catch(() => initialTree)), [initialTree, tok]);
  const reloadTemplates = useCallback(async () => setTemplates(await api.notebook.templates(tok()).catch(() => [])), [tok]);
  useDataRefresh(() => setRefreshNonce((n) => n + 1));
  useEffect(() => { void reloadTree(); }, [refreshNonce, reloadTree]);
  useEffect(() => { void reloadTemplates(); }, [reloadTemplates, refreshNonce]);

  // load note list when folder/search/tag changes (debounced search)
  const loadNotes = useCallback(async (fk: string, qq?: string, tt?: string | null) => {
    setNotes(await api.notebook.notes(fk, qq || undefined, tt || undefined, tok()).catch(() => []));
  }, [tok]);
  useEffect(() => { if (loadTimer.current) clearTimeout(loadTimer.current); loadTimer.current = setTimeout(() => { void loadNotes(folderKey, q, tag); }, q ? 250 : 0); return () => { if (loadTimer.current) clearTimeout(loadTimer.current); }; }, [folderKey, q, tag, loadNotes, refreshNonce]);

  // load detail when selection changes
  useEffect(() => { if (!selId) { setDetail(null); return; } let alive = true; api.notebook.note(selId, tok()).then((d) => { if (alive) { setDetail(d); setTitleDraft(d.title); setRenaming(false); } }).catch(() => {}); setMenu(false); return () => { alive = false; }; }, [selId]);

  function pickFolder(f: NbFolder | { key: string; name: string }) {
    const key = "linkType" in f && f.linkType ? f.linkType : ("id" in f ? f.id : (f as { key: string }).key);
    setFolderKey(key); setFolder("id" in f ? f.id : key); setSelId(null); setTag(null);
  }
  function toggleCollapse(id: string) { setCollapsed((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; }); }

  async function newNote() { const r = await api.notebook.create({ folderId: folder || null, title: "Untitled" }, tok()); setFolderKey(folder || "all"); await loadNotes(folder || "all"); setSelId(r.id); reloadTree(); }
  async function saveTitle() { if (!detail) return; await api.notebook.patch(detail.id, { title: titleDraft }, tok()); setDetail({ ...detail, title: titleDraft }); setRenaming(false); }
  const onBody = useCallback((html: string) => { if (!detail) return; api.notebook.patch(detail.id, { bodyHtml: html }, tok()).then((r) => setSavedAt(r.updatedAt)).catch(() => {}); }, [detail]);

  async function addTag() { if (!detail || !tagDraft.trim()) return; const next = Array.from(new Set([...detail.tags, tagDraft.trim()])); await api.notebook.setTags(detail.id, next, tok()); setDetail({ ...detail, tags: next }); setTagDraft(""); reloadTree(); }
  async function rmTag(name: string) { if (!detail) return; const next = detail.tags.filter((t) => t !== name); await api.notebook.setTags(detail.id, next, tok()); setDetail({ ...detail, tags: next }); reloadTree(); }

  async function toggleStar() { if (!detail) return; await api.notebook.patch(detail.id, { starred: !detail.starred }, tok()); setDetail({ ...detail, starred: !detail.starred }); }
  async function doShare() { if (!detail) return; const r = await api.notebook.share(detail.id, tok()); setMenu(false); if (r.url) { await navigator.clipboard?.writeText(`${window.location.origin}${r.url}`).catch(() => {}); alert("Share link copied:\n" + `${window.location.origin}${r.url}`); } }
  function doPrint() { if (!detail) return; setMenu(false); const w = window.open(api.notebook.exportUrl(detail.id), "_blank", "width=900,height=700"); w?.addEventListener("load", () => setTimeout(() => w.print(), 300)); }
  async function doDelete() { if (!detail) return; setMenu(false); await api.notebook.del(detail.id, tok()); const rest = notes.filter((n) => n.id !== detail.id); setNotes(rest); setSelId(rest[0]?.id ?? null); reloadTree(); }
  async function doRestore() { if (!detail) return; setMenu(false); await api.notebook.restore(detail.id, tok()); const rest = notes.filter((n) => n.id !== detail.id); setNotes(rest); setSelId(rest[0]?.id ?? null); reloadTree(); }
  async function doPurge() { if (!detail || !confirm("Permanently delete this note? This cannot be undone.")) return; setMenu(false); await api.notebook.purge(detail.id, tok()); const rest = notes.filter((n) => n.id !== detail.id); setNotes(rest); setSelId(rest[0]?.id ?? null); reloadTree(); }

  async function createFolder() { if (!nfName.trim()) return; await api.notebook.folderCreate({ name: nfName.trim(), color: nfColor }, tok()); setNewFolder(false); setNfName(""); await reloadTree(); }
  async function deleteFolder(f: NbFolder) { if (!confirm(`Delete folder “${f.name}”? Notes move to All notes.`)) return; await api.notebook.folderDelete(f.id, tok()); if (folderKey === f.id) { setFolderKey("all"); } await reloadTree(); }

  const systemFolders = tree.folders.filter((f) => f.kind === "system");
  const customFolders = tree.folders.filter((f) => f.kind === "custom");
  const recent = useMemo(() => templates.slice(0, 3), [templates]);

  return (
    <div className="flex h-[calc(100vh-3.5rem)] gap-0 overflow-hidden">
      {/* LEFT: folders + tags + recently deleted */}
      <aside className="flex w-60 shrink-0 flex-col border-r border-line bg-surface">
        <div className="flex items-center justify-between px-3 py-2.5">
          <p className="text-[11px] font-black uppercase tracking-wide text-ink-soft">Folders</p>
          <button onClick={() => setNewFolder((v) => !v)} title="Add folder" className="rounded p-1 text-ink-mute hover:bg-canvas hover:text-primary-600"><Plus size={14} /></button>
        </div>
        {newFolder && (
          <div className="mx-2 mb-2 rounded-lg border border-line p-2">
            <Input className="h-7 text-[11px]" placeholder="Folder name" value={nfName} onChange={(e) => setNfName(e.target.value)} />
            <div className="mt-1 flex items-center gap-1">
              {["#6D5DE7", "#12B981", "#E5484D", "#F5A524", "#0EA5E9", "#EC4899"].map((c) => <button key={c} onClick={() => setNfColor(c)} className={cn("h-4 w-4 rounded", nfColor === c && "ring-2 ring-offset-1 ring-primary-500")} style={{ background: c }} />)}
              <Button size="sm" className="ml-auto h-6 text-[10px]" onClick={createFolder}>Add</Button>
            </div>
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin px-2 pb-2">
          <button onClick={() => { setFolderKey("all"); setSelId(null); }} className={cn("flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-[11px] font-semibold", folderKey === "all" ? "bg-primary-50 text-primary-600" : "hover:bg-canvas")}>
            <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: "#9AA0B4" }} />All notes</span><span className="text-[9px] text-ink-mute">{tree.allCount}</span>
          </button>
          {systemFolders.map((f) => (
            <button key={f.id} onClick={() => pickFolder(f)} className={cn("flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-[11px] font-semibold", folderKey === f.linkType ? "bg-primary-50 text-primary-600" : "hover:bg-canvas")}>
              <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: SYS_COLORS[f.linkType || ""] || f.color || "#9AA0B4" }} />{f.name}</span><span className="text-[9px] text-ink-mute">{f.count}</span>
            </button>
          ))}
          {customFolders.length > 0 && <p className="mt-2 px-2 text-[9px] font-bold uppercase text-ink-mute">Custom</p>}
          {customFolders.map((f) => (
            <div key={f.id} className={cn("group flex items-center justify-between rounded-lg px-2 py-1.5 text-[11px] font-semibold", folderKey === f.id ? "bg-primary-50 text-primary-600" : "hover:bg-canvas")}>
              <button onClick={() => pickFolder(f)} className="flex flex-1 items-center gap-2 text-left"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: f.color || "#9AA0B4" }} />{f.name}</button>
              <span className="flex items-center gap-1"><span className="text-[9px] text-ink-mute">{f.count}</span><button onClick={() => deleteFolder(f)} className="opacity-0 group-hover:opacity-100 text-ink-mute hover:text-danger"><Trash2 size={11} /></button></span>
            </div>
          ))}
          <p className="mt-3 px-2 text-[9px] font-bold uppercase text-ink-mute">Tags</p>
          {tree.tags.length === 0 && <p className="px-2 text-[10px] text-ink-mute">No tags yet — add one on a note.</p>}
          {tree.tags.map((t) => (
            <button key={t.id} onClick={() => { setTag(tag === t.name ? null : t.name); setFolderKey("all"); }} className={cn("flex w-full items-center justify-between rounded-lg px-2 py-1 text-left text-[11px]", tag === t.name ? "bg-primary-500 text-white" : "hover:bg-canvas")}>
              <span className="truncate">{t.name}</span><span className={cn("rounded px-1 text-[9px]", tag === t.name ? "bg-white/20" : "bg-canvas text-ink-mute")}>{t.count}</span>
            </button>
          ))}
          <button onClick={() => { setFolderKey("deleted"); setSelId(null); }} className={cn("mt-3 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[11px] font-semibold", folderKey === "deleted" ? "bg-danger-soft text-danger-deep" : "text-ink-mute hover:bg-canvas")}>
            <Trash2 size={12} /> Recently deleted <span className="ml-auto text-[9px]">{tree.deletedCount}</span>
          </button>
        </div>
      </aside>

      {/* MIDDLE: note list */}
      <section className="flex w-72 shrink-0 flex-col border-r border-line bg-canvas/40">
        <div className="relative border-b border-line px-3 py-2">
          <Search size={12} className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-ink-mute" />
          <Input className="h-8 pl-6 text-[11px]" placeholder="Search notes" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="flex items-center justify-between px-3 py-1.5 text-[10px]">
          <button onClick={newNote} className="flex items-center gap-1 font-bold text-primary-600 hover:underline"><Plus size={12} /> New note</button>
          {tag && <button onClick={() => setTag(null)} className="flex items-center gap-1 text-ink-mute hover:text-ink"><Filter size={11} /> tag: {tag} ✕</button>}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">
          {notes.length === 0 && <p className="p-6 text-center text-[11px] text-ink-mute">No notes here yet.</p>}
          {notes.map((n) => (
            <button key={n.id} onClick={() => setSelId(n.id)} className={cn("flex w-full flex-col gap-0.5 border-b border-line/60 px-3 py-2 text-left", selId === n.id ? "bg-primary-50" : "hover:bg-surface")}>
              <span className="flex items-center gap-1 text-[11px] font-bold"><Star size={10} className={n.starred ? "fill-warn text-warn" : "hidden"} />{n.title}</span>
              {n.netPnl != null && <span className={cn("text-[10px] font-bold tabular-nums", n.netPnl >= 0 ? "text-success" : "text-danger")}>NET P&amp;L: {money(n.netPnl, { sign: true })}</span>}
              <span className="flex items-center gap-2 text-[9px] text-ink-mute"><Clock size={9} />{n.updatedAt}{n.shares > 0 && <span className="flex items-center gap-0.5"><Users size={9} />{n.shares}</span>}</span>
            </button>
          ))}
        </div>
      </section>

      {/* RIGHT: detail */}
      <section className="flex min-w-0 flex-1 flex-col bg-surface">
        {!detail ? (
          <div className="grid flex-1 place-items-center text-[12px] text-ink-mute">Select a note to view &amp; journal.</div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3 border-b border-line px-4 py-2.5">
              <div className="flex min-w-0 items-center gap-2">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded bg-canvas text-ink-mute">{detail.linkType === "daily" || detail.linkType === "recap" ? <Calendar size={13} /> : <FileText size={13} />}</span>
                {renaming ? <Input className="h-7 text-[13px] font-black" value={titleDraft} onChange={(e) => setTitleDraft(e.target.value)} onBlur={saveTitle} onKeyDown={(e) => e.key === "Enter" && saveTitle()} autoFocus />
                         : <button onClick={() => !detail.readonly && setRenaming(true)} className="truncate text-[15px] font-black hover:text-primary-600">{detail.title}</button>}
              </div>
              <div className="flex items-center gap-1">
                <button onClick={toggleStar} title="Star" className={cn("rounded p-1.5", detail.starred ? "text-warn" : "text-ink-mute hover:bg-canvas")}><Star size={15} className={detail.starred ? "fill-current" : ""} /></button>
                <div className="relative">
                  <button onClick={() => setMenu((v) => !v)} className="rounded p-1.5 text-ink-mute hover:bg-canvas"><MoreHorizontal size={16} /></button>
                  {menu && (
                    <div className="absolute right-0 top-9 z-30 w-48 rounded-card border border-line bg-surface py-1 shadow-card">
                      <button onClick={doShare} className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[11px] hover:bg-canvas"><Share2 size={12} /> {detail.shareToken ? "Revoke share link" : "Copy share link"}</button>
                      <button onClick={doPrint} className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[11px] hover:bg-canvas"><Download size={12} /> Download / Print PDF</button>
                      {folderKey === "deleted" ? (
                        <><button onClick={doRestore} className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[11px] hover:bg-canvas"><Undo2 size={12} /> Restore</button>
                          <button onClick={doPurge} className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[11px] text-danger hover:bg-danger-soft"><Trash2 size={12} /> Delete forever</button></>
                      ) : (
                        <button onClick={doDelete} className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[11px] text-danger hover:bg-danger-soft"><Trash2 size={12} /> Move to trash</button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
            <p className="px-4 pt-1 text-[9px] text-ink-mute">Created: {detail.createdAt} · Last updated: {savedAt || detail.updatedAt}{detail.readonly && " · read-only (from Backtester)"}</p>

            {/* auto-linked stats strip (computed live from YOUR trades) */}
            <div className="mx-4 mt-2 rounded-card border border-line bg-canvas/40 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[9px] font-bold uppercase text-ink-mute">Net P&amp;L</p>
                  <p className={cn("text-xl font-black tabular-nums", (detail.headlinePnl ?? 0) >= 0 ? "text-success" : "text-danger")}>{detail.headlinePnl != null ? money(detail.headlinePnl, { sign: true }) : "--"}</p>
                </div>
                {detail.tradeIds.length > 0 && (
                  <Button size="sm" onClick={() => router.push(`/replay?trade=${detail.tradeIds[0]}`)}>View trade details</Button>
                )}
              </div>
              {detail.stats.length > 0 && (
                <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3 lg:grid-cols-5">
                  {detail.stats.map((s, i) => (
                    <div key={i} className="flex flex-col"><span className="text-[8px] font-bold uppercase text-ink-mute">{s.label}</span><span className={cn("text-[11px] font-bold tabular-nums", s.tone === "pos" ? "text-success" : s.tone === "neg" ? "text-danger" : "")}>{s.value}</span></div>
                  ))}
                </div>
              )}
              {detail.chart.length > 0 && (
                <div className="mt-2 h-16">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={detail.chart} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
                      <defs><linearGradient id="nbEq" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#12B981" stopOpacity={0.4} /><stop offset="100%" stopColor="#12B981" stopOpacity={0.02} /></linearGradient></defs>
                      <YAxis hide domain={["dataMin", "dataMax"]} />
                      <Area type="monotone" dataKey="value" stroke="#0E9F6E" strokeWidth={1.4} fill="url(#nbEq)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* recently used templates + add template */}
            <div className="flex flex-wrap items-center gap-1 px-4 pt-2 text-[10px]">
              <span className="font-semibold text-ink-mute">Recently used templates:</span>
              {recent.map((t) => <button key={t.id} onClick={() => edRef.current?.insertHtml(t.bodyHtml)} className="rounded border border-line px-2 py-0.5 font-bold text-ink-soft hover:border-primary-500 hover:text-primary-600">{t.name}</button>)}
              <button onClick={() => setTplOpen(true)} className="flex items-center gap-1 rounded border border-dashed border-line px-2 py-0.5 font-bold text-primary-600 hover:bg-primary-50"><Plus size={11} /> Add Template</button>
            </div>

            {/* tags */}
            <div className="flex flex-wrap items-center gap-1 px-4 pt-2 text-[10px]">
              <span className="font-semibold text-ink-mute">Tags:</span>
              {detail.tags.map((t) => <span key={t} className="flex items-center gap-1 rounded-full bg-primary-50 px-2 py-0.5 font-bold text-primary-600">{t}{!detail.readonly && <button onClick={() => rmTag(t)} className="hover:text-danger">✕</button>}</span>)}
              {!detail.readonly && <input value={tagDraft} onChange={(e) => setTagDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addTag()} onBlur={addTag} placeholder="+ Add tag" className="w-24 rounded border border-line bg-surface px-2 py-0.5 text-[10px] outline-none focus:border-primary-500" />}
            </div>

            <NoteEditor ref={edRef} key={detail.id} value={detail.bodyHtml} readonly={detail.readonly} onChange={onBody} />
          </>
        )}
      </section>

      {tplOpen && <TemplateModal templates={templates} onClose={() => setTplOpen(false)} onChanged={reloadTemplates} onUse={(html) => { setTplOpen(false); edRef.current?.insertHtml(html); }} />}
    </div>
  );
}