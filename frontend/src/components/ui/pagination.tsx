"use client";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function Pagination({ page, pages, total, from, to, onPage }:
  { page: number; pages: number; total: number; from: number; to: number; onPage: (p: number) => void }) {
  return (
    <div className="flex flex-col items-center gap-2 py-4">
      <p className="text-[10px] font-semibold text-ink-soft">Result: {from} - {to} of {total} {total === 1 ? "item" : "items"}</p>
      <div className="flex items-center gap-1">
        <button disabled={page <= 1} onClick={() => onPage(page - 1)} className="grid h-7 w-7 place-items-center rounded text-ink-mute hover:bg-canvas disabled:opacity-40"><ChevronLeft size={13} /></button>
        {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
          <button key={p} onClick={() => onPage(p)}
            className={`grid h-7 w-7 place-items-center rounded text-[10px] font-bold ${p === page ? "bg-line text-ink" : "text-ink-mute hover:bg-canvas"}`}>{p}</button>
        ))}
        <button disabled={page >= pages} onClick={() => onPage(page + 1)} className="grid h-7 w-7 place-items-center rounded text-ink-mute hover:bg-canvas disabled:opacity-40"><ChevronRight size={13} /></button>
      </div>
    </div>
  );
}