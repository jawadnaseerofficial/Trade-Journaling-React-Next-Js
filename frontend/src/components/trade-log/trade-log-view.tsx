"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Filter, X } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, YAxis } from "recharts";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { DonutRing, WinGauge, RatioBar } from "@/components/dashboard/kpi-accessories";
import { cn, money, pct } from "@/lib/utils";
import { api } from "@/lib/api";
import { clientGetToken } from "@/lib/auth";
import { HoverCard } from "./hover-card";
import type { Account, LogPage, TradePreview } from "@/types";

const STATUS_TABS = [
  { id: "", label: "All" },
  { id: "win", label: "Win" },
  { id: "loss", label: "Loss" },
  { id: "break_even", label: "BE" },
  { id: "open", label: "Open" },
];

const PER_PAGE = [25, 50, 100];

function KpiCard({
  label,
  children,
  accessory,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  accessory?: React.ReactNode;
  hint?: string;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] font-semibold text-ink-soft">
            {label}
            {hint && (
              <span title={hint} className="ml-1 cursor-help text-ink-mute">
                ⓘ
              </span>
            )}
          </p>
          <div className="mt-1 text-lg font-black tabular-nums">{children}</div>
        </div>
        {accessory}
      </div>
    </Card>
  );
}

export function TradeLogView({
  initial,
  accounts,
}: {
  initial: LogPage;
  accounts: Account[];
}) {
  const router = useRouter();
  const tok = () => clientGetToken() ?? undefined;

  const [data, setData] = useState(initial);
  const [filters, setFilters] = useState({
    status: "",
    symbol: "",
    setup: "",
    accountId: "",
    dateFrom: "",
    dateTo: "",
  });

  const [sort, setSort] = useState("openDate");
  const [dir, setDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(initial.perPage);
  const [loading, setLoading] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0); // ⟵ refresh

  const [metrics, setMetrics] = useState<
    Record<string, { mae: number | null; mfe: number | null; bestExitPct: number | null }>
  >({});

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [attachPb, setAttachPb] = useState("");
  const [pbList, setPbList] = useState<{ id: string; name: string }[]>([]);

  const [hover, setHover] = useState<{
    id: string;
    x: number;
    y: number;
    data: TradePreview | null;
  } | null>(null);

  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reqKey = useRef("");

  useEffect(() => {
    api.playbooks
      .list("mine", tok())
      .catch(() => api.playbooks.list("my", tok()))
      .then((l: any) => {
        setPbList(
          (Array.isArray(l) ? l : []).map((p: any) => ({
            id: String(p.id),
            name: String(p.name),
          }))
        );
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    return () => {
      if (hoverTimer.current) clearTimeout(hoverTimer.current);
    };
  }, []);

  // ⟵ refresh: live-refetch when a CSV import fires elsewhere in the app
  useEffect(() => {
    const onImported = () => setRefreshTick((t) => t + 1);
    window.addEventListener("tj:data-imported", onImported);
    return () => window.removeEventListener("tj:data-imported", onImported);
  }, []);

  const load = useCallback(
    async (
      f: typeof filters,
      s: string,
      d: "asc" | "desc",
      pg: number,
      pp: number
    ) => {
      // refreshTick is in the key so an import forces a real re-query
      // (load early-returns on an unchanged key, so this is required)
      const key = JSON.stringify([f, s, d, pg, pp, refreshTick]); // ⟵ refresh
      if (key === reqKey.current) return;

      reqKey.current = key;
      setLoading(true);

      try {
        const res = await api.trades.log(
          {
            status: f.status || undefined,
            symbol: f.symbol || undefined,
            setup: f.setup || undefined,
            account_id: f.accountId || undefined,
            date_from: f.dateFrom || undefined,
            date_to: f.dateTo || undefined,
            sort: s,
            direction: d,
            page: pg,
            per_page: pp,
          },
          tok()
        );

        setData(res);
        setSelected(new Set());
        setMetrics({});
      } finally {
        setLoading(false);
      }
    },
    [refreshTick] // ⟵ refresh
  );

  useEffect(() => {
    load(filters, sort, dir, page, perPage);
  }, [filters, sort, dir, page, perPage, load]);

  useEffect(() => {
    const ids = data.rows.map((r) => r.id);
    if (!ids.length) return;

    let alive = true;

    api.trades
      .previewBatch(ids, tok())
      .then((m) => {
        if (alive) setMetrics((prev) => ({ ...prev, ...m }));
      })
      .catch(() => {});

    return () => {
      alive = false;
    };
  }, [data.rows]);

  function onSort(col: string) {
    if (sort === col) {
      setDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSort(col);
      setDir("desc");
    }
    setPage(1);
  }

  function setFilter<K extends keyof typeof filters>(k: K, v: string) {
    setFilters((f) => ({ ...f, [k]: v }));
    setPage(1);
  }

  function onRowEnter(e: React.MouseEvent, id: string) {
    const x = e.clientX;
    const y = e.clientY;

    if (hoverTimer.current) clearTimeout(hoverTimer.current);

    hoverTimer.current = setTimeout(async () => {
      setHover({ id, x, y, data: null });

      try {
        const p = await api.trades.preview(id, tok());
        setHover((h) => (h && h.id === id ? { ...h, data: p } : h));
      } catch {
        setHover((h) => (h && h.id === id ? { ...h, data: null } : h));
      }
    }, 250);
  }

  function onRowMove(e: React.MouseEvent) {
    if (hover) setHover((h) => (h ? { ...h, x: e.clientX, y: e.clientY } : h));
  }

  function onRowLeave() {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    setHover(null);
  }

  function openReplay(id: string) {
    router.push(`/replay?trade=${id}`);
  }

  function toggleRow(id: string) {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  function toggleAll() {
    setSelected((s) =>
      s.size === data.rows.length ? new Set() : new Set(data.rows.map((r) => r.id))
    );
  }

  async function bulkAttach() {
    if (!attachPb) return;

    for (const id of selected) {
      await api.trades.linkPlaybook(id, attachPb, tok());
    }

    setSelected(new Set());
    setAttachPb("");
    reqKey.current = "";
    load(filters, sort, dir, page, perPage);
  }

  const k = data.kpis;
  const spark = k.cumulative;

  const SortHeader = ({
    col,
    label,
    right,
    center,
  }: {
    col: string;
    label: string;
    right?: boolean;
    center?: boolean;
  }) => (
    <th
      className={cn(
        "cursor-pointer select-none px-3 py-2 hover:text-primary-600",
        right && "text-right",
        center && "text-center"
      )}
      onClick={() => onSort(col)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {sort === col && (dir === "asc" ? <ArrowUp size={10} /> : <ArrowDown size={10} />)}
      </span>
    </th>
  );

  return (
    <div className="flex flex-col gap-4">
      {/* KPI strip */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="relative p-4">
          <p className="text-[10px] font-semibold text-ink-soft">
            Net Cumulative P&L
            <span className="ml-1 rounded bg-primary-50 px-1 text-[9px] font-bold text-primary-600">
              {k.trades}
            </span>
          </p>

          <p
            className={cn(
              "mt-1 text-lg font-black tabular-nums",
              k.netPnl >= 0 ? "text-success" : "text-danger"
            )}
          >
            {money(k.netPnl, { sign: true })}
          </p>

          <div className="mt-1 h-10">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={spark} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="tlSpark" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6D5DE7" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#6D5DE7" stopOpacity={0.02} />
                  </linearGradient>
                </defs>

                <YAxis hide domain={["dataMin", "dataMax"]} />

                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#5A49D6"
                  strokeWidth={1.4}
                  fill="url(#tlSpark)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <KpiCard
          label="Profit Factor"
          hint="Gross profit ÷ gross loss"
          accessory={<DonutRing winRate={k.winRate} />}
        >
          {k.profitFactor.toFixed(2)}
        </KpiCard>

        <KpiCard
          label="Win %"
          hint="Winning trades ÷ total closed trades"
          accessory={<WinGauge winRate={k.winRate} />}
        >
          {pct(k.winRate)}
        </KpiCard>

        <KpiCard
          label="Avg win/loss trade"
          hint="Average winner ÷ average loser"
          accessory={<RatioBar avgWin={k.avgWin} avgLoss={k.avgLoss} />}
        >
          {k.avgLoss ? (k.avgWin / Math.abs(k.avgLoss)).toFixed(2) : "--"}
        </KpiCard>
      </div>

      {/* Filters */}
      <Card className="flex flex-wrap items-center gap-2 p-3">
        <div className="flex rounded-card border border-line bg-canvas p-0.5">
          {STATUS_TABS.map((s) => (
            <button
              key={s.id}
              onClick={() => setFilter("status", s.id)}
              className={cn(
                "rounded px-2.5 py-1 text-[10px] font-bold",
                filters.status === s.id
                  ? "bg-surface text-primary-600 shadow-sm"
                  : "text-ink-mute hover:text-ink-soft"
              )}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="relative">
          <Filter
            size={12}
            className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-ink-mute"
          />
          <Input
            className="h-8 w-32 pl-6 text-[11px]"
            placeholder="Symbol…"
            value={filters.symbol}
            onChange={(e) => setFilter("symbol", e.target.value)}
          />
        </div>

        <Input
          className="h-8 w-32 text-[11px]"
          placeholder="Setup…"
          value={filters.setup}
          onChange={(e) => setFilter("setup", e.target.value)}
        />

        <Select
          className="h-8 w-40 text-[11px]"
          value={filters.accountId}
          onChange={(e) => setFilter("accountId", e.target.value)}
        >
          <option value="">All accounts</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </Select>

        <Input
          type="date"
          className="h-8 w-32 text-[11px]"
          value={filters.dateFrom}
          onChange={(e) => setFilter("dateFrom", e.target.value)}
        />

        <span className="text-ink-mute">–</span>

        <Input
          type="date"
          className="h-8 w-32 text-[11px]"
          value={filters.dateTo}
          onChange={(e) => setFilter("dateTo", e.target.value)}
        />

        {(filters.symbol ||
          filters.setup ||
          filters.accountId ||
          filters.dateFrom ||
          filters.dateTo ||
          filters.status) && (
          <button
            onClick={() => {
              setFilters({
                status: "",
                symbol: "",
                setup: "",
                accountId: "",
                dateFrom: "",
                dateTo: "",
              });
              setPage(1);
            }}
            className="flex items-center gap-1 text-[10px] font-bold text-danger hover:underline"
          >
            <X size={11} /> Clear
          </button>
        )}
      </Card>

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[11px]">
            <thead>
              <tr className="bg-primary-50/60 text-[10px] font-bold text-ink-soft">
                <th className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={selected.size === data.rows.length && data.rows.length > 0}
                    onChange={toggleAll}
                    className="accent-primary-500"
                  />
                </th>

                <SortHeader col="openDate" label="Open date" />
                <SortHeader col="symbol" label="Symbol" />
                <SortHeader col="status" label="Status" />
                <SortHeader col="closeDate" label="Close date" />

                <th className="px-3 py-2 text-right">Entry</th>
                <th className="px-3 py-2 text-right">Exit</th>

                <SortHeader col="netPnl" label="Net P&L" right />
                <SortHeader col="netRoi" label="Net ROI" right />

                <th className="px-3 py-2 text-center">Insights</th>
                <th className="px-3 py-2">Setups</th>
                <th className="px-3 py-2">Zella Scale</th>
                <th className="px-3 py-2 text-right">Best Exit</th>
              </tr>
            </thead>

            <tbody>
              {data.rows.map((r) => {
                const m = metrics[r.id];
                const mae = m?.mae ?? r.mae;
                const mfe = m?.mfe ?? r.mfe;
                const be = m?.bestExitPct ?? r.bestExitPct;
                const tot = (mae ?? 0) + (mfe ?? 0) || 1;

                return (
                  <tr
                    key={r.id}
                    onMouseEnter={(e) => onRowEnter(e, r.id)}
                    onMouseMove={onRowMove}
                    onMouseLeave={onRowLeave}
                    onClick={(e) => {
                      if ((e.target as HTMLElement).closest("input,button,select,a")) return;
                      openReplay(r.id);
                    }}
                    className={cn(
                      "cursor-pointer border-t border-line hover:bg-canvas/60",
                      selected.has(r.id) && "bg-primary-50/50"
                    )}
                  >
                    <td
                      className="px-3 py-2.5"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={selected.has(r.id)}
                        onChange={() => toggleRow(r.id)}
                        className="accent-primary-500"
                      />
                    </td>

                    <td className="px-3 py-2.5 text-ink-soft">{r.openDate}</td>
                    <td className="px-3 py-2.5 font-bold">{r.symbol}</td>
                    <td className="px-3 py-2.5">
                      <StatusBadge s={r.status} />
                    </td>
                    <td className="px-3 py-2.5 text-ink-soft">{r.closeDate ?? "--"}</td>

                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {r.entryPrice == null ? "--" : money(r.entryPrice)}
                    </td>

                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {r.exitPrice == null ? "--" : money(r.exitPrice)}
                    </td>

                    <td
                      className={cn(
                        "px-3 py-2.5 text-right font-bold tabular-nums",
                        r.netPnl >= 0 ? "text-success" : "text-danger"
                      )}
                    >
                      {money(r.netPnl)}
                    </td>

                    <td
                      className={cn(
                        "px-3 py-2.5 text-right tabular-nums",
                        (r.netRoi ?? 0) >= 0 ? "text-success" : "text-danger"
                      )}
                    >
                      {r.netRoi == null ? "--" : `${r.netRoi.toFixed(2)}%`}
                    </td>

                    <td className="px-3 py-2.5 text-center">
                      {r.realizedR == null ? (
                        <span className="text-ink-mute">-</span>
                      ) : (
                        <span
                          className={cn(
                            "font-bold",
                            r.realizedR >= 0 ? "text-success" : "text-danger"
                          )}
                        >
                          {Math.abs(r.realizedR).toFixed(0)} {r.realizedR >= 0 ? "↑" : "↓"}
                        </span>
                      )}
                    </td>

                    <td className="px-3 py-2.5">
                      {(r.setups ?? "")
                        .split(",")
                        .filter(Boolean)
                        .slice(0, 1)
                        .map((s) => (
                          <span
                            key={s}
                            className="rounded border border-primary-200 bg-primary-50 px-1.5 py-0.5 text-[9px] font-bold text-primary-600"
                          >
                            {s.trim()}
                          </span>
                        ))}
                    </td>

                    <td className="px-3 py-2.5">
                      {mae == null && mfe == null ? (
                        <span className="text-ink-mute">--</span>
                      ) : (
                        <div className="flex h-1.5 w-20 overflow-hidden rounded-full bg-canvas">
                          <div
                            className="bg-danger"
                            style={{ width: `${((mae ?? 0) / tot) * 100}%` }}
                          />
                          <div
                            className="bg-success"
                            style={{ width: `${((mfe ?? 0) / tot) * 100}%` }}
                          />
                        </div>
                      )}
                    </td>

                    <td className="px-3 py-2.5 text-right tabular-nums text-ink-soft">
                      {be == null ? "--" : `${be.toFixed(2)}%`}
                    </td>
                  </tr>
                );
              })}

              {data.rows.length === 0 && !loading && (
                <tr>
                  <td
                    colSpan={13}
                    className="px-3 py-10 text-center text-[11px] text-ink-mute"
                  >
                    No trades match these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* footer pagination */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold text-ink-soft">
              Trades per page:
            </span>

            <Select
              className="h-7 w-16 text-[10px]"
              value={String(perPage)}
              onChange={(e) => {
                setPerPage(Number(e.target.value));
                setPage(1);
              }}
            >
              {PER_PAGE.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </Select>

            <span className="text-[10px] text-ink-mute">
              {data.total
                ? `${(data.page - 1) * data.perPage + 1} - ${Math.min(
                    data.page * data.perPage,
                    data.total
                  )} of ${data.total} trades`
                : "0 trades"}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Select
              className="h-7 w-20 text-[10px]"
              value={String(data.page)}
              onChange={(e) => setPage(Number(e.target.value))}
            >
              {Array.from({ length: data.pages }, (_, i) => i + 1).map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </Select>

            <span className="text-[10px] text-ink-mute">of {data.pages} pages</span>

            <button
              disabled={data.page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="grid h-7 w-7 place-items-center rounded text-ink-mute hover:bg-canvas disabled:opacity-40"
            >
              <ChevronLeft size={13} />
            </button>

            <button
              disabled={data.page >= data.pages}
              onClick={() => setPage((p) => p + 1)}
              className="grid h-7 w-7 place-items-center rounded text-ink-mute hover:bg-canvas disabled:opacity-40"
            >
              <ChevronRight size={13} />
            </button>
          </div>
        </div>
      </Card>

      {loading && (
        <div className="-mt-2 text-center text-[10px] text-ink-mute">loading…</div>
      )}

      {/* bulk attach bar */}
      {selected.size > 0 && (
        <div className="fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-full border border-line bg-surface px-4 py-2 shadow-card">
          <span className="text-[11px] font-bold">{selected.size} selected</span>

          <Select
            className="h-7 w-44 text-[11px]"
            value={attachPb}
            onChange={(e) => setAttachPb(e.target.value)}
          >
            <option value="">Attach to playbook…</option>
            {pbList.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>

          <Button size="sm" disabled={!attachPb} onClick={bulkAttach}>
            Attach
          </Button>

          <button
            onClick={() => setSelected(new Set())}
            className="text-[11px] font-bold text-ink-mute hover:text-ink"
          >
            Clear
          </button>
        </div>
      )}

      <HoverCard data={hover?.data ?? null} x={hover?.x ?? 0} y={hover?.y ?? 0} />
    </div>
  );
}

function StatusBadge({ s }: { s: string }) {
  const map: Record<string, string> = {
    win: "border-success text-success",
    loss: "border-danger text-danger",
    break_even: "border-ink-mute text-ink-soft",
    open: "border-warn text-warn",
  };

  return (
    <span
      className={cn(
        "rounded border px-1.5 py-0.5 text-[9px] font-extrabold uppercase",
        map[s] ?? map.break_even
      )}
    >
      {s === "break_even" ? "BE" : s}
    </span>
  );
}