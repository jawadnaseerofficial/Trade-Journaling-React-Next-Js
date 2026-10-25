"use client";
import { useEffect, useState } from "react";
import { Info } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { clientGetToken } from "@/lib/auth";
import { Toolbar } from "./report-ui";
import type { RpFilters, RpOverview } from "@/types";

type AccountOption = { id: string; name: string };

export function OverviewView({
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
  const tok = () => clientGetToken() ?? undefined;
  const [d, setD] = useState<RpOverview | null>(null);

  useEffect(() => {
    let alive = true;

    api.reports
      .overview(filters, tok())
      .then((x) => {
        if (alive) setD(x);
      })
      .catch(() => {});

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const Row = ({
    items,
  }: {
    items: { label: string; value: string; tone?: string | null }[];
  }) => (
    <div>
      {items.map((s, i) => (
        <div
          key={i}
          className="flex items-center justify-between border-b border-line/50 py-1.5 text-[11px]"
        >
          <span className="flex items-center gap-1 text-ink-soft">
            {s.label}
            <Info size={10} className="text-ink-mute" />
          </span>
          <span
            className={cn(
              "font-bold tabular-nums",
              s.tone === "pos"
                ? "text-success"
                : s.tone === "neg"
                ? "text-danger"
                : ""
            )}
          >
            {s.value}
          </span>
        </div>
      ))}
    </div>
  );

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
        <p className="flex items-center gap-1 text-[11px] font-black uppercase text-ink-soft">
          Your stats
          <Info size={11} className="text-ink-mute" />
          <span className="ml-1 text-[9px] font-normal text-ink-mute">
            (ALL DATES)
          </span>
        </p>

        <div className="mt-2 grid grid-cols-3 gap-4">
          {[
            ["Best month", d?.bestMonth],
            ["Lowest month", d?.lowestMonth],
            ["Average", d?.avgMonth],
          ].map(([t, o]: any) => (
            <div key={t}>
              <p className="text-[10px] font-bold text-ink-soft">{t}</p>
              <p
                className={cn(
                  "text-[15px] font-black tabular-nums",
                  (o?.value || "").startsWith("-")
                    ? "text-danger"
                    : "text-success"
                )}
              >
                {o?.value || "--"}
              </p>
              <p className="text-[9px] text-ink-mute">
                {o?.label || ""} {o?.sub || ""}
              </p>
            </div>
          ))}
        </div>
      </Card>

      <Card className="grid grid-cols-1 gap-x-8 p-4 md:grid-cols-2">
        <Row items={d?.left || []} />
        <Row items={d?.right || []} />
      </Card>
    </div>
  );
}