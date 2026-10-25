import { Import, Pencil, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { KpiStrip } from "./kpi-strip";
import { RecentTrades } from "./recent-trades";
import { TradingCalendar } from "./trading-calendar";
import { ScoreRadar } from "@/components/charts/score-radar";
import { CumulativeArea } from "@/components/charts/cumulative-area";
import { DailyBars } from "@/components/charts/daily-bars";
import type { DashboardData } from "@/types";

export function DashboardView({ data, greeting }: { data: DashboardData; greeting: string }) {
  const lastImport = data.lastImportAt
    ? new Date(data.lastImportAt).toLocaleString("en-US", {
        month: "short", day: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
      })
    : "never";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-bold">{greeting}</h2>
        <div className="flex items-center gap-2.5">
          <span className="flex items-center gap-1.5 text-[10px] font-medium text-ink-mute">
            <RefreshCw size={11} /> Last import was made: {lastImport}
          </span>
          <Button variant="outline" size="sm"><Pencil size={12} /> Edit Widgets</Button>
          <Button size="sm"><Import size={12} /> Import trades</Button>
        </div>
      </div>

      <KpiStrip kpi={data.kpi} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader title="Trader Score" hint="Composite performance score" right={<Badge>Beta</Badge>} />
          <ScoreRadar axes={data.score.axes} />
          <p className="pb-4 text-center text-[11px] font-semibold text-ink-soft">
            Your Score: <span className="text-sm font-extrabold text-success">{data.score.value}</span>
          </p>
        </Card>
        <Card>
          <CardHeader title="Daily Net Cumulative P&L" hint="Running total of realized P&L" />
          <div className="px-2 pb-4"><CumulativeArea data={data.cumulative} /></div>
        </Card>
        <Card>
          <CardHeader title="Net Daily P&L" hint="Realized P&L per day" />
          <div className="px-2 pb-4"><DailyBars data={data.daily} /></div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <RecentTrades recent={data.recentTrades} open={data.openPositions} />
        <div className="lg:col-span-2">
          <TradingCalendar initial={data.calendar} />
        </div>
      </div>
    </div>
  );
}