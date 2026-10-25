"use client";
import { useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export function TagInput({ value, onChange, placeholder = "Add tags", className }:
  { value: string | null; onChange: (v: string) => void; placeholder?: string; className?: string }) {
  const tags = (value ?? "").split(",").map((t) => t.trim()).filter(Boolean);
  const [draft, setDraft] = useState("");
  function commit() {
    const t = draft.trim();
    if (!t) return;
    onChange([...tags, t].join(","));
    setDraft("");
  }
  function remove(i: number) { onChange(tags.filter((_, j) => j !== i).join(",")); }
  return (
    <div className={cn("flex min-h-9 flex-wrap items-center gap-1 rounded-lg border border-line bg-surface px-2 py-1", className)}>
      {tags.map((t, i) => (
        <span key={i} className="flex items-center gap-1 rounded bg-primary-50 px-1.5 py-0.5 text-[10px] font-semibold text-primary-600">
          {t}
          <button type="button" onClick={() => remove(i)} className="text-primary-400 hover:text-primary-700"><X size={10} /></button>
        </span>
      ))}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); commit(); } }}
        onBlur={commit}
        placeholder={tags.length ? "" : placeholder}
        className="min-w-16 flex-1 bg-transparent text-[11px] outline-none placeholder:text-ink-mute"
      />
    </div>
  );
}