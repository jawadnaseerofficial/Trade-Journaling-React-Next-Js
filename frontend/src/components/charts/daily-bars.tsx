"use client";
import {
  Bar, BarChart, CartesianGrid, Cell, ReferenceLine,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { AXIS_TICK, moneyTick } from "./chart-theme";
import type { DailyPnl } from "@/types";

export function DailyBars({ data }: { data: DailyPnl[] }) {
  return (
    <ResponsiveContainer width="100%" height={210}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -14, bottom: 0 }} barSize={14}>
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
          cursor={{ fill: "rgba(109,93,231,.05)" }}
          formatter={(v) => [moneyTick(Number(v)), "Net P&L"]}
          contentStyle={{ borderRadius: 8, border: "1px solid #E9EAF3", fontSize: 11 }}
        />
        <ReferenceLine y={0} stroke="#9AA0B4" strokeDasharray="4 4" />
        <Bar dataKey="pnl" radius={[2, 2, 0, 0]}>
          {data.map((d) => (
            <Cell key={d.date} fill={d.pnl >= 0 ? "#4CD6A4" : "#F08C8C"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}