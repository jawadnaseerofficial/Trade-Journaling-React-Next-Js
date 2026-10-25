"use client";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Pencil, Plus, Search, Star, Trash2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { clientGetToken } from "@/lib/auth";
import { NoteEditor, type EditorHandle } from "./note-editor";
import type { NbTemplate } from "@/types";

export function TemplateModal({ templates, onUse, onClose, onChanged }:
  { templates: NbTemplate[]; onUse: (html: string) => void; onClose: () => void; onChanged: () => void }) {
  const tok = () => clientGetToken() ?? undefined;
  const [list, setList] = useState(templates);
  const [q, setQ] = useState("");
  const [selId, setSelId] = useState<string | null>(templates[0]?.id ?? null);
  const [mode, setMode] = useState<"view" | "edit" | "new">("view");
  const [draft, setDraft] = useState<NbTemplate | null>(null);
  const editRef = { current: null as EditorHandle | null };

  useEffect(() => { setList(templates); if (!selId && templates[0]) setSelId(templates[0].id); }, [templates]); // eslint-disable-line
  const sel = list.find((t) => t.id === selId) || null;
  const filtered = useMemo(() => list.filter((t) => t.name.toLowerCase().includes(q.toLowerCase())), [list, q]);
  const favs = filtered.filter((t) => t.favourite);
  const rec = filtered.filter((t) => t.category === "recommended" && !t.favourite);
  const mine = filtered.filter((t) => t.category === "custom");

  function startNew() { setMode("new"); setDraft({ id: "", name: "New template", bodyHtml: "<p></p>", category: "custom", isBuiltin: false, favourite: false }); setSelId(null); }
  function startEdit() { if (!sel) return; setMode("edit"); setDraft({ ...sel }); }
  async function saveDraft() {
    if (!draft) return;
    const html = (document.querySelector(".nt-ed") as HTMLElement | null)?.innerHTML ?? draft.bodyHtml;
    if (mode === "new") { await api.notebook.templateCreate({ name: draft.name, body_html: html, category: "custom" }, tok()); }
    else { await api.notebook.templatePatch(draft.id, { name: draft.name, body_html: html }, tok()); }
    setMode("view"); setDraft(null); onChanged();
  }
  async function toggleFav(t: NbTemplate) { await api.notebook.templatePatch(t.id, { favourite: !t.favourite }, tok()); onChanged(); }
  async function del(t: NbTemplate) { if (!confirm(`Delete template “${t.name}”?`)) return; await api.notebook.templateDelete(t.id, tok()); if (selId === t.id) setSelId(null); onChanged(); }

  const Group = ({ title, items, Icon }: { title: string; items: NbTemplate[]; Icon?: React.ReactNode }) => items.length ? (
    <div className="mb-2">
      <p className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold uppercase text-ink-mute">{Icon}{title}</p>
      {items.map((t) => (
        <button key={t.id} onClick={() => { setSelId(t.id); setMode("view"); setDraft(null); }}
          className={cn("flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-[11px]", selId === t.id && mode !== "new" ? "bg-primary-500 text-white" : "hover:bg-canvas")}>
          <span className="truncate font-semibold">{t.name}{t.isBuiltin && <span className="ml-1 text-[8px] opacity-70">•built-in</span>}</span>
          {t.favourite && <Star size={11} className="fill-current" />}
        </button>
      ))}
    </div>
  ) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4">
      <div className="flex max-h-[88vh] w-full max-w-4xl overflow-hidden rounded-card border border-line bg-surface shadow-card">
        {/* left: list */}
        <div className="flex w-64 shrink-0 flex-col border-r border-line">
          <button onClick={onClose} className="flex items-center gap-1 border-b border-line px-3 py-2.5 text-[11px] font-bold text-ink-soft hover:bg-canvas"><ArrowLeft size={13} /> Close &amp; back to notes</button>
          <div className="p-2">
            <div className="relative"><Search size={12} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-ink-mute" /><Input className="h-8 pl-6 text-[11px]" placeholder="Search templates" value={q} onChange={(e) => setQ(e.target.value)} /></div>
            <Button size="sm" className="mt-2 w-full" onClick={startNew}><Plus size={13} /> Create new template</Button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin px-1 pb-2">
            <Group title="Favourites" items={favs} Icon={<Star size={11} />} />
            <Group title="Recommended" items={rec} />
            <Group title="My templates" items={mine} />
          </div>
        </div>
        {/* right: preview / editor */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
            {mode === "new" || mode === "edit" ? (
              <Input className="h-8 w-64 text-[12px] font-bold" value={draft?.name ?? ""} onChange={(e) => setDraft((d) => d ? { ...d, name: e.target.value } : d)} />
            ) : (
              <p className="flex items-center gap-2 text-sm font-black">{sel?.name}<Pencil size={13} className="cursor-pointer text-ink-mute hover:text-primary-600" onClick={startEdit} /></p>
            )}
            <div className="flex items-center gap-2">
              {sel && mode === "view" && <button onClick={() => toggleFav(sel)} title="Favourite" className={cn("rounded p-1", sel.favourite ? "text-warn" : "text-ink-mute hover:bg-canvas")}><Star size={15} className={sel.favourite ? "fill-current" : ""} /></button>}
              {sel && mode === "view" && <button onClick={() => del(sel)} title="Delete" className="rounded p-1 text-ink-mute hover:bg-danger-soft hover:text-danger"><Trash2 size={15} /></button>}
              {mode === "view" ? (
                <Button size="sm" disabled={!sel} onClick={() => sel && onUse(sel.bodyHtml)}><Check size={13} /> Use template</Button>
              ) : (
                <Button size="sm" onClick={saveDraft}>{mode === "new" ? "Create template" : "Save template"}</Button>
              )}
            </div>
          </div>
          <div className="flex min-h-0 flex-1 flex-col">
            {mode === "view" ? (
              sel ? <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin bg-canvas/40 p-4"><div className="nt-ed prose-sm" dangerouslySetInnerHTML={{ __html: sel.bodyHtml }} /></div>
                   : <p className="p-10 text-center text-[11px] text-ink-mute">Select a template on the left.</p>
            ) : (
              <NoteEditor ref={(r) => { editRef.current = r; }} value={draft?.bodyHtml ?? ""} onChange={(html) => setDraft((d) => d ? { ...d, bodyHtml: html } : d)} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}