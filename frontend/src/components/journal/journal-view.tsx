"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Layers, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { clientGetToken } from "@/lib/auth";
import { useDataRefresh } from "@/lib/data-refresh";
import { DayAccordion } from "./day-accordion";
import { MiniCalendar } from "./mini-calendar";
import { NoteDialog } from "./note-dialog";
import type { DaySummary, MonthJournal } from "@/types";

const currentMonth = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };

export function JournalView({ initialMonth, initialDays, focusedDay }:
  { initialMonth: string; initialDays: DaySummary[]; focusedDay: string | null }) {
  const [month, setMonth] = useState(initialMonth);
  const [data, setData] = useState<MonthJournal>({ month: initialMonth, days: initialDays });
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set(focusedDay ? [focusedDay] : initialDays.slice(0, 1).map((d) => d.date)));
  const [noteDay, setNoteDay] = useState<DaySummary | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  useDataRefresh(() => setRefreshTick((t) => t + 1));

  const load = useCallback(async (m: string) => {
    setLoading(true); setErr(null);
    try { setData(await api.journal.month(m, clientGetToken() ?? undefined)); }
    catch (e) { setErr(e instanceof Error ? e.message : "Failed to load journal"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(month); }, [month, load, refreshTick]);

  const allCollapsed = expanded.size === 0;
  function toggleAll() { setExpanded(allCollapsed ? new Set(data.days.map((d) => d.date)) : new Set()); }
  function toggle(date: string) { setExpanded((s) => { const n = new Set(s); n.has(date) ? n.delete(date) : n.add(date); return n; }); }
  function pickDay(date: string) { setExpanded(new Set([date])); const el = document.getElementById(`day-${date}`); el?.scrollIntoView({ behavior: "smooth", block: "start" }); }

  async function saveNote(note: string | null) {
    if (!noteDay) return;
    await api.journal.saveDayNote(noteDay.date, note, clientGetToken() ?? undefined);
    setData((d) => ({ ...d, days: d.days.map((x) => x.date === noteDay.date ? { ...x, note, hasNote: !!note } : x) }));
    setNoteDay(null);
  }

  const rangeLabel = useMemo(() => {
    if (focusedDay) { const d = new Date(focusedDay + "T00:00:00"); return `${d.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" })}`; }
    return data.days.length ? `${data.days.at(-1)!.label} – ${data.days[0].label}` : "No trades this month";
  }, [focusedDay, data.days]);
  void rangeLabel; // surfaced via topbar by the server page

  return (
    <div className="flex flex-col gap-4 lg:flex-row">
      <div className="flex-1">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={toggleAll}><Layers size={12} /> {allCollapsed ? "Expand All" : "Collapse All"}</Button>
            {loading && <span className="text-[10px] text-ink-mute">loading…</span>}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="icon" size="iconSm"><Settings2 size={14} /></Button>
          </div>
        </div>

        {err && <p className="mb-3 text-[11px] font-semibold text-danger">{err}</p>}

        <div className="flex flex-col gap-3">
          {data.days.length === 0 && !loading && (
            <div className="rounded-card border border-line bg-surface p-10 text-center text-[11px] text-ink-mute shadow-card">
              No trades logged in {month}. Add a trade or import a CSV to populate your journal.
            </div>
          )}
          {data.days.map((d) => (
            <div key={d.date} id={`day-${d.date}`}>
              <DayAccordion day={d} expanded={expanded.has(d.date)} onToggle={() => toggle(d.date)} onNote={setNoteDay} />
            </div>
          ))}
        </div>
      </div>

      <div className="w-full shrink-0 lg:w-64">
        <div className="sticky top-20">
          <MiniCalendar month={month} days={data.days} focused={focusedDay} onMonth={setMonth} onPickDay={pickDay} />
        </div>
      </div>

      <NoteDialog open={!!noteDay} dayLabel={noteDay?.label ?? ""} initial={noteDay?.note ?? null}
        onClose={() => setNoteDay(null)} onSave={saveNote} />
    </div>
  );
}