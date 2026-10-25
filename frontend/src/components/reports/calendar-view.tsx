"use client";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { cn, money } from "@/lib/utils";
import { api } from "@/lib/api";
import { clientGetToken } from "@/lib/auth";
import { Toolbar } from "./report-ui";
import type { RpCalendar, RpFilters } from "@/types";

type AccountOption = { id: string; name: string };

function compactMoney(n: number) {
  const a = Math.abs(n);
  const sign = n < 0 ? "-" : "";

  if (a >= 1_000_000) return `${sign}$${(a / 1_000_000).toFixed(1)}M`;
  if (a >= 1_000) return `${sign}$${(a / 1_000).toFixed(1)}K`;

  return `${sign}$${a.toFixed(0)}`;
}

export function CalendarView({
  filters,
  setFilters,
  accounts,
  symbols,
  playbooks,
}: {
  filters: RpFilters;
  setFilters: (f: RpFilters) => void;
  accounts: AccountOption[];
  symbols: string[];
  playbooks: string[];
}) {
  const router = useRouter();
  const tok = () => clientGetToken() ?? undefined;

  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [d, setD] = useState<RpCalendar | null>(null);

  useEffect(() => {
    let alive = true;

    api.reports
      .calendar(month, filters, tok())
      .then((x) => {
        if (alive) setD(x);
      })
      .catch(() => {});

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, filters]);

  const shift = (n: number) => {
    const [y, m] = month.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1 + n, 1));
    setMonth(dt.toISOString().slice(0, 7));
  };

  const grid = useMemo(() => {
    if (!d) return [];

    const [y, m] = month.split("-").map(Number);
    const first = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();

    const cells: Array<RpCalendar["days"][number] | null> = Array(first).fill(null);
    d.days.forEach((x) => cells.push(x));

    return cells;
  }, [d, month]);

  const maxAbs = Math.max(1, ...(d?.days || []).map((x) => Math.abs(x.net)));

  const bg = (net: number) => {
    if (!net) return "transparent";

    if (net > 0) {
      return `rgba(18,185,129,${0.12 + Math.min(1, net / maxAbs) * 0.6})`;
    }

    return `rgba(229,72,77,${0.12 + Math.min(1, -net / maxAbs) * 0.6})`;
  };

  return (
    <div className="flex flex-col gap-4">
      <Toolbar
        filters={filters}
        setFilters={setFilters}
        accounts={accounts}
        symbols={symbols}
        playbooks={playbooks}
        onExport={() => window.print()}
      />

      <Card className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <button
            onClick={() => shift(-1)}
            className="rounded p-1 hover:bg-canvas"
          >
            <ChevronLeft size={16} />
          </button>

          <p className="text-[13px] font-black">
            {new Date(month + "-01T00:00:00Z").toLocaleDateString("en-US", {
              month: "long",
              year: "numeric",
              timeZone: "UTC",
            })}
          </p>

          <button
            onClick={() => shift(1)}
            className="rounded p-1 hover:bg-canvas"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[9px] font-bold uppercase text-ink-mute">
          {["S", "M", "T", "W", "T", "F", "S"].map((w, i) => (
            <span key={i}>{w}</span>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {grid.map((c, i) =>
            c == null ? (
              <span key={i} />
            ) : (
              <button
                key={i}
                onClick={() =>
                  c.trades && router.push(`/trade-log?start=${c.d}&end=${c.d}`)
                }
                disabled={!c.trades}
                className={cn(
                  "flex aspect-square flex-col items-center justify-center rounded-lg text-[10px]",
                  c.trades ? "cursor-pointer font-bold" : "text-ink-mute/40"
                )}
                style={{ background: bg(c.net) }}
              >
                <span>{Number(c.d.slice(-2))}</span>

                {c.trades > 0 && (
                  <span className="text-[8px] tabular-nums">
                    {compactMoney(c.net)}
                  </span>
                )}
              </button>
            )
          )}
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3 border-t border-line pt-3 text-[11px] sm:grid-cols-4">
          <div>
            <p className="text-[9px] uppercase text-ink-mute">Month total</p>
            <p
              className={cn(
                "font-black tabular-nums",
                (d?.total || 0) >= 0 ? "text-success" : "text-danger"
              )}
            >
              {money(d?.total || 0, { sign: true })}
            </p>
          </div>

          <div>
            <p className="text-[9px] uppercase text-ink-mute">Trading days</p>
            <p className="font-black tabular-nums">{d?.tradingDays ?? 0}</p>
          </div>

          <div>
            <p className="text-[9px] uppercase text-ink-mute">Best day</p>
            <p className="font-black tabular-nums text-success">
              {d?.bestDay?.value || "--"}
            </p>
          </div>

          <div>
            <p className="text-[9px] uppercase text-ink-mute">Worst day</p>
            <p className="font-black tabular-nums text-danger">
              {d?.worstDay?.value || "--"}
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}