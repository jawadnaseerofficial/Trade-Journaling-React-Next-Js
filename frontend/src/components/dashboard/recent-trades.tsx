"use client";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Tabs } from "@/components/ui/tabs";
import { Money } from "@/components/ui/money";
import type { TradeRow } from "@/types";

function TradeTable({ rows }: { rows: TradeRow[] }) {
  return (
    <table className="w-full text-left">
      <thead>
        <tr className="bg-primary-50/60 text-[10px] font-bold text-ink-soft">
          <th className="px-4 py-2">Close Date</th>
          <th className="px-4 py-2">Symbol</th>
          <th className="px-4 py-2 text-right">Net P&L</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((t) => (
          <tr key={t.id} className="border-t border-line text-[11px] hover:bg-canvas/60">
            <td className="px-4 py-2.5 text-ink-soft">{t.closeDate}</td>
            <td className="px-4 py-2.5 font-semibold">{t.symbol}</td>
            <td className="px-4 py-2.5 text-right"><Money value={t.netPnl} /></td>
          </tr>
        ))}
        {rows.length === 0 && (
          <tr><td colSpan={3} className="px-4 py-6 text-center text-[11px] text-ink-mute">No trades yet</td></tr>
        )}
      </tbody>
    </table>
  );
}

export function RecentTrades({ recent, open }: { recent: TradeRow[]; open: TradeRow[] }) {
  const [tab, setTab] = useState("recent");
  return (
    <Card className="overflow-hidden">
      <Tabs
        items={[{ id: "recent", label: "Recent Trades" }, { id: "open", label: "Open Positions" }]}
        active={tab}
        onChange={setTab}
      />
      <TradeTable rows={tab === "recent" ? recent : open} />
    </Card>
  );
}