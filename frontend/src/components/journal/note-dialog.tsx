"use client";
import { useEffect, useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export function NoteDialog({ open, dayLabel, initial, onClose, onSave }:
  { open: boolean; dayLabel: string; initial: string | null; onClose: () => void; onSave: (note: string | null) => void }) {
  const [text, setText] = useState(initial ?? "");
  useEffect(() => { setText(initial ?? ""); }, [initial, open]);
  return (
    <Dialog open={open} onClose={onClose} title={`Journal note — ${dayLabel}`}
      footer={<>
        <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
        <Button size="sm" onClick={() => onSave(text.trim() ? text : null)}>Save note</Button>
      </>}>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="What happened today? Setup, mindset, mistakes, wins…"
        className="h-40 w-full resize-none rounded-lg border border-line bg-surface p-3 text-xs outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
      />
    </Dialog>
  );
}