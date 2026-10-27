"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, ChevronLeft, ChevronRight, Info } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn, compactMoney } from "@/lib/utils";
import { api } from "@/lib/api";
import { clientGetToken } from "@/lib/auth";
import type { CalendarMonth } from "@/types";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const toMonthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

const shiftMonth = (key: string, delta: number) => {
  const [y, m] = key.split("-").map(Number);
  return toMonthKey(new Date(y, m - 1 + delta, 1));
};

const monthLabel = (key: string) => {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleString("en-US", { month: "long", year: "numeric" });
};

export function TradingCalendar({ initial }: { initial: CalendarMonth }) {
  const router = useRouter();
  const [monthKey, setMonthKey] = useState(initial.month);
  const [data, setData] = useState<CalendarMonth>(initial);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (monthKey === initial.month) {
      setData(initial);
      return;
    }
    let alive = true;
    setLoading(true);
    api.dashboard
      .calendar(monthKey, clientGetToken() ?? undefined)
      .then((d) => {
        if (alive) setData(d);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [monthKey, initial]);

  const [y, m] = monthKey.split("-").map(Number);
  const firstWeekday = new Date(y, m - 1, 1).getDay();
  const daysInMonth = new Date(y, m, 0).getDate();
  const cells: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const byDay = new Map(data.days.map((d) => [Number(d.date.slice(8, 10)), d]));
  const now = new Date();
  const todayKey = toMonthKey(now);

  // route a visible day-cell to its dedicated day page
  const openDay = (day: number) => {
    const iso = `${monthKey}-${String(day).padStart(2, "0")}`;
    router.push(`/trades/day/${iso}`);
  };

  return (
    <Card>
      <div className="flex items-center justify-between px-4 pb-3 pt-4">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="iconSm" aria-label="Previous month" onClick={() => setMonthKey((k) => shiftMonth(k, -1))}>
            <ChevronLeft size={14} />
          </Button>
          <Button variant="ghost" size="sm" className="px-2 text-[10px] font-extrabold tracking-wider" onClick={() => setMonthKey(todayKey)}>
            TODAY
          </Button>
          <Button variant="ghost" size="iconSm" aria-label="Next month" onClick={() => setMonthKey((k) => shiftMonth(k, 1))}>
            <ChevronRight size={14} />
          </Button>
          <span className="ml-2 text-[11px] font-bold">{monthLabel(monthKey)}</span>
        </div>
        <Info size={13} className="text-ink-mute" />
      </div>

      <div className={cn("grid grid-cols-7 gap-1.5 px-4 pb-4 transition-opacity", loading && "opacity-50")}>
        {WEEKDAYS.map((d) => (
          <div key={d} className="rounded-md border border-line py-1.5 text-center text-[10px] font-bold text-ink-soft">
            {d}
          </div>
        ))}

        {cells.map((day, i) => {
          if (day === null)
            return <div key={`empty-${i}`} className="min-h-[62px] rounded-md border border-line/60 bg-canvas/50" />;
          const d = byDay.get(day);
          const isToday = monthKey === todayKey && day === now.getDate();
          return (
            <div
              key={day}
              role="button"
              tabIndex={0}
              aria-label={`Open ${monthKey}-${String(day).padStart(2, "0")}`}
              title="View this day"
              onClick={() => openDay(day)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  openDay(day);
                }
              }}
              className={cn(
                "group relative min-h-[62px] cursor-pointer rounded-md border p-1.5 text-center transition-all",
                "hover:z-10 hover:-translate-y-0.5 hover:ring-2 hover:ring-primary-300",
                "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500",
                d
                  ? d.pnl >= 0
                    ? "border-success/30 bg-success-soft"
                    : "border-danger/30 bg-danger-soft"
                  : "border-line bg-surface hover:border-primary-300",
              )}
            >
              {/* hover cue in the free top-left corner (top-right is the day number / today badge) */}
              <span className="pointer-events-none absolute left-1.5 top-1.5 text-primary-600 opacity-0 transition-opacity group-hover:opacity-100">
                <ArrowUpRight size={11} />
              </span>

              {isToday ? (
                <span className="absolute right-1.5 top-1.5 grid h-4 w-4 place-items-center rounded-full bg-primary-500 text-[8px] font-bold text-white">
                  {day}
                </span>
              ) : (
                <span className="absolute right-1.5 top-1.5 text-[9px] font-semibold text-ink-mute">{day}</span>
              )}
              {d && (
                <div className="mt-4">
                  <div className={cn("text-[11px] font-extrabold tabular-nums", d.pnl >= 0 ? "text-success-deep" : "text-danger-deep")}>
                    {compactMoney(d.pnl)}
                  </div>
                  <div className={cn("text-[8px] font-semibold", d.pnl >= 0 ? "text-success-deep/70" : "text-danger-deep/70")}>
                    {d.trades} trades
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}