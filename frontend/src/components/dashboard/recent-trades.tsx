"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Tabs } from "@/components/ui/tabs";
import { Money } from "@/components/ui/money";
import { cn } from "@/lib/utils";
import type { TradeRow } from "@/types";

function TradeTable({ rows }: { rows: TradeRow[] }) {
  const router = useRouter();
  return (
    <table className="w-full text-left">
      <thead>
        <tr className="bg-primary-50/60 text-[10px] font-bold text-ink-soft">
          <th className="px-4 py-2">Close Date</th>
          <th className="px-4 py-2">Symbol</th>
          <th className="px-4 py-2 text-right">Net P&L</th>
          <th className="px-4 py-2 text-right">Replay</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((t) => (
          <tr
            key={t.id}
            onClick={(e) => {
              // the inner <Link> is the keyboard/semantic target; ignore its clicks here
              // so a click never fires navigation twice
              if ((e.target as HTMLElement).closest("a")) return;
              router.push(`/replay?trade=${t.id}`);
            }}
            className={cn(
              "cursor-pointer border-t border-line text-[11px] transition-colors hover:bg-canvas/60",
            )}
          >
            <td className="px-4 py-2.5 text-ink-soft">{t.closeDate}</td>
            <td className="px-4 py-2.5 font-semibold">{t.symbol}</td>
            <td className="px-4 py-2.5 text-right"><Money value={t.netPnl} /></td>
            <td className="px-4 py-2.5 text-right">
              <Link
                href={`/replay?trade=${t.id}`}
                className="inline-flex items-center gap-1 rounded-md border border-line px-1.5 py-0.5 text-[10px] font-bold text-ink-soft transition-colors hover:border-primary-300 hover:text-primary-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
              >
                Replay
                <ArrowUpRight size={11} />
              </Link>
            </td>
          </tr>
        ))}
        {rows.length === 0 && (
          <tr><td colSpan={4} className="px-4 py-6 text-center text-[11px] text-ink-mute">No trades yet</td></tr>
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