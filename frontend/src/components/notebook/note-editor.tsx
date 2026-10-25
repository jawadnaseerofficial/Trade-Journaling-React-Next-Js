"use client";
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import {
  Bold, Italic, Underline, Strikethrough, Heading1, Heading2, Heading3, List, ListOrdered, Indent, Outdent,
  AlignLeft, AlignCenter, AlignRight, Link2, Code, Quote, CheckSquare, ChevronsUpDown, Highlighter, Image as ImageIcon, Undo2, Redo2, Eraser, Type,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type EditorHandle = { insertHtml: (html: string) => void; focus: () => void };

const PALETTE = ["#E5484D", "#6D5DE7", "#12B981", "#F5A524", "#0EA5E9", "#EC4899"];
const SLASH = [
  { id: "text", label: "Text", hint: "Plain paragraph" }, { id: "h1", label: "Heading 1" }, { id: "h2", label: "Heading 2" }, { id: "h3", label: "Heading 3" },
  { id: "todo", label: "Checklist item", hint: "Toggleable ☐/☑" }, { id: "toggle", label: "Collapsible toggle", hint: "▸ expandable block" },
  { id: "badge", label: "Highlight badge", hint: "Colored heading" }, { id: "ul", label: "Bulleted list" }, { id: "ol", label: "Numbered list" },
  { id: "quote", label: "Quote" }, { id: "code", label: "Code block" }, { id: "divider", label: "Divider" }, { id: "image", label: "Image (URL)" },
];

export const NoteEditor = forwardRef<EditorHandle, { value: string; readonly?: boolean; onChange: (html: string) => void; onSaved?: () => void }>(
  function NoteEditor({ value, readonly, onChange, onSaved }, ref) {
    const ed = useRef<HTMLDivElement>(null);
    const saved = useRef<Range | null>(null);
    const [slash, setSlash] = useState<{ open: boolean; x: number; y: number; q: string; idx: number } | null>(null);
    const [badgeColor, setBadgeColor] = useState(PALETTE[0]);
    const dirty = useRef(false);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // set initial HTML once (and when an external template/reset changes it), without clobbering the caret mid-type
    useEffect(() => { if (ed.current && ed.current.innerHTML !== value) ed.current.innerHTML = value || ""; /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

    useImperativeHandle(ref, () => ({
      focus: () => ed.current?.focus(),
      insertHtml: (html) => {
        const el = ed.current; if (!el) return;
        el.focus();
        const sel = window.getSelection();
        let range = saved.current && el.contains(saved.current.startContainer) ? saved.current : (sel && sel.rangeCount ? sel.getRangeAt(0) : null);
        if (!range || !el.contains(range.commonAncestorContainer)) { range = document.createRange(); range.selectNodeContents(el); range.collapse(false); }
        const tmp = document.createElement("div"); tmp.innerHTML = html;
        const frag = document.createDocumentFragment(); while (tmp.firstChild) frag.appendChild(tmp.firstChild);
        range.insertNode(frag); range.collapse(false);
        sel?.removeAllRanges(); sel?.addRange(range); saved.current = range.cloneRange();
        emit();
      },
    }));

    function emit() {
      dirty.current = true;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => { if (ed.current) { onChange(ed.current.innerHTML); dirty.current = false; onSaved?.(); } }, 700);
    }
    function saveSel() { const sel = window.getSelection(); if (sel && sel.rangeCount && ed.current?.contains(sel.getRangeAt(0).commonAncestorContainer)) saved.current = sel.getRangeAt(0).cloneRange(); }
    function restoreSel() { const sel = window.getSelection(); if (saved.current) { sel?.removeAllRanges(); sel?.addRange(saved.current); } }
    function exec(cmd: string, val?: string) { if (readonly) return; ed.current?.focus(); restoreSel(); try { document.execCommand(cmd, false, val); } catch { /* noop */ } saveSel(); emit(); }
    function block(tag: string) { exec("formatBlock", `<${tag}>`); }
    function color(cmd: "foreColor" | "hiliteColor", val: string) { try { document.execCommand("styleWithCSS", false, "true"); } catch {} exec(cmd, val); }
    function fontSize(px: number) {
      if (readonly) return; ed.current?.focus(); restoreSel();
      try { document.execCommand("styleWithCSS", false, "true"); document.execCommand("fontSize", false, "7"); } catch {}
      // sentinel swap: the unique size-7 font tags become explicit px spans
      if (ed.current) ed.current.innerHTML = ed.current.innerHTML.replace(/<font[^>]*size="?7"?[^>]*>/gi, `<span style="font-size:${px}px">`).replace(/<\/font>/gi, "</span>");
      saveSel(); emit();
    }
    function insertTodo() { exec("insertHTML", `<div class="nt-todo"><span class="nt-check" contenteditable="false">☐</span><span class="nt-todotext">New item</span></div><p><br/></p>`); }
    function insertToggle() { exec("insertHTML", `<details class="nt-toggle"><summary>Toggle heading</summary><div class="nt-togglebody"><p>Hidden detail…</p></div></details><p><br/></p>`); }
    function insertBadge() { exec("insertHTML", `<h3 class="nt-badge" style="background:${badgeColor};color:#fff">Badge heading</h3><p><br/></p>`); }
    function insertImage() { const url = window.prompt("Image URL"); if (url) exec("insertImage", url); }
    function runSlash(id: string) {
      // strip the trailing "/" token then act
      if (ed.current) { const sel = window.getSelection(); if (sel && sel.rangeCount) { const r = sel.getRangeAt(0); const node = r.startContainer; if (node.nodeType === 3 && node.textContent?.endsWith("/")) { node.textContent = node.textContent.slice(0, -1); r.setStart(node, node.textContent.length); r.collapse(true); } } }
      setSlash(null);
      ({ text: () => block("p"), h1: () => block("h1"), h2: () => block("h2"), h3: () => block("h3"), todo: insertTodo, toggle: insertToggle, badge: insertBadge, ul: () => exec("insertUnorderedList"), ol: () => exec("insertOrderedList"), quote: () => block("blockquote"), code: () => block("pre"), divider: () => exec("insertHTML", "<hr/>"), image: insertImage } as Record<string, () => void>)[id]?.();
    }

    function onKey(e: React.KeyboardEvent) {
      if (readonly) return;
      if (e.key === "/" && !slash?.open) { const r = window.getSelection()?.getRangeAt(0); const rect = r?.getBoundingClientRect(); if (rect) setSlash({ open: true, x: rect.left, y: rect.bottom + 4, q: "", idx: 0 }); }
      if (slash?.open) {
        const list = SLASH.filter((s) => s.label.toLowerCase().includes(slash.q.toLowerCase()));
        if (e.key === "ArrowDown") { e.preventDefault(); setSlash({ ...slash, idx: Math.min(list.length - 1, slash.idx + 1) }); return; }
        if (e.key === "ArrowUp") { e.preventDefault(); setSlash({ ...slash, idx: Math.max(0, slash.idx - 1) }); return; }
        if (e.key === "Enter" && list[slash.idx]) { e.preventDefault(); runSlash(list[slash.idx].id); return; }
        if (e.key === "Escape") { setSlash(null); return; }
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") { e.preventDefault(); if (timer.current) clearTimeout(timer.current); if (ed.current) { onChange(ed.current.innerHTML); onSaved?.(); } }
    }
    function onInput() { saveSel(); if (slash?.open) { const sel = window.getSelection(); const txt = sel?.anchorNode?.textContent || ""; const m = txt.match(/\/(\w*)$/); if (m) setSlash({ ...slash, q: m[1], idx: 0 }); else setSlash(null); } emit(); }

    // delegated clicks: toggle checkbox state (matches the screenshots' struck-through checked items)
    function onClick(e: React.MouseEvent) {
      const t = e.target as HTMLElement;
      const chk = t.closest(".nt-check") as HTMLElement | null;
      if (chk && !readonly) { const row = chk.closest(".nt-todo"); const done = chk.textContent === "☑"; chk.textContent = done ? "☐" : "☑"; row?.classList.toggle("done", !done); emit(); }
    }

    const TB = ({ children, onClick, title }: { children: React.ReactNode; onClick: () => void; title: string }) => (
      <button type="button" title={title} onMouseDown={(e) => e.preventDefault()} onClick={onClick} disabled={readonly}
        className="grid h-7 w-7 place-items-center rounded text-ink-soft hover:bg-canvas hover:text-primary-600 disabled:opacity-40">{children}</button>
    );

    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <style>{`
          .nt-ed{outline:none;font-size:13px;line-height:1.6;color:#15162E;min-height:100%}
          .nt-ed h1{font-size:20px;font-weight:800;margin:.4em 0} .nt-ed h2{font-size:17px;font-weight:800;margin:.4em 0} .nt-ed h3{font-size:14px;font-weight:800;margin:.4em 0}
          .nt-ed p{margin:.3em 0} .nt-ed ul{list-style:disc;padding-left:1.4em;margin:.3em 0} .nt-ed ol{list-style:decimal;padding-left:1.4em;margin:.3em 0}
          .nt-ed blockquote{border-left:3px solid #6D5DE7;padding-left:10px;color:#5D6175;margin:.4em 0} .nt-ed pre{background:#F1F2F8;border-radius:8px;padding:8px;font-family:ui-monospace,monospace;font-size:12px;white-space:pre-wrap}
          .nt-ed hr{border:none;border-top:1px solid #E9EAF3;margin:.6em 0} .nt-ed img{max-width:100%;border-radius:8px;margin:.4em 0}
          .nt-ed a{color:#5A49D6;text-decoration:underline}
          .nt-badge{display:inline-block;padding:2px 10px;border-radius:5px;font-size:12px;font-weight:800;letter-spacing:.02em}
          .nt-todo{display:flex;align-items:flex-start;gap:6px;margin:.15em 0} .nt-check{cursor:pointer;user-select:none;font-size:14px;line-height:1.4;color:#6D5DE7} .nt-todotext{flex:1}
          .nt-todo.done .nt-todotext{text-decoration:line-through;color:#9AA0B4}
          .nt-toggle{border:1px solid #E9EAF3;border-radius:8px;padding:4px 8px;margin:.3em 0;background:#FAFAFD} .nt-toggle>summary{cursor:pointer;font-weight:700;font-size:12px;list-style:none} .nt-toggle>summary::-webkit-details-marker{display:none} .nt-toggle>summary::before{content:"▸ ";color:#6D5DE7} .nt-toggle[open]>summary::before{content:"▾ "} .nt-togglebody{padding:4px 0 2px 14px}
          .dark .nt-ed{color:#E7E8F0} .dark .nt-ed pre{background:#1B1D2E} .dark .nt-toggle{background:#161827;border-color:#262A40}
        `}</style>
        {!readonly && (
          <div className="flex flex-wrap items-center gap-0.5 border-b border-line bg-surface px-2 py-1.5">
            <TB title="Undo" onClick={() => exec("undo")}><Undo2 size={14} /></TB>
            <TB title="Redo" onClick={() => exec("redo")}><Redo2 size={14} /></TB>
            <TB title="Clear format" onClick={() => exec("removeFormat")}><Eraser size={14} /></TB>
            <span className="mx-1 h-4 w-px bg-line" />
            <TB title="Heading 1" onClick={() => block("h1")}><Heading1 size={14} /></TB>
            <TB title="Heading 2" onClick={() => block("h2")}><Heading2 size={14} /></TB>
            <TB title="Heading 3" onClick={() => block("h3")}><Heading3 size={14} /></TB>
            <select onMouseDown={(e) => e.stopPropagation()} onChange={(e) => e.target.value && exec("fontName", e.target.value)} defaultValue="" className="h-7 rounded border border-line bg-surface px-1 text-[10px]">
              <option value="" disabled>Font</option><option value="Arial">Arial</option><option value="Georgia">Georgia</option><option value="Courier New">Mono</option><option value="Times New Roman">Times</option>
            </select>
            <select onMouseDown={(e) => e.stopPropagation()} onChange={(e) => e.target.value && fontSize(Number(e.target.value))} defaultValue="15" className="h-7 rounded border border-line bg-surface px-1 text-[10px]">
              {[12, 13, 15, 18, 24, 32].map((s) => <option key={s} value={s}>{s}px</option>)}
            </select>
            <span className="mx-1 h-4 w-px bg-line" />
            <TB title="Bold" onClick={() => exec("bold")}><Bold size={14} /></TB>
            <TB title="Italic" onClick={() => exec("italic")}><Italic size={14} /></TB>
            <TB title="Underline" onClick={() => exec("underline")}><Underline size={14} /></TB>
            <TB title="Strikethrough" onClick={() => exec("strikeThrough")}><Strikethrough size={14} /></TB>
            <label title="Text color" className="grid h-7 w-7 cursor-pointer place-items-center rounded hover:bg-canvas"><Type size={14} /><input type="color" className="sr-only" onChange={(e) => color("foreColor", e.target.value)} /></label>
            <label title="Highlight" className="grid h-7 w-7 cursor-pointer place-items-center rounded hover:bg-canvas"><Highlighter size={14} /><input type="color" className="sr-only" onChange={(e) => color("hiliteColor", e.target.value)} /></label>
            <span className="mx-1 h-4 w-px bg-line" />
            <TB title="Align left" onClick={() => exec("justifyLeft")}><AlignLeft size={14} /></TB>
            <TB title="Align center" onClick={() => exec("justifyCenter")}><AlignCenter size={14} /></TB>
            <TB title="Align right" onClick={() => exec("justifyRight")}><AlignRight size={14} /></TB>
            <span className="mx-1 h-4 w-px bg-line" />
            <TB title="Bulleted list" onClick={() => exec("insertUnorderedList")}><List size={14} /></TB>
            <TB title="Numbered list" onClick={() => exec("insertOrderedList")}><ListOrdered size={14} /></TB>
            <TB title="Indent" onClick={() => exec("indent")}><Indent size={14} /></TB>
            <TB title="Outdent" onClick={() => exec("outdent")}><Outdent size={14} /></TB>
            <span className="mx-1 h-4 w-px bg-line" />
            <TB title="Link" onClick={() => { const u = window.prompt("Link URL"); if (u) exec("createLink", u); }}><Link2 size={14} /></TB>
            <TB title="Code" onClick={() => block("pre")}><Code size={14} /></TB>
            <TB title="Quote" onClick={() => block("blockquote")}><Quote size={14} /></TB>
            <span className="mx-1 h-4 w-px bg-line" />
            <TB title="Checklist" onClick={insertTodo}><CheckSquare size={14} /></TB>
            <TB title="Toggle" onClick={insertToggle}><ChevronsUpDown size={14} /></TB>
            <select title="Badge color" onMouseDown={(e) => e.stopPropagation()} value={badgeColor} onChange={(e) => setBadgeColor(e.target.value)} className="h-7 rounded border border-line bg-surface px-1 text-[10px]">
              {PALETTE.map((c) => <option key={c} value={c}>● {c}</option>)}
            </select>
            <TB title="Insert badge" onClick={insertBadge}><Highlighter size={14} /></TB>
            <TB title="Image" onClick={insertImage}><ImageIcon size={14} /></TB>
            <span className="ml-auto text-[9px] text-ink-mute">tip: press <b>/</b> for the block menu</span>
          </div>
        )}
        <div className="relative min-h-0 flex-1 overflow-y-auto scrollbar-thin bg-surface px-4 py-3">
          <div ref={ed} className="nt-ed" contentEditable={!readonly} suppressContentEditableWarning onInput={onInput} onKeyUp={saveSel} onBlur={saveSel} onKeyDown={onKey} onClick={onClick} />
          {slash?.open && (() => { const list = SLASH.filter((s) => s.label.toLowerCase().includes(slash.q.toLowerCase())); return (
            <div style={{ left: slash.x, top: slash.y }} className="absolute z-30 w-56 overflow-hidden rounded-card border border-line bg-surface shadow-card">
              {list.length === 0 && <p className="px-3 py-2 text-[11px] text-ink-mute">No blocks</p>}
              {list.map((s, i) => (
                <button key={s.id} onMouseDown={(e) => e.preventDefault()} onClick={() => runSlash(s.id)}
                  className={cn("flex w-full flex-col items-start px-3 py-1.5 text-left", i === slash.idx ? "bg-primary-50" : "hover:bg-canvas")}>
                  <span className="text-[11px] font-bold">{s.label}</span>{s.hint && <span className="text-[9px] text-ink-mute">{s.hint}</span>}
                </button>
              ))}
            </div>
          ); })()}
          {readonly && <p className="mt-2 text-[10px] text-ink-mute">Read-only — this note is generated from your Backtesting session. Open the backtester to edit.</p>}
        </div>
      </div>
    );
  }
);