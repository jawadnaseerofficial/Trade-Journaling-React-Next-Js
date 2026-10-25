"use client";
import { Area, AreaChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { money } from "@/lib/utils";
import type { RunningPoint } from "@/types";

const fmt = (t: number) => new Date(t * 1000).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });

export function RunningPnlChart({ series }: { series: RunningPoint[] }) {
  const data = series.map((p) => ({ t: fmt(p.time), pnl: p.pnl }));
  const last = data.at(-1)?.pnl ?? 0;
  const pos = last >= 0;
  return (
    <div className="h-44 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
          <defs><linearGradient id="runFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={pos ? "#34D399" : "#F87171"} stopOpacity={0.45} /><stop offset="100%" stopColor={pos ? "#34D399" : "#F87171"} stopOpacity={0.03} /></linearGradient></defs>
          <XAxis dataKey="t" tick={{ fontSize: 9, fill: "#9AA0B4" }} interval="preserveStartEnd" minTickGap={40} />
          <YAxis tick={{ fontSize: 9, fill: "#9AA0B4" }} width={52} tickFormatter={(v) => money(v)} domain={["auto", "auto"]} />
          <ReferenceLine y={0} stroke="#9AA0B4" strokeDasharray="4 4" />
          <Tooltip formatter={(v) => [money(Number(v)), "Running P&L"]} contentStyle={{ borderRadius: 8, border: "1px solid #E9EAF3", fontSize: 11 }} labelStyle={{ fontSize: 10 }} />
          <Area type="monotone" dataKey="pnl" stroke={pos ? "#12B981" : "#E5484D"} strokeWidth={1.6} fill="url(#runFill)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}