"use client";
import { Area, AreaChart, ReferenceDot, ResponsiveContainer, YAxis } from "recharts";
import type { Candle } from "@/types";

const fmt = (t: number) => new Date(t * 1000).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });

export function MiniCandles({ candles, entry, exit }: { candles: Candle[]; entry: number | null; exit: number | null }) {
  const data = candles.map((c) => ({ t: fmt(c.time), c: c.close }));
  const ys = candles.map((c) => c.close);
  const lo = Math.min(...ys, entry ?? Infinity, exit ?? Infinity);
  const hi = Math.max(...ys, entry ?? -Infinity, exit ?? -Infinity);
  const pad = (hi - lo) * 0.1 || 1;
  const pos = (entry != null && exit != null) ? exit >= entry : true;
  return (
    <div className="h-24 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
          <defs><linearGradient id="mcFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={pos ? "#34D399" : "#F87171"} stopOpacity={0.4} /><stop offset="100%" stopColor={pos ? "#34D399" : "#F87171"} stopOpacity={0.02} /></linearGradient></defs>
          <YAxis hide domain={[lo - pad, hi + pad]} />
          <Area type="monotone" dataKey="c" stroke={pos ? "#12B981" : "#E5484D"} strokeWidth={1.4} fill="url(#mcFill)" dot={false} />
          {entry != null && data[0] && <ReferenceDot x={data[0].t} y={entry} r={3} fill="#12B981" stroke="#fff" />}
          {exit != null && data.at(-1) && <ReferenceDot x={data.at(-1)!.t} y={exit} r={3} fill={pos ? "#12B981" : "#E5484D"} stroke="#fff" />}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}