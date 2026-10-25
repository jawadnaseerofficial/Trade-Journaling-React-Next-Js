"use client";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DaySummary } from "@/types";

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

const shiftMonth = (key: string, delta: number) => {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};
const label = (key: string) => {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleString("en-US", { month: "long", year: "numeric" });
};

export function MiniCalendar({ month, days, focused, onMonth, onPickDay }:
  { month: string; days: DaySummary[]; focused: string | null; onMonth: (m: string) => void; onPickDay: (d: string) => void }) {
  const [y, m] = month.split("-").map(Number);
  const firstWeekday = new Date(y, m - 1, 1).getDay();
  const daysInMonth = new Date(y, m, 0).getDate();
  const byDay = new Map(days.map((d) => [Number(d.date.slice(8, 10)), d]));
  const now = new Date();
  const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const cells: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  return (
    <div className="rounded-card border border-line bg-surface p-3 shadow-card">
      <div className="mb-2 flex items-center justify-between">
        <button onClick={() => onMonth(shiftMonth(month, -1))} className="rounded p-1 text-ink-mute hover:bg-canvas"><ChevronLeft size={14} /></button>
        <span className="text-[11px] font-bold">{label(month)}</span>
        <button onClick={() => onMonth(shiftMonth(month, 1))} className="rounded p-1 text-ink-mute hover:bg-canvas"><ChevronRight size={14} /></button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAYS.map((d) => <div key={d} className="text-[9px] font-bold text-ink-mute">{d}</div>)}
        {cells.map((day, i) => {
          if (day === null) return <div key={`e${i}`} />;
          const d = byDay.get(day);
          const isToday = month === todayKey && day === now.getDate();
          const isFocused = focused === `${month}-${String(day).padStart(2, "0")}`;
          return (
            <button
              key={day}
              onClick={() => onPickDay(`${month}-${String(day).padStart(2, "0")}`)}
              className={cn(
                "grid aspect-square place-items-center rounded text-[10px] font-semibold transition-colors",
                d ? (d.netPnl >= 0 ? "bg-success-soft text-success-deep" : "bg-danger-soft text-danger-deep") : "text-ink-mute hover:bg-canvas",
                isToday && "ring-1 ring-primary-500",
                isFocused && "outline outline-2 outline-primary-500",
              )}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}