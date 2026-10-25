"use client";
import { useMemo, useState, type ReactNode } from "react";
import { Area, CartesianGrid, ComposedChart, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Activity, Calendar as CalIcon, ChevronDown, Download, Filter, Target, TrendingDown, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { cn, money } from "@/lib/utils";
import type { RpBucket, RpCard, RpCrossCell, RpFilters } from "@/types";

type AccountOption = { id: string; name: string };

const CARD_ICON: Record<string, ReactNode> = {
  best: <TrendingUp size={13} className="text-success" />,
  worst: <TrendingDown size={13} className="text-danger" />,
  active: <Activity size={13} className="text-warn" />,
  winrate: <Target size={13} className="text-primary-600" />,
};

function compactMoney(n: number) {
  const a = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (a >= 1_000_000) return `${sign}$${(a / 1_000_000).toFixed(1)}M`;
  if (a >= 1_000) return `${sign}$${(a / 1_000).toFixed(1)}K`;
  return `${sign}$${a.toFixed(0)}`;
}

export function SummaryCards({ cards }: { cards: RpCard[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {cards.map((c, i) => (
        <Card key={i} className="p-3">
          <p className="flex items-center gap-1 text-[9px] font-bold uppercase text-ink-mute">{CARD_ICON[c.kind]}{c.title}</p>
          <p className="mt-1 truncate text-[13px] font-black">{c.label}</p>
          <p className={cn("text-[12px] font-bold tabular-nums", c.tone === "pos" ? "text-success" : c.tone === "neg" ? "text-danger" : "text-ink-soft")}>{c.value}</p>
          {c.sub && <p className="text-[9px] text-ink-mute">{c.sub}</p>}
        </Card>
      ))}
    </div>
  );
}

export function ComboChart({ data, primary, secondary, primaryLabel, secondaryLabel }:
  { data: any[]; primary: string; secondary?: string; primaryLabel: string; secondaryLabel?: string }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="#F1F2F8" vertical={false} />
        <XAxis dataKey="t" tick={{ fontSize: 9, fill: "#9AA0B4" }} interval="preserveStartEnd" minTickGap={24} />
        <YAxis yAxisId="l" hide tick={{ fontSize: 9 }} />
        {secondary && <YAxis yAxisId="r" orientation="right" hide tick={{ fontSize: 9 }} />}
        <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #E9EAF3" }}
          formatter={(v: any, n: any) => [n === primaryLabel ? money(Number(v), { sign: true }) : v, n]} />
        <Legend wrapperStyle={{ fontSize: 10 }} />
        <Area yAxisId="l" type="monotone" dataKey={primary} name={primaryLabel} stroke="#0E9F6E" fill="url(#rpG)" strokeWidth={1.6} />
        {secondary && <Line yAxisId="r" type="monotone" dataKey={secondary} name={secondaryLabel} stroke="#2563EB" strokeWidth={1.6} dot={false} />}
        <defs>
          <linearGradient id="rpG" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#12B981" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#12B981" stopOpacity={0.02} />
          </linearGradient>
        </defs>
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export function LineChartBox({ data, keyName, label }: { data: any[]; keyName: string; label: string }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="#F1F2F8" vertical={false} />
        <XAxis dataKey="t" tick={{ fontSize: 9, fill: "#9AA0B4" }} interval="preserveStartEnd" minTickGap={24} />
        <YAxis hide tick={{ fontSize: 9 }} />
        <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} formatter={(v: any) => [`${v}${label.includes("%") ? "%" : ""}`, label]} />
        <Legend wrapperStyle={{ fontSize: 10 }} />
        <Line type="monotone" dataKey={keyName} name={label} stroke="#2563EB" strokeWidth={1.8} dot={{ r: 2 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function BucketTable({ rows, onDrill }: { rows: RpBucket[]; onDrill?: (r: RpBucket) => void }) {
  const [sort, setSort] = useState<{ k: keyof RpBucket; dir: 1 | -1 }>({ k: "net", dir: -1 });
  const sorted = useMemo(() => [...rows].sort((a, b) => {
    const x = a[sort.k], y = b[sort.k];
    if (typeof x === "number" && typeof y === "number") return (x - y) * sort.dir;
    return String(x).localeCompare(String(y)) * sort.dir;
  }), [rows, sort]);

  const Th = ({ k, children, right }: { k: keyof RpBucket; children: ReactNode; right?: boolean }) => (
    <th onClick={() => setSort((s) => ({ k, dir: s.k === k ? (s.dir === 1 ? -1 : 1) : -1 }))}
      className={cn("cursor-pointer select-none px-3 py-2 text-[10px] font-bold uppercase text-ink-mute hover:text-ink", right && "text-right")}>
      {children}{sort.k === k ? (sort.dir === 1 ? " ▲" : " ▼") : ""}
    </th>
  );

  return (
    <div className="overflow-x-auto rounded-card border border-line">
      <table className="w-full text-left text-[11px]">
        <thead>
          <tr className="bg-canvas/60">
            <Th k="label">Bucket</Th>
            <Th k="winRate" right>Win %</Th>
            <Th k="net" right>Net P&L</Th>
            <Th k="trades" right>Trades</Th>
            <Th k="volume" right>Avg vol</Th>
            <Th k="avgWin" right>Avg win</Th>
            <Th k="avgLoss" right>Avg loss</Th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={r.key} onClick={() => onDrill?.(r)} className={cn("border-t border-line/60", onDrill && "cursor-pointer hover:bg-canvas/60")}>
              <td className="px-3 py-2 font-bold">{r.label}</td>
              <td className="px-3 py-2 text-right tabular-nums">{r.winRate != null ? r.winRate + "%" : "--"}</td>
              <td className={cn("px-3 py-2 text-right font-bold tabular-nums", r.net >= 0 ? "text-success" : "text-danger")}>{money(r.net, { sign: true })}</td>
              <td className="px-3 py-2 text-right tabular-nums">{r.trades}</td>
              <td className="px-3 py-2 text-right tabular-nums">{r.volume}</td>
              <td className="px-3 py-2 text-right tabular-nums text-success">{r.avgWin != null ? money(r.avgWin) : "--"}</td>
              <td className="px-3 py-2 text-right tabular-nums text-danger">{r.avgLoss != null ? money(r.avgLoss) : "--"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function heatColor(v: number, max: number) {
  if (!v || !max) return "transparent";
  const t = Math.min(1, Math.abs(v) / max);
  return v >= 0 ? `rgba(18,185,129,${0.12 + t * 0.55})` : `rgba(229,72,77,${0.12 + t * 0.55})`;
}

export function CrossHeatmap({ rows, cols, cells, metric }: { rows: string[]; cols: string[]; cells: RpCrossCell[]; metric: string }) {
  const map = useMemo(() => {
    const m = new Map<string, RpCrossCell>();
    cells.forEach((c) => m.set(c.row + "|" + c.col, c));
    return m;
  }, [cells]);

  const max = useMemo(() => Math.max(1, ...cells.map((c) => Math.abs(metric === "winrate" ? (c.winRate ?? 0) : metric === "trades" ? c.trades : c.net))), [cells, metric]);

  return (
    <div className="overflow-x-auto rounded-card border border-line">
      <table className="w-full border-collapse text-[10px]">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 bg-surface px-2 py-1.5 text-left font-bold text-ink-mute"></th>
            {cols.map((c) => <th key={c} className="px-2 py-1.5 text-center font-bold text-ink-mute whitespace-nowrap">{c}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r}>
              <td className="sticky left-0 z-10 bg-surface px-2 py-1.5 font-bold whitespace-nowrap">{r}</td>
              {cols.map((c) => {
                const cell = map.get(r + "|" + c);
                const v = cell ? (metric === "winrate" ? (cell.winRate ?? 0) : metric === "trades" ? cell.trades : cell.net) : 0;
                return (
                  <td key={c} className="px-1 py-1 text-center tabular-nums" style={{ background: heatColor(v, max) }}
                    title={cell ? `${cell.trades} trades · ${money(cell.net, { sign: true })} · ${cell.winRate ?? 0}%` : "—"}>
                    {cell ? (metric === "winrate" ? `${cell.winRate ?? 0}%` : metric === "trades" ? cell.trades : compactMoney(v)) : "—"}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Toolbar({ filters, setFilters, accounts, symbols, playbooks, onExport }:
  { filters: RpFilters; setFilters: (f: RpFilters) => void; accounts: AccountOption[]; symbols: string[]; playbooks: string[]; onExport?: () => void }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <div className="relative">
        <button onClick={() => setOpen((v) => !v)} className="flex items-center gap-1 rounded-card border border-line bg-surface px-2.5 py-1.5 text-[11px] font-bold text-ink-soft hover:bg-canvas">
          <Filter size={12} /> Filters <ChevronDown size={11} />
        </button>
        {open && (
          <div className="absolute right-0 top-9 z-30 w-64 rounded-card border border-line bg-surface p-3 shadow-card">
            <p className="mb-1 text-[9px] font-bold uppercase text-ink-mute">Symbols</p>
            <div className="flex flex-wrap gap-1">
              {symbols.map((s) => (
                <button key={s} onClick={() => setFilters({ ...filters, symbols: (filters.symbols || []).includes(s) ? (filters.symbols || []).filter((x) => x !== s) : [...(filters.symbols || []), s] })}
                  className={cn("rounded px-1.5 py-0.5 text-[10px] font-bold", (filters.symbols || []).includes(s) ? "bg-primary-500 text-white" : "bg-canvas text-ink-soft")}>
                  {s}
                </button>
              ))}
            </div>
            <p className="mb-1 mt-2 text-[9px] font-bold uppercase text-ink-mute">Side</p>
            <div className="flex gap-1">
              {["long", "short"].map((s) => (
                <button key={s} onClick={() => setFilters({ ...filters, sides: (filters.sides || []).includes(s) ? (filters.sides || []).filter((x) => x !== s) : [...(filters.sides || []), s] })}
                  className={cn("rounded px-2 py-0.5 text-[10px] font-bold uppercase", (filters.sides || []).includes(s) ? "bg-primary-500 text-white" : "bg-canvas text-ink-soft")}>
                  {s}
                </button>
              ))}
            </div>
            {(filters.symbols?.length || filters.sides?.length) ? (
              <Button size="sm" className="mt-2 w-full" onClick={() => setFilters({ ...filters, symbols: [], sides: [] })}>Clear</Button>
            ) : null}
          </div>
        )}
      </div>

      <label className="flex items-center gap-1 rounded-card border border-line bg-surface px-2 py-1 text-[10px] font-bold text-ink-soft">
        <CalIcon size={11} />
        <input type="date" value={filters.start || ""} onChange={(e) => setFilters({ ...filters, start: e.target.value })} className="bg-transparent text-[10px] outline-none" /> →
        <input type="date" value={filters.end || ""} onChange={(e) => setFilters({ ...filters, end: e.target.value })} className="bg-transparent text-[10px] outline-none" />
      </label>

      <Select className="h-7 w-32 text-[10px]" value={(filters.accounts || [])[0] || ""} onChange={(e) => setFilters({ ...filters, accounts: e.target.value ? [e.target.value] : [] })}>
        <option value="">All accounts</option>
        {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
      </Select>

      {onExport && <Button variant="outline" size="sm" onClick={onExport}><Download size={12} /> Export PDF</Button>}
    </div>
  );
}