"use client";
import { useEffect, useMemo, useState, type MouseEvent } from "react";
import { Area, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Plus, Search, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { clientGetToken } from "@/lib/auth";
import { Toolbar } from "./report-ui";
import { ALL_METRICS, METRIC_GROUPS } from "@/lib/report-metrics";
import type { RpFilters, RpPerformance } from "@/types";

type AccountOption = { id: string; name: string };
const COLORS = ["#E5484D", "#2563EB", "#12B981", "#F5A524", "#6D5DE7", "#0EA5E9", "#EC4899"];

export function PerformanceView({ filters, setFilters, accounts, symbols, playbooks }:
  { filters: RpFilters; setFilters: (f: RpFilters) => void; accounts: AccountOption[]; symbols: string[]; playbooks: string[] }) {
  const tok = () => clientGetToken() ?? undefined;
  const [metrics, setMetrics] = useState<string[]>(["net_cum", "trades", "avg_win"]);
  const [gran, setGran] = useState("day");
  const [data, setData] = useState<RpPerformance | null>(null);
  const [picker, setPicker] = useState(false);
  const [pq, setPq] = useState("");

  useEffect(() => {
    let alive = true;
    api.reports.performance(metrics, gran, filters, tok())
      .then((d) => { if (alive) setData(d); })
      .catch(() => {});
    return () => { alive = false; };
  }, [metrics, gran, filters]);

  const merged = useMemo(() => {
    const m = new Map<string, any>();
    (data?.series || []).forEach((s) => s.points.forEach((p) => {
      const row = m.get(p.t) || { t: p.t };
      row[s.metric] = p.v;
      m.set(p.t, row);
    }));
    return Array.from(m.values());
  }, [data]);

  const addMetric = (id: string) => {
    setMetrics((x) => x.includes(id) ? x : [...x, id]);
    setPicker(false);
  };

  return (
    <div className="flex flex-col gap-4">
      <Toolbar filters={filters} setFilters={setFilters} accounts={accounts} symbols={symbols} playbooks={playbooks} onExport={() => window.print()} />

      <Card className="p-3">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          {metrics.map((mid, i) => {
            const m = ALL_METRICS.find((x) => x.id === mid);
            return (
              <span key={mid} className="flex items-center gap-1 rounded-full border border-line px-2 py-0.5 text-[10px] font-bold" style={{ borderColor: COLORS[i % COLORS.length] }}>
                <span className="h-2 w-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                {m?.label}
                {metrics.length > 1 && <button onClick={() => setMetrics((x) => x.filter((y) => y !== mid))}><X size={10} /></button>}
              </span>
            );
          })}
          <button onClick={() => setPicker(true)} className="flex items-center gap-1 text-[10px] font-bold text-primary-600 hover:underline"><Plus size={11} /> Add metric</button>
          <Select className="ml-auto h-7 w-24 text-[10px]" value={gran} onChange={(e) => setGran(e.target.value)}>
            <option value="day">Day</option>
            <option value="week">Week</option>
            <option value="month">Month</option>
          </Select>
        </div>

        <div className="h-72">
          {merged.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={merged} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="#F1F2F8" vertical={false} />
                <XAxis dataKey="t" tick={{ fontSize: 9, fill: "#9AA0B4" }} minTickGap={24} />
                <YAxis yAxisId="l" hide />
                <YAxis yAxisId="r" orientation="right" hide />
                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                {metrics.map((mid, i) => {
                  const m = ALL_METRICS.find((x) => x.id === mid)!;
                  const isArea = m.unit === "$";
                  return isArea ? (
                    <Area key={mid} yAxisId="l" type="monotone" dataKey={mid} name={m.label} stroke={COLORS[i % COLORS.length]} fill={COLORS[i % COLORS.length]} fillOpacity={0.12} strokeWidth={1.6} />
                  ) : (
                    <Line key={mid} yAxisId={m.unit === "#" || m.unit === "%" ? "r" : "l"} type="monotone" dataKey={mid} name={m.label} stroke={COLORS[i % COLORS.length]} strokeWidth={1.6} dot={false} />
                  );
                })}
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <div className="grid h-full place-items-center text-[10px] text-ink-mute">No trades in range.</div>
          )}
        </div>
      </Card>

      <Card className="p-3">
        <p className="mb-2 text-[11px] font-black uppercase text-ink-soft">Summary</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(data?.summary || []).map((s, i) => (
            <div key={i}>
              <p className="text-[9px] font-bold uppercase text-ink-mute">{s.label}</p>
              <p className={cn("text-[13px] font-black tabular-nums", s.tone === "pos" ? "text-success" : s.tone === "neg" ? "text-danger" : "")}>{s.value}</p>
            </div>
          ))}
        </div>
      </Card>

      {picker && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4" onClick={() => setPicker(false)}>
          <div className="w-80 rounded-card border border-line bg-surface p-3 shadow-card" onClick={(e: MouseEvent) => e.stopPropagation()}>
            <div className="relative mb-2">
              <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-ink-mute" />
              <Input className="h-8 pl-6 text-[11px]" placeholder="Search" value={pq} onChange={(e) => setPq(e.target.value)} />
            </div>
            <div className="max-h-72 overflow-y-auto scrollbar-thin">
              {METRIC_GROUPS.map((g) => {
                const items = g.items.filter((m) => m.label.toLowerCase().includes(pq.toLowerCase()));
                if (!items.length) return null;
                return (
                  <div key={g.group} className="mb-1">
                    <p className="px-1 py-1 text-[10px] font-bold text-primary-600">{g.group}</p>
                    {items.map((m) => (
                      <button key={m.id} onClick={() => addMetric(m.id)} className="block w-full rounded px-2 py-1 text-left text-[11px] hover:bg-canvas">
                        {m.label}
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}