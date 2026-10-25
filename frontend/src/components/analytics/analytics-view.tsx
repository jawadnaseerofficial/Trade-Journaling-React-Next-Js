"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity, BarChart3, Brain, Clock, Copy, Filter, Gauge, Layers, Printer, Shield,
  Sparkles, Target, TrendingUp, Dices, Waves, X,
} from "lucide-react";
import {
  Area, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Line, LineChart,
  PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer,
  Scatter, ScatterChart, Tooltip, XAxis, YAxis,
} from "recharts";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { cn, money } from "@/lib/utils";
import { api } from "@/lib/api";
import { clientGetToken } from "@/lib/auth";
import type { AnalyticsOut, AnaBucket, RpFilters } from "@/types";

type TabId = "pulse" | "equity" | "edge" | "timing" | "risk" | "simulate" | "regime" | "attribution" | "narrative";

const TABS: { id: TabId; label: string; Icon: any }[] = [
  { id: "pulse", label: "Pulse", Icon: Sparkles },
  { id: "equity", label: "Equity", Icon: TrendingUp },
  { id: "edge", label: "Edge", Icon: Layers },
  { id: "timing", label: "Timing", Icon: Clock },
  { id: "risk", label: "Risk", Icon: Shield },
  { id: "simulate", label: "Simulate", Icon: Dices },
  { id: "regime", label: "Regime", Icon: Brain },
  { id: "attribution", label: "Attribution", Icon: Waves },
  { id: "narrative", label: "Narrative", Icon: Copy },
];

const COLORS = ["#6D5DE7", "#12B981", "#0EA5E9", "#F5A524", "#EC4899", "#E5484D", "#8B5CF6", "#14B8A6"];

function fmtPct(v?: number | null) { return v == null ? "--" : `${v.toFixed(2)}%`; }
function compactMoney(n: number) {
  const a = Math.abs(n); const s = n < 0 ? "-" : "";
  if (a >= 1_000_000) return `${s}$${(a / 1_000_000).toFixed(1)}M`;
  if (a >= 1_000) return `${s}$${(a / 1_000).toFixed(1)}K`;
  return `${s}$${a.toFixed(0)}`;
}
function toneText(t?: string | null) { return t === "pos" ? "text-success" : t === "neg" ? "text-danger" : t === "warn" ? "text-warn" : "text-ink-soft"; }
function toneBorder(t?: string | null) { return t === "pos" ? "border-l-success" : t === "neg" ? "border-l-danger" : t === "warn" ? "border-l-warn" : "border-l-primary-500"; }
function distColor(label: string) { return label.startsWith("<") || label.startsWith("-") ? "#E5484D" : label === "0" ? "#9AA0B4" : "#12B981"; }
function probColor(p: number) { const t = Math.min(1, p / 100); return `rgba(109,93,231,${0.08 + t * 0.7})`; }

function SectionTitle({ icon: Icon, title, sub }: { icon: any; title: string; sub?: string }) {
  return (
    <div className="mb-3">
      <p className="flex items-center gap-2 text-[12px] font-black uppercase tracking-wide text-ink-soft">
        <Icon size={14} className="text-primary-600" />{title}
      </p>
      {sub && <p className="mt-0.5 text-[10px] text-ink-mute">{sub}</p>}
    </div>
  );
}
function EmptyState({ text }: { text: string }) { return <div className="grid h-40 place-items-center text-[11px] text-ink-mute">{text}</div>; }

function KpiTile({ label, value, sub, tone }: { label: string; value: string; sub?: string | null; tone?: string | null }) {
  return (
    <Card className={cn("group relative overflow-hidden border-l-4 p-4 transition-all hover:-translate-y-0.5 hover:shadow-card", toneBorder(tone))}>
      <div className="absolute -right-6 -top-6 h-16 w-16 rounded-full bg-primary-500/5 transition-transform group-hover:scale-150" />
      <p className="text-[10px] font-bold uppercase text-ink-mute">{label}</p>
      <p className={cn("mt-1 text-xl font-black tabular-nums", toneText(tone))}>{value}</p>
      {sub && <p className="mt-1 text-[10px] text-ink-mute">{sub}</p>}
    </Card>
  );
}

function BucketTable({ title, rows, emptyText }: { title: string; rows: AnaBucket[]; emptyText: string }) {
  if (!rows.length) return <Card className="p-4"><SectionTitle icon={BarChart3} title={title} /><EmptyState text={emptyText} /></Card>;
  return (
    <Card className="p-4">
      <SectionTitle icon={BarChart3} title={title} />
      <div className="overflow-x-auto">
        <table className="w-full text-left text-[11px]">
          <thead><tr className="bg-canvas/60 text-[10px] font-bold uppercase text-ink-mute">
            <th className="px-3 py-2">Bucket</th><th className="px-3 py-2 text-right">Net P&L</th><th className="px-3 py-2 text-right">Trades</th><th className="px-3 py-2 text-right">Win %</th><th className="px-3 py-2 text-right">Avg / Trade</th>
          </tr></thead>
          <tbody>{rows.map((r) => (
            <tr key={r.label} className="border-t border-line/60 hover:bg-canvas/40">
              <td className="px-3 py-2 font-bold">{r.label}</td>
              <td className={cn("px-3 py-2 text-right font-bold tabular-nums", r.net >= 0 ? "text-success" : "text-danger")}>{money(r.net, { sign: true })}</td>
              <td className="px-3 py-2 text-right tabular-nums">{r.trades}</td>
              <td className="px-3 py-2 text-right tabular-nums">{fmtPct(r.winRate)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{r.avg != null ? money(r.avg, { sign: true }) : "--"}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </Card>
  );
}

export function AnalyticsView() {
  const tok = () => clientGetToken() ?? undefined;
  const [tab, setTab] = useState<TabId>("pulse");
  const [filters, setFilters] = useState<RpFilters>({});
  const [symbols, setSymbols] = useState<string[]>([]);
  const [playbooks, setPlaybooks] = useState<string[]>([]);
  const [data, setData] = useState<AnalyticsOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [attrDim, setAttrDim] = useState(0);

  useEffect(() => {
    let alive = true;
    api.trades.log({ limit: 500 }, tok()).then((r: any) => {
      if (!alive) return;
      const list = Array.isArray(r?.rows) ? r.rows : Array.isArray(r?.items) ? r.items : Array.isArray(r) ? r : [];
      setSymbols(Array.from(new Set(list.map((t: any) => t?.symbol).filter(Boolean))) as string[]);
    }).catch(() => {});
    api.playbooks.list("mine", tok()).catch(() => api.playbooks.list("my", tok())).then((r: any) => {
      if (alive) setPlaybooks((Array.isArray(r) ? r : []).map((p: any) => String(p.name)).filter(Boolean));
    }).catch(() => {});
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    let alive = true; setLoading(true);
    api.analytics.summary(filters, tok()).then((d) => { if (alive) setData(d); }).catch(() => {}).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [filters]);

  const topSymbols = useMemo(() => (data?.symbols || []).slice(0, 5).map((s) => s.label), [data]);
  const symbolMonthlyData = useMemo(() => (data?.symbolMonthly || []).map((sm) => ({ month: sm.month, ...(sm.values as Record<string, number>) })), [data]);
  const fanData = useMemo(() => (data?.monteCarlo?.band || []).map((b) => ({ step: b.step + 1, p05: b.p05, p25: b.p25, p50: b.p50, p75: b.p75, p95: b.p95 })), [data]);
  const regimeMap = useMemo(() => {
    const m = new Map<string, number>(); (data?.regime?.cells || []).forEach((c) => m.set(c.frm + ">" + c.to, c.prob)); return m;
  }, [data]);
  const attrItems = data?.attribution?.dims?.[attrDim]?.items || [];

  function updateFilter(patch: Partial<RpFilters>) { setFilters((f) => ({ ...f, ...patch })); }
  function clearFilters() { setFilters({}); }
  const hasFilters = Boolean(filters.start || filters.end || filters.symbols?.length || filters.playbooks?.length || filters.sides?.length);

  return (
    <div className="flex flex-col gap-5">
      <style>{`@keyframes anaShift{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}`}</style>

      {/* HERO */}
      <div className="relative overflow-hidden rounded-card border border-line p-6 text-white shadow-card"
        style={{ background: "linear-gradient(120deg,#6D5DE7 0%,#4F46E5 40%,#0EA5E9 75%,#14B8A6 100%)", backgroundSize: "200% 200%", animation: "anaShift 14s ease infinite" }}>
        <div className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute bottom-0 left-1/3 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-white/80"><Sparkles size={14} />Analytics Intelligence</p>
            <h1 className="mt-1 text-3xl font-black leading-tight">Your trading edge, decoded</h1>
            <p className="mt-2 max-w-2xl text-[12px] leading-relaxed text-white/85">
              Equity &amp; drawdown behavior, Monte&nbsp;Carlo sequence risk, Markov regime/tilt detection, P&amp;L attribution,
              timing intelligence and an auto-written narrative — all computed live from your closed trades. Rule-based, never fabricated.
            </p>
          </div>
          <div className="rounded-card border border-white/20 bg-white/10 px-5 py-4 backdrop-blur">
            <p className="text-[10px] font-bold uppercase tracking-wide text-white/70">Closed Trades</p>
            <p className="text-3xl font-black tabular-nums">{data?.meta?.trades ?? 0}</p>
            <p className="text-[10px] text-white/75">{data?.meta?.days ?? 0} trading days analyzed</p>
          </div>
        </div>
      </div>

      {/* FILTERS */}
      <Card className="flex flex-wrap items-center gap-2 p-3">
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase text-ink-mute"><Filter size={12} />Filters</div>
        <Input type="date" className="h-8 w-36 text-[11px]" value={filters.start || ""} onChange={(e) => updateFilter({ start: e.target.value || undefined })} />
        <span className="text-ink-mute">→</span>
        <Input type="date" className="h-8 w-36 text-[11px]" value={filters.end || ""} onChange={(e) => updateFilter({ end: e.target.value || undefined })} />
        <Select className="h-8 w-36 text-[11px]" value={(filters.symbols || [])[0] || ""} onChange={(e) => updateFilter({ symbols: e.target.value ? [e.target.value] : undefined })}>
          <option value="">All symbols</option>{symbols.map((s) => <option key={s} value={s}>{s}</option>)}
        </Select>
        <Select className="h-8 w-44 text-[11px]" value={(filters.playbooks || [])[0] || ""} onChange={(e) => updateFilter({ playbooks: e.target.value ? [e.target.value] : undefined })}>
          <option value="">All playbooks</option>{playbooks.map((p) => <option key={p} value={p}>{p}</option>)}
        </Select>
        <Select className="h-8 w-28 text-[11px]" value={(filters.sides || [])[0] || ""} onChange={(e) => updateFilter({ sides: e.target.value ? [e.target.value] : undefined })}>
          <option value="">Any side</option><option value="long">Long</option><option value="short">Short</option>
        </Select>
        {hasFilters && <Button variant="outline" size="sm" onClick={clearFilters}><X size={12} />Clear</Button>}
      </Card>

      {/* TABS */}
      <div className="flex flex-wrap items-center gap-1 border-b border-line">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={cn("flex items-center gap-2 px-3 py-2 text-[12px] font-bold transition-colors", tab === t.id ? "border-b-2 border-primary-500 text-primary-600" : "text-ink-mute hover:text-ink-soft")}>
            <t.Icon size={14} />{t.label}
          </button>
        ))}
      </div>

      {loading && !data && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-5">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-card border border-line bg-canvas/60" />
          ))}
        </div>
      )}

      {data && (
        <>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-5">
            {data.kpis.slice(0, 10).map((k) => <KpiTile key={k.label} label={k.label} value={k.value} sub={k.sub} tone={k.tone} />)}
          </div>

          {tab === "pulse" && (
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
              <Card className="p-4 xl:col-span-2">
                <SectionTitle icon={TrendingUp} title="Equity Curve" sub="Cumulative realized P&L with drawdown overlay" />
                <div className="h-[320px]">
                  {data.equity.length ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={data.equity} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <defs><linearGradient id="eqG" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#12B981" stopOpacity={0.35} /><stop offset="100%" stopColor="#12B981" stopOpacity={0.02} /></linearGradient></defs>
                        <CartesianGrid stroke="#F1F2F8" vertical={false} />
                        <XAxis dataKey="t" tick={{ fontSize: 10, fill: "#9AA0B4" }} minTickGap={28} />
                        <YAxis yAxisId="l" tick={{ fontSize: 10 }} tickFormatter={(v) => compactMoney(Number(v))} />
                        <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 10 }} tickFormatter={(v) => compactMoney(Number(v))} />
                        <Tooltip formatter={(value: any, name: any) => [money(Number(value), { sign: true }), name]} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Area yAxisId="l" type="monotone" dataKey="equity" name="Cumulative P&L" stroke="#0E9F6E" strokeWidth={2} fill="url(#eqG)" />
                        <Line yAxisId="r" type="monotone" dataKey="drawdown" name="Drawdown" stroke="#E5484D" strokeWidth={1.8} dot={false} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  ) : <EmptyState text="No closed trades in range." />}
                </div>
              </Card>
              <Card className="p-4">
                <SectionTitle icon={Gauge} title="Performance Radar" sub="Normalized 0–100 profile" />
                <div className="h-[320px]">
                  {data.radar.length ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart data={data.radar}>
                        <PolarGrid stroke="#E9EAF3" /><PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: "#667085" }} /><PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                        <Radar dataKey="score" stroke="#6D5DE7" fill="#6D5DE7" fillOpacity={0.35} strokeWidth={2} />
                        <Tooltip formatter={(value: any) => [`${Number(value).toFixed(1)} / 100`, "Score"]} />
                      </RadarChart>
                    </ResponsiveContainer>
                  ) : <EmptyState text="Not enough data for radar scoring." />}
                </div>
              </Card>
              <Card className="p-4 xl:col-span-3">
                <SectionTitle icon={Sparkles} title="Dynamic Insights" sub="Generated from your actual trading behavior" />
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {data.insights.length ? data.insights.map((i, idx) => (
                    <Card key={idx} className={cn("border-l-4 p-4 transition-all hover:-translate-y-0.5 hover:shadow-card", toneBorder(i.tone))}>
                      <p className="text-[11px] font-black uppercase text-ink-soft">{i.title}</p>
                      <p className="mt-1 text-[12px] leading-relaxed text-ink-soft">{i.text}</p>
                    </Card>
                  )) : <EmptyState text="Insights appear once you have enough closed trades." />}
                </div>
              </Card>
            </div>
          )}

          {tab === "equity" && (
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
              <Card className="p-4 xl:col-span-2">
                <SectionTitle icon={TrendingUp} title="Monthly Performance" sub="Net P&L by month" />
                <div className="h-[300px]">
                  {data.monthly.length ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.monthly} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <CartesianGrid stroke="#F1F2F8" vertical={false} /><XAxis dataKey="label" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => compactMoney(Number(v))} />
                        <Tooltip formatter={(value: any) => [money(Number(value), { sign: true }), "Net P&L"]} />
                        <Bar dataKey="net" radius={[6, 6, 0, 0]}>{data.monthly.map((m, i) => <Cell key={i} fill={m.net >= 0 ? "#12B981" : "#E5484D"} />)}</Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : <EmptyState text="No monthly data." />}
                </div>
              </Card>
              <Card className="p-4">
                <SectionTitle icon={Activity} title="Streak Intelligence" sub="Consecutive positive / negative days" />
                <div className="space-y-3">
                  <KpiTile label="Max Winning Streak" value={`${data.streaks.maxWin}`} sub="days" tone="pos" />
                  <KpiTile label="Max Losing Streak" value={`${data.streaks.maxLoss}`} sub="days" tone="neg" />
                  <KpiTile label="Current Streak" value={`${data.streaks.current}`} sub={data.streaks.currentType} tone={data.streaks.currentType === "win" ? "pos" : data.streaks.currentType === "loss" ? "neg" : null} />
                </div>
              </Card>
              <Card className="p-4 xl:col-span-3">
                <SectionTitle icon={BarChart3} title="Daily P&L Distribution" sub="Trade outcome clustering" />
                <div className="h-[280px]">
                  {data.distribution.length ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.distribution} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <CartesianGrid stroke="#F1F2F8" vertical={false} /><XAxis dataKey="label" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} /><Tooltip />
                        <Bar dataKey="count" radius={[6, 6, 0, 0]}>{data.distribution.map((d, i) => <Cell key={i} fill={distColor(d.label)} />)}</Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : <EmptyState text="No distribution data." />}
                </div>
              </Card>
            </div>
          )}

          {tab === "edge" && (
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <BucketTable title="Symbol Edge" rows={data.symbols} emptyText="No symbol data yet." />
              <BucketTable title="Playbook Edge" rows={data.playbooks} emptyText="Playbook analytics light up once trades are linked to playbooks." />
              <Card className="p-4 xl:col-span-2">
                <SectionTitle icon={Layers} title="Top Symbols by Month" sub="Stacked monthly contribution from your best 5 symbols" />
                <div className="h-[320px]">
                  {symbolMonthlyData.length && topSymbols.length ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={symbolMonthlyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <CartesianGrid stroke="#F1F2F8" vertical={false} /><XAxis dataKey="month" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => compactMoney(Number(v))} />
                        <Tooltip formatter={(value: any, name: any) => [money(Number(value), { sign: true }), name]} /><Legend wrapperStyle={{ fontSize: 11 }} />
                        {topSymbols.map((s, i) => <Bar key={s} dataKey={s} stackId="a" fill={COLORS[i % COLORS.length]} radius={i === topSymbols.length - 1 ? [6, 6, 0, 0] : undefined} />)}
                      </BarChart>
                    </ResponsiveContainer>
                  ) : <EmptyState text="Not enough symbol-month data." />}
                </div>
              </Card>
            </div>
          )}

          {tab === "timing" && (
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <Card className="p-4">
                <SectionTitle icon={Clock} title="Hour of Day" sub="When your edge is strongest / weakest" />
                <div className="h-[280px]">
                  {data.hours.length ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.hours} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <CartesianGrid stroke="#F1F2F8" vertical={false} /><XAxis dataKey="label" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => compactMoney(Number(v))} />
                        <Tooltip formatter={(value: any) => [money(Number(value), { sign: true }), "Net P&L"]} />
                        <Bar dataKey="net" radius={[6, 6, 0, 0]}>{data.hours.map((h, i) => <Cell key={i} fill={h.net >= 0 ? "#12B981" : "#E5484D"} />)}</Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : <EmptyState text="No hourly data." />}
                </div>
              </Card>
              <Card className="p-4">
                <SectionTitle icon={Target} title="Day of Week" sub="Weekly rhythm of performance" />
                <div className="h-[280px]">
                  {data.dows.length ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.dows} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <CartesianGrid stroke="#F1F2F8" vertical={false} /><XAxis dataKey="label" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => compactMoney(Number(v))} />
                        <Tooltip formatter={(value: any) => [money(Number(value), { sign: true }), "Net P&L"]} />
                        <Bar dataKey="net" radius={[6, 6, 0, 0]}>{data.dows.map((d, i) => <Cell key={i} fill={d.net >= 0 ? "#12B981" : "#E5484D"} />)}</Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : <EmptyState text="No weekday data." />}
                </div>
              </Card>
              <BucketTable title="Trade Duration Buckets" rows={data.durations} emptyText="No duration data yet." />
              <Card className="p-4">
                <SectionTitle icon={Activity} title="Hold Time vs Outcome" sub="Scatter of trade duration vs net P&L" />
                <div className="h-[280px]">
                  {data.scatter.length ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <ScatterChart margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <CartesianGrid stroke="#F1F2F8" /><XAxis dataKey="x" type="number" name="Hold" unit="m" tick={{ fontSize: 10 }} /><YAxis dataKey="y" type="number" name="Net P&L" tick={{ fontSize: 10 }} tickFormatter={(v) => compactMoney(Number(v))} />
                        <Tooltip formatter={(value: any, name: any) => [name === "Net P&L" ? money(Number(value), { sign: true }) : value, name]} />
                        <Scatter data={data.scatter}>{data.scatter.map((p, i) => <Cell key={i} fill={p.tone === "win" ? "#12B981" : p.tone === "loss" ? "#E5484D" : "#9AA0B4"} />)}</Scatter>
                      </ScatterChart>
                    </ResponsiveContainer>
                  ) : <EmptyState text="No scatter data." />}
                </div>
              </Card>
            </div>
          )}

          {tab === "risk" && (
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
              <Card className="p-4 xl:col-span-2">
                <SectionTitle icon={Shield} title="Drawdown Profile" sub="Equity vs underwater behavior" />
                <div className="h-[320px]">
                  {data.equity.length ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={data.equity} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <defs><linearGradient id="ddG" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#E5484D" stopOpacity={0.05} /><stop offset="100%" stopColor="#E5484D" stopOpacity={0.35} /></linearGradient></defs>
                        <CartesianGrid stroke="#F1F2F8" vertical={false} /><XAxis dataKey="t" tick={{ fontSize: 10 }} minTickGap={28} />
                        <YAxis yAxisId="l" tick={{ fontSize: 10 }} tickFormatter={(v) => compactMoney(Number(v))} /><YAxis yAxisId="r" orientation="right" tick={{ fontSize: 10 }} tickFormatter={(v) => compactMoney(Number(v))} />
                        <Tooltip formatter={(value: any, name: any) => [money(Number(value), { sign: true }), name]} /><Legend wrapperStyle={{ fontSize: 11 }} />
                        <Area yAxisId="r" type="monotone" dataKey="drawdown" name="Drawdown" stroke="#E5484D" fill="url(#ddG)" strokeWidth={1.8} />
                        <Line yAxisId="l" type="monotone" dataKey="equity" name="Equity" stroke="#12B981" strokeWidth={2} dot={false} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  ) : <EmptyState text="No drawdown data." />}
                </div>
              </Card>
              <Card className="p-4">
                <SectionTitle icon={Gauge} title="Risk KPIs" sub="Selected advanced metrics" />
                <div className="space-y-3">
                  {data.kpis.filter((k) => ["Max Drawdown", "Recovery Factor", "Sharpe Proxy", "Consistency", "Profit Factor"].includes(k.label)).map((k) => <KpiTile key={k.label} label={k.label} value={k.value} sub={k.sub} tone={k.tone} />)}
                </div>
              </Card>
              <Card className="p-4 xl:col-span-3">
                <SectionTitle icon={Activity} title="Outcome Clustering" sub="Distribution of trade results across P&L bands" />
                <div className="h-[280px]">
                  {data.distribution.length ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.distribution} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <CartesianGrid stroke="#F1F2F8" vertical={false} /><XAxis dataKey="label" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} /><Tooltip />
                        <Bar dataKey="count" radius={[6, 6, 0, 0]}>{data.distribution.map((d, i) => <Cell key={i} fill={distColor(d.label)} />)}</Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : <EmptyState text="No distribution data." />}
                </div>
              </Card>
            </div>
          )}

          {tab === "simulate" && (
            data.monteCarlo ? (
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
                <Card className="p-4 xl:col-span-2">
                  <SectionTitle icon={Dices} title="Monte Carlo Equity Fan" sub={`${data.monteCarlo.sims.toLocaleString()} re-orderings of your own trade set · 5–95% confidence band`} />
                  <div className="h-[340px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={fanData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <CartesianGrid stroke="#F1F2F8" vertical={false} />
                        <XAxis dataKey="step" tick={{ fontSize: 10 }} tickFormatter={(v) => `#${v}`} /><YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => compactMoney(Number(v))} />
                        <Tooltip formatter={(value: any, name: any) => [money(Number(value), { sign: true }), name]} /><Legend wrapperStyle={{ fontSize: 11 }} />
                        <Area type="monotone" dataKey="p95" name="95th pct" stroke="none" fill="#6D5DE7" fillOpacity={0.08} />
                        <Area type="monotone" dataKey="p75" name="75th pct" stroke="none" fill="#6D5DE7" fillOpacity={0.12} />
                        <Area type="monotone" dataKey="p25" name="25th pct" stroke="none" fill="#6D5DE7" fillOpacity={0.12} />
                        <Area type="monotone" dataKey="p05" name="5th pct" stroke="none" fill="#E5484D" fillOpacity={0.10} />
                        <Line type="monotone" dataKey="p50" name="Median path" stroke="#4F46E5" strokeWidth={2.2} dot={false} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
                <Card className="p-4">
                  <SectionTitle icon={Shield} title="Sequence Risk" sub="What luck, not skill, could do" />
                  <div className="space-y-3">
                    <KpiTile label="P(path < 0)" value={`${data.monteCarlo.probNegative}%`} sub="dipped below zero" tone={data.monteCarlo.probNegative >= 50 ? "neg" : "warn"} />
                    <KpiTile label="95% Worst Drawdown" value={money(data.monteCarlo.worstDd95, { sign: true })} sub="tail risk" tone="neg" />
                    <KpiTile label="Median Ending" value={money(data.monteCarlo.medianFinal, { sign: true })} sub="typical re-order" tone={data.monteCarlo.medianFinal >= 0 ? "pos" : "neg"} />
                    <KpiTile label="Expected Ending" value={money(data.monteCarlo.expectedFinal, { sign: true })} sub="mean of sims" tone={data.monteCarlo.expectedFinal >= 0 ? "pos" : "neg"} />
                  </div>
                </Card>
                <Card className="p-4 xl:col-span-3">
                  <SectionTitle icon={Activity} title="Drawdown Distribution" sub="How often each worst-case pullback depth occurs across simulations" />
                  <div className="h-[260px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.monteCarlo.ddHist} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <CartesianGrid stroke="#F1F2F8" vertical={false} /><XAxis dataKey="label" tick={{ fontSize: 9 }} /><YAxis tick={{ fontSize: 10 }} />
                        <Tooltip /><Bar dataKey="count" radius={[6, 6, 0, 0]} fill="#E5484D" fillOpacity={0.8} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
              </div>
            ) : <Card className="p-10 text-center text-[12px] text-ink-mute">Monte Carlo needs at least 8 closed trades in range.</Card>
          )}

          {tab === "regime" && (
            data.regime ? (
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
                <Card className="p-4 xl:col-span-2">
                  <SectionTitle icon={Brain} title="Transition Matrix" sub="Probability the next trade is W/L/B given the current one" />
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-[11px]">
                      <thead><tr><th className="px-2 py-1.5 text-left text-ink-mute">after ↓ / next →</th>{data.regime.states.map((s) => <th key={s} className="px-2 py-1.5 text-center font-black text-ink-soft">{s === "W" ? "Win" : s === "L" ? "Loss" : "BE"}</th>)}</tr></thead>
                      <tbody>
                        {data.regime.states.map((fr) => (
                          <tr key={fr}>
                            <td className="px-2 py-1.5 font-black text-ink-soft">{fr === "W" ? "After Win" : fr === "L" ? "After Loss" : "After BE"}</td>
                            {data.regime!.states.map((to) => {
                              const p = regimeMap.get(fr + ">" + to) ?? 0;
                              const cell = data.regime!.cells.find((c) => c.frm === fr && c.to === to);
                              return <td key={to} className="px-1 py-1 text-center tabular-nums" style={{ background: probColor(p) }} title={`${cell?.count ?? 0} transitions`}>{p}%</td>;
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
                <Card className="p-4">
                  <SectionTitle icon={Gauge} title="Conditional Expectancy" sub="Avg P&L of the trade AFTER each state" />
                  <div className="h-[180px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={[{ name: "After Win", v: data.regime.afterWinExp ?? 0 }, { name: "After Loss", v: data.regime.afterLossExp ?? 0 }]} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <CartesianGrid stroke="#F1F2F8" vertical={false} /><XAxis dataKey="name" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => compactMoney(Number(v))} />
                        <Tooltip formatter={(value: any) => [money(Number(value), { sign: true }), "Expectancy"]} />
                        <Bar dataKey="v" radius={[6, 6, 0, 0]}>{[{ fill: "#12B981" }, { fill: "#E5484D" }].map((c, i) => <Cell key={i} fill={c.fill} />)}</Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <Card className={cn("mt-3 border-l-4 p-3", toneBorder((data.regime.tiltScore ?? 0) < 0 ? "neg" : "pos"))}>
                    <p className="text-[10px] font-black uppercase text-ink-mute">Tilt score {data.regime.tiltScore != null ? data.regime.tiltScore.toFixed(2) : "--"}</p>
                    <p className="mt-1 text-[11px] leading-relaxed text-ink-soft">{data.regime.verdict}</p>
                  </Card>
                </Card>
              </div>
            ) : <Card className="p-10 text-center text-[12px] text-ink-mute">Regime model needs at least 12 consecutive closed trades in range.</Card>
          )}

          {tab === "attribution" && (
            data.attribution && data.attribution.dims.length ? (
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <Card className="p-4 xl:col-span-2">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <SectionTitle icon={Waves} title="P&L Attribution" sub="Which buckets actually move your total" />
                    <div className="flex flex-wrap gap-1">
                      {data.attribution.dims.map((d, i) => (
                        <button key={d.dimension} onClick={() => setAttrDim(i)} className={cn("rounded px-2.5 py-1 text-[10px] font-bold", attrDim === i ? "bg-primary-500 text-white" : "bg-canvas text-ink-soft hover:bg-primary-50")}>{d.label}</button>
                      ))}
                    </div>
                  </div>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={attrItems} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
                        <CartesianGrid stroke="#F1F2F8" horizontal={false} /><XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => compactMoney(Number(v))} />
                        <YAxis type="category" dataKey="label" width={90} tick={{ fontSize: 10 }} />
                        <Tooltip formatter={(value: any, name: any) => [name === "value" ? money(Number(value), { sign: true }) : value, name]} />
                        <Bar dataKey="value" radius={[0, 6, 6, 0]}>{attrItems.map((it, i) => <Cell key={i} fill={it.value >= 0 ? "#12B981" : "#E5484D"} />)}</Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
                <Card className="p-4 xl:col-span-2">
                  <SectionTitle icon={BarChart3} title="Contribution Waterfall" sub="Bridge from 0 to total via your biggest symbol contributors" />
                  <div className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.attribution.waterfall} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <CartesianGrid stroke="#F1F2F8" vertical={false} /><XAxis dataKey="label" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => compactMoney(Number(v))} />
                        <Tooltip formatter={(value: any, name: any) => [name === "delta" ? money(Number(value), { sign: true }) : value, name]} />
                        <Bar dataKey="base" stackId="w" fill="transparent" />
                        <Bar dataKey="height" stackId="w" radius={[4, 4, 0, 0]}>{data.attribution.waterfall.map((w, i) => <Cell key={i} fill={w.positive ? "#12B981" : "#E5484D"} />)}</Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
                <Card className="p-4 xl:col-span-2">
                  <SectionTitle icon={Layers} title="Expectancy Delta" sub="Each bucket's per-trade edge vs your overall average (positive = adds edge)" />
                  <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-4">
                    {attrItems.map((it) => (
                      <div key={it.label} className="rounded-card border border-line p-2.5">
                        <p className="truncate text-[11px] font-bold">{it.label}</p>
                        <p className={cn("text-[13px] font-black tabular-nums", (it.expDelta ?? 0) >= 0 ? "text-success" : "text-danger")}>{it.expDelta != null ? money(it.expDelta, { sign: true }) : "--"}</p>
                        <p className="text-[9px] text-ink-mute">{it.share}% of total · {money(it.value, { sign: true }) }</p>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            ) : <Card className="p-10 text-center text-[12px] text-ink-mute">No attribution data in range.</Card>
          )}

          {tab === "narrative" && (
            <Card className="p-6">
              <div className="mb-4 flex items-center justify-between">
                <SectionTitle icon={Copy} title="Auto-Written Report" sub="Rule-based narrative from your metrics — not an AI hallucination" />
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => navigator.clipboard?.writeText(data.narrative.map((b) => `${b.heading}\n${b.body}`).join("\n\n"))}><Copy size={12} />Copy</Button>
                  <Button variant="outline" size="sm" onClick={() => window.print()}><Printer size={12} />Print</Button>
                </div>
              </div>
              <article className="mx-auto max-w-3xl space-y-5">
                {data.narrative.map((b, i) => (
                  <section key={i} className={cn("border-l-4 pl-4", toneBorder(b.tone))}>
                    <h3 className="text-[13px] font-black uppercase tracking-wide text-ink">{b.heading}</h3>
                    <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">{b.body}</p>
                  </section>
                ))}
              </article>
            </Card>
          )}
        </>
      )}
    </div>
  );
}