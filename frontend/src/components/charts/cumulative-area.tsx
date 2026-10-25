"use client";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AXIS_TICK, moneyTick } from "./chart-theme";
import type { CumulativePoint } from "@/types";

export function CumulativeArea({ data }: { data: CumulativePoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={210}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
        <defs>
          <linearGradient id="cumFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#34D399" stopOpacity={0.55} />
            <stop offset="100%" stopColor="#34D399" stopOpacity={0.04} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="#EEF0F7" />
        <XAxis dataKey="date" tick={AXIS_TICK} axisLine={false} tickLine={false} />
        <YAxis
          domain={[0, 140]}
          ticks={[0, 20, 40, 60, 80, 100, 120, 140]}
          tick={AXIS_TICK}
          tickFormatter={moneyTick}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          formatter={(v) => [moneyTick(Number(v)), "Cumulative P&L"]}
          contentStyle={{ borderRadius: 8, border: "1px solid #E9EAF3", fontSize: 11 }}
        />
        <Area type="linear" dataKey="value" stroke="#5A49D6" strokeWidth={1.6} fill="url(#cumFill)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}