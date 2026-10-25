"use client";
import { PolarAngleAxis, PolarGrid, Radar, RadarChart, ResponsiveContainer } from "recharts";
import type { ScoreAxis } from "@/types";

export function ScoreRadar({ axes }: { axes: ScoreAxis[] }) {
  return (
    <ResponsiveContainer width="100%" height={190}>
      <RadarChart data={axes} outerRadius="72%">
        <PolarGrid gridType="polygon" stroke="#DCD9F8" />
        <PolarAngleAxis dataKey="axis" tick={{ fontSize: 9, fill: "#5D6175", fontWeight: 600 }} />
        <Radar dataKey="value" stroke="#5A49D6" strokeWidth={1.5} fill="#B4ACF5" fillOpacity={0.45} />
      </RadarChart>
    </ResponsiveContainer>
  );
}