"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BarChart3 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { clientGetToken } from "@/lib/auth";
import {
  BucketTable,
  ComboChart,
  CrossHeatmap,
  LineChartBox,
  SummaryCards,
  Toolbar,
} from "./report-ui";
import { DIMENSIONS } from "@/lib/report-metrics";
import type { RpCross, RpDimension, RpFilters } from "@/types";

type AccountOption = { id: string; name: string };

const SUBTABS: Record<string, { id: string; label: string }[]> = {
  dow: [
    { id: "dow", label: "Days" },
    { id: "month", label: "Months" },
    { id: "hour", label: "Trade time" },
    { id: "duration", label: "Trade duration" },
  ],
};

export function ReportShell({
  dimension,
  filters,
  setFilters,
  accounts,
  symbols,
  playbooks,
}: {
  dimension: string;
  filters: RpFilters;
  setFilters: (f: RpFilters) => void;
  accounts: AccountOption[];
  symbols: string[];
  playbooks: string[];
}) {
  const router = useRouter();
  const tok = () => clientGetToken() ?? undefined;

  const [sub, setSub] = useState(dimension);
  const [data, setData] = useState<RpDimension | null>(null);
  const [crossMetric, setCrossMetric] = useState<"net" | "winrate" | "trades">("net");
  const [crossB, setCrossB] = useState("hour");
  const [cross, setCross] = useState<RpCross | null>(null);

  useEffect(() => {
    setSub(dimension);
  }, [dimension]);

  const active = SUBTABS[dimension] ? sub : dimension;

  useEffect(() => {
    let alive = true;

    api.reports
      .dimension(active, filters, tok())
      .then((d) => {
        if (alive) setData(d);
      })
      .catch(() => {});

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, filters]);

  useEffect(() => {
    let alive = true;

    api.reports
      .cross(active, crossB, crossMetric, filters, tok())
      .then((c) => {
        if (alive) setCross(c);
      })
      .catch(() => {});

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, crossB, crossMetric, filters]);

  const chartData = useMemo(
    () =>
      (data?.series || []).map((r) => ({
        t: r.label,
        net: r.net,
        trades: r.trades,
        win: r.winRate ?? 0,
        avgw: r.avgWin ?? 0,
      })),
    [data]
  );

  if (data && !data.available) {
    return (
      <Card className="p-10 text-center">
        <p className="text-[12px] font-bold text-ink-soft">
          {data.note || "This report isn’t available yet."}
        </p>
        <p className="mt-1 text-[10px] text-ink-mute">
          It lights up automatically once the backing data/column exists — no fake numbers.
        </p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {SUBTABS[dimension] && (
        <div className="flex gap-1">
          {SUBTABS[dimension].map((s) => (
            <button
              key={s.id}
              onClick={() => setSub(s.id)}
              className={cn(
                "rounded px-3 py-1 text-[11px] font-bold",
                sub === s.id
                  ? "bg-primary-500 text-white"
                  : "bg-canvas text-ink-soft hover:bg-primary-50"
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}

      <Toolbar
        filters={filters}
        setFilters={setFilters}
        accounts={accounts}
        symbols={symbols}
        playbooks={playbooks}
        onExport={() => window.print()}
      />

      <SummaryCards cards={data?.cards || []} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-3">
          <div className="mb-1 flex items-center gap-1 text-[10px] font-bold text-ink-mute">
            <BarChart3 size={12} /> Net P&L · Trade count
          </div>
          <div className="h-56">
            {chartData.length ? (
              <ComboChart
                data={chartData}
                primary="net"
                secondary="trades"
                primaryLabel="Net P&L"
                secondaryLabel="Trade count"
              />
            ) : (
              <Empty />
            )}
          </div>
        </Card>

        <Card className="p-3">
          <div className="mb-1 flex items-center gap-1 text-[10px] font-bold text-ink-mute">
            <BarChart3 size={12} /> Win %
          </div>
          <div className="h-56">
            {chartData.length ? (
              <LineChartBox data={chartData} keyName="win" label="Win %" />
            ) : (
              <Empty />
            )}
          </div>
        </Card>
      </div>

      <Card className="p-3">
        <p className="mb-2 text-[11px] font-black uppercase text-ink-soft">Summary</p>
        <BucketTable
          rows={data?.table || []}
          onDrill={(r) => drill(router, active, r.key, filters)}
        />
      </Card>

      <Card className="p-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[11px] font-black uppercase text-ink-soft">Cross analysis</p>

          <div className="flex items-center gap-2">
            <Select
              className="h-7 w-40 text-[10px]"
              value={crossB}
              onChange={(e) => setCrossB(e.target.value)}
            >
              {DIMENSIONS.filter((d) => d.id !== active).map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </Select>

            <div className="flex rounded-card border border-line p-0.5">
              {(["winrate", "net", "trades"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setCrossMetric(m)}
                  className={cn(
                    "rounded px-2 py-1 text-[10px] font-bold capitalize",
                    crossMetric === m ? "bg-primary-500 text-white" : "text-ink-mute"
                  )}
                >
                  {m === "winrate" ? "Win rate" : m}
                </button>
              ))}
            </div>
          </div>
        </div>

        {cross?.available ? (
          <CrossHeatmap
            rows={cross.rows}
            cols={cross.cols}
            cells={cross.cells}
            metric={crossMetric}
          />
        ) : (
          <p className="py-6 text-center text-[10px] text-ink-mute">
            {cross?.note || "Not enough data for this pairing."}
          </p>
        )}
      </Card>
    </div>
  );
}

function Empty() {
  return (
    <div className="grid h-full place-items-center text-[10px] text-ink-mute">
      No trades in range.
    </div>
  );
}

function drill(
  router: ReturnType<typeof useRouter>,
  dim: string,
  key: string,
  filters: RpFilters
) {
  const p = new URLSearchParams();

  if (filters.start) p.set("start", filters.start);
  if (filters.end) p.set("end", filters.end);

  (filters.symbols ?? []).forEach((s) => p.append("symbols", s));

  if (dim === "symbol") p.set("symbol", key);
  if (dim === "day") p.set("day", key);
  if (dim === "playbook") p.set("playbook", key);
  if (dim === "account") p.set("account", key);

  router.push(`/trade-log?${p.toString()}`);
}