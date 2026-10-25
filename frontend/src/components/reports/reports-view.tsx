"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BarChart3, Calendar as CalIcon, GitCompare, LayoutGrid, Layers } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn, money } from "@/lib/utils";
import { api } from "@/lib/api";
import { clientGetToken } from "@/lib/auth";
import { ReportShell } from "./report-shell";
import { PerformanceView } from "./performance-view";
import { OverviewView } from "./overview-view";
import { CompareView } from "./compare-view";
import { CalendarView } from "./calendar-view";
import { REPORT_MENU } from "@/lib/report-metrics";
import type { RpFilters } from "@/types";

type AccountOption = { id: string; name: string };

const TABS = [
  { id: "performance", label: "Performance", Icon: BarChart3, badge: "NEW" },
  { id: "overview", label: "Overview", Icon: LayoutGrid },
  { id: "reports", label: "Reports", Icon: Layers, dropdown: true },
  { id: "compare", label: "Compare", Icon: GitCompare },
  { id: "calendar", label: "Calendar", Icon: CalIcon },
];

export function ReportsView({
  initialTab,
  initialDim,
}: {
  initialTab: string;
  initialDim: string;
}) {
  const router = useRouter();
  const tok = () => clientGetToken() ?? undefined;

  const [tab, setTab] = useState(initialTab);
  const [dim, setDim] = useState(initialDim);
  const [filters, setFilters] = useState<RpFilters>({});

  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [symbols, setSymbols] = useState<string[]>([]);
  const [playbooks, setPlaybooks] = useState<string[]>([]);

  const [repOpen, setRepOpen] = useState(false);

  useEffect(() => {
    let alive = true;

    api.accounts
      .list(tok())
      .then((r: any) => {
        if (!alive) return;

        setAccounts(
          (Array.isArray(r) ? r : []).map((a: any) => ({
            id: String(a.id),
            name: String(a.name ?? a.id),
          }))
        );
      })
      .catch(() => {});

    api.trades
      .log({ limit: 500 }, tok())
      .then((r: any) => {
        if (!alive) return;

        const list = Array.isArray(r?.rows)
          ? r.rows
          : Array.isArray(r?.items)
          ? r.items
          : Array.isArray(r)
          ? r
          : [];

        const syms = Array.from(
          new Set(list.map((t: any) => t?.symbol).filter(Boolean))
        ) as string[];

        setSymbols(syms.slice(0, 40));
      })
      .catch(() => {});

    api.playbooks
      .list("mine", tok())
      .then((r: any) => {
        if (!alive) return;

        setPlaybooks(
          (Array.isArray(r) ? r : [])
            .map((p: any) => String(p.name))
            .filter(Boolean)
        );
      })
      .catch(() => {});

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function go(t: string, d?: string) {
    setTab(t);
    if (d) setDim(d);

    const seg = t === "reports" ? `/reports/${d ?? "dow"}` : `/reports/${t}`;
    router.replace(seg, { scroll: false });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-1 border-b border-line">
        {TABS.map((t) =>
          t.dropdown ? (
            <div key={t.id} className="relative">
              <button
                onClick={() => setRepOpen((v) => !v)}
                className={cn(
                  "flex items-center gap-1 px-3 py-2 text-[12px] font-bold",
                  tab === "reports"
                    ? "border-b-2 border-primary-500 text-primary-600"
                    : "text-ink-mute hover:text-ink-soft"
                )}
              >
                <t.Icon size={13} /> {t.label} <span className="text-[9px]">▾</span>
              </button>

              {repOpen && (
                <div
                  className="absolute left-0 top-9 z-30 w-56 rounded-card border border-line bg-surface py-1 shadow-card"
                  onMouseLeave={() => setRepOpen(false)}
                >
                  {REPORT_MENU.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => {
                        go("reports", r.id);
                        setRepOpen(false);
                      }}
                      className={cn(
                        "block w-full px-3 py-1.5 text-left text-[11px] hover:bg-canvas",
                        dim === r.id && tab === "reports"
                          ? "font-bold text-primary-600"
                          : "text-ink-soft"
                      )}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <button
              key={t.id}
              onClick={() => go(t.id)}
              className={cn(
                "flex items-center gap-1 px-3 py-2 text-[12px] font-bold",
                tab === t.id
                  ? "border-b-2 border-primary-500 text-primary-600"
                  : "text-ink-mute hover:text-ink-soft"
              )}
            >
              <t.Icon size={13} /> {t.label}
              {t.badge && (
                <span className="rounded bg-primary-500 px-1 text-[8px] font-black text-white">
                  {t.badge}
                </span>
              )}
            </button>
          )
        )}
      </div>

      {tab === "performance" && (
        <PerformanceView
          filters={filters}
          setFilters={setFilters}
          accounts={accounts}
          symbols={symbols}
          playbooks={playbooks}
        />
      )}

      {tab === "overview" && (
        <OverviewView
          filters={filters}
          setFilters={setFilters}
          accounts={accounts}
          symbols={symbols}
          playbooks={playbooks}
        />
      )}

      {tab === "compare" && <CompareView symbols={symbols} />}

      {tab === "calendar" && (
        <CalendarView
          filters={filters}
          setFilters={setFilters}
          accounts={accounts}
          symbols={symbols}
          playbooks={playbooks}
        />
      )}

      {tab === "reports" && dim === "winslosses" && (
        <WinsLosses filters={filters} />
      )}

      {tab === "reports" && dim !== "winslosses" && (
        <ReportShell
          key={dim}
          dimension={dim}
          filters={filters}
          setFilters={setFilters}
          accounts={accounts}
          symbols={symbols}
          playbooks={playbooks}
        />
      )}
    </div>
  );
}

function WinsLosses({ filters }: { filters: RpFilters }) {
  const tok = () => clientGetToken() ?? undefined;
  const [d, setD] = useState<any>(null);

  useEffect(() => {
    let alive = true;

    api.reports
      .winsLosses(filters, tok())
      .then((x) => {
        if (alive) setD(x);
      })
      .catch(() => {});

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {(d?.rows || []).map((r: any) => (
          <Card key={r.group} className="p-4">
            <p
              className={cn(
                "text-[11px] font-black uppercase",
                r.group === "Winners"
                  ? "text-success"
                  : r.group === "Losers"
                  ? "text-danger"
                  : "text-ink-mute"
              )}
            >
              {r.group}
            </p>

            <p className="mt-1 text-[20px] font-black tabular-nums">{r.trades}</p>
            <p className="text-[10px] text-ink-mute">trades</p>

            <div className="mt-2 space-y-0.5 text-[10px]">
              <p>
                Avg P&L:{" "}
                <b className="tabular-nums">
                  {r.avgPnl != null ? money(r.avgPnl, { sign: true }) : "--"}
                </b>
              </p>
              <p>
                Avg hold: <b>{r.avgHold}</b>
              </p>
              <p>
                Avg size: <b className="tabular-nums">{r.avgSize ?? "--"}</b>
              </p>
            </div>
          </Card>
        ))}
      </div>

      <Card className="p-3">
        <p className="mb-2 text-[11px] font-black uppercase text-ink-soft">By symbol</p>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-[11px]">
            <thead>
              <tr className="bg-canvas/60 text-[10px] uppercase text-ink-mute">
                <th className="px-3 py-2">Symbol</th>
                <th className="px-3 py-2 text-right">Win %</th>
                <th className="px-3 py-2 text-right">Net P&L</th>
                <th className="px-3 py-2 text-right">Trades</th>
              </tr>
            </thead>

            <tbody>
              {(d?.bySymbol || []).map((r: any) => (
                <tr key={r.key} className="border-t border-line/60">
                  <td className="px-3 py-2 font-bold">{r.label}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.winRate ?? 0}%</td>
                  <td
                    className={cn(
                      "px-3 py-2 text-right font-bold tabular-nums",
                      r.net >= 0 ? "text-success" : "text-danger"
                    )}
                  >
                    {money(r.net, { sign: true })}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.trades}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}