"use client";
import { useState } from "react";
import { Bold, Code, Image as ImageIcon, Italic, Link2, List, ListOrdered, Redo2, Undo2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function NoteEditor({ initial, onSave }: { initial: string | null; onSave: (v: string | null) => void }) {
  const [text, setText] = useState(initial ?? "");
  const [dirty, setDirty] = useState(false);
  const [hist, setHist] = useState<string[]>([]);
  const [redo, setRedo] = useState<string[]>([]);

  function push(prev: string) { setHist((h) => [...h.slice(-30), prev]); setRedo([]); }
  function wrap(tok: string) { const p = text; push(p); setText(`${p}**${tok}**`); setDirty(true); }
  function prefix(pfx: string) { const p = text; push(p); setText(p ? `${p}\n${pfx}` : pfx); setDirty(true); }
  function undo() { if (!hist.length) return; setRedo((r) => [text, ...r]); setText(hist.at(-1)!); setHist((h) => h.slice(0, -1)); setDirty(true); }
  function redoFn() { if (!redo.length) return; push(text); setText(redo[0]); setRedo((r) => r.slice(1)); setDirty(true); }

  const Tool = ({ onClick, children, label }: { onClick: () => void; children: React.ReactNode; label: string }) => (
    <button type="button" onClick={onClick} aria-label={label} className="rounded p-1.5 text-ink-soft hover:bg-canvas hover:text-primary-600">{children}</button>
  );

  return (
    <div className="rounded-card border border-line bg-surface">
      <div className="flex flex-wrap items-center gap-0.5 border-b border-line px-2 py-1.5">
        <Tool label="Bold" onClick={() => wrap("bold")}><Bold size={14} /></Tool>
        <Tool label="Italic" onClick={() => wrap("italic")}><Italic size={14} /></Tool>
        <Tool label="Bullet list" onClick={() => prefix("- ")}><List size={14} /></Tool>
        <Tool label="Numbered list" onClick={() => prefix("1. ")}><ListOrdered size={14} /></Tool>
        <Tool label="Link" onClick={() => wrap("[link](url)")}><Link2 size={14} /></Tool>
        <Tool label="Image" onClick={() => wrap("![alt](url)")}><ImageIcon size={14} /></Tool>
        <Tool label="Code" onClick={() => wrap("`code`")}><Code size={14} /></Tool>
        <span className="mx-1 h-4 w-px bg-line" />
        <Tool label="Undo" onClick={undo}><Undo2 size={14} /></Tool>
        <Tool label="Redo" onClick={redoFn}><Redo2 size={14} /></Tool>
        <div className="ml-auto flex items-center gap-2">
          {dirty && <span className="text-[10px] text-ink-mute">unsaved</span>}
          <button type="button" onClick={() => { onSave(text.trim() ? text : null); setDirty(false); }}
            className={cn("rounded px-2 py-1 text-[10px] font-bold", dirty ? "bg-primary-500 text-white hover:bg-primary-600" : "text-ink-mute")}>
            Save note
          </button>
        </div>
      </div>
      <textarea value={text} onChange={(e) => { setText(e.target.value); setDirty(true); }}
        placeholder="Trade notes, thesis, what you'd repeat / avoid…"
        className="h-32 w-full resize-none bg-transparent p-3 text-xs outline-none placeholder:text-ink-mute" />
    </div>
  );
}