import type { ReactNode } from "react";
import { Wallet, Target } from "lucide-react";
import { Card } from "@/components/ui/card";
import { InfoHint } from "@/components/ui/info-hint";
import { Money } from "@/components/ui/money";
import { DonutRing, WinGauge, RatioBar } from "./kpi-accessories";
import { money, pct } from "@/lib/utils";
import type { KpiSummary } from "@/types";

function KpiCard({
  label, hint, children, accessory,
}: { label: string; hint: string; children: ReactNode; accessory?: ReactNode }) {
  return (
    <Card className="flex items-start justify-between p-4">
      <div>
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-semibold text-ink-soft">{label}</span>
          <InfoHint text={hint} />
        </div>
        <div className="mt-2 text-xl font-extrabold tabular-nums">{children}</div>
      </div>
      {accessory}
    </Card>
  );
}

const IconChip = ({ className, children }: { className: string; children: ReactNode }) => (
  <span className={`grid h-7 w-7 place-items-center rounded-lg ${className}`}>{children}</span>
);

export function KpiStrip({ kpi }: { kpi: KpiSummary }) {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
      <KpiCard label="Net P&L" hint="Total realized P&L for the period"
        accessory={<IconChip className="bg-primary-50 text-primary-500"><Wallet size={14} /></IconChip>}>
        <Money value={kpi.netPnl} />
      </KpiCard>

      <KpiCard label="Trade Expectancy" hint="Average expected P&L per trade"
        accessory={<IconChip className="bg-sky-50 text-sky-500"><Target size={14} /></IconChip>}>
        {money(kpi.tradeExpectancy)}
      </KpiCard>

      <KpiCard label="Profit Factor" hint="Gross profit / gross loss" accessory={<DonutRing winRate={kpi.winRate} />}>
        {kpi.profitFactor.toFixed(2)}
      </KpiCard>

      <KpiCard label="Trade Win %" hint="Winning trades / all trades" accessory={<WinGauge winRate={kpi.winRate} />}>
        {pct(kpi.winRate)}
      </KpiCard>

      <KpiCard label="Avg win/loss trade" hint="Average win size vs average loss size"
        accessory={<RatioBar avgWin={kpi.avgWin} avgLoss={kpi.avgLoss} />}>
        {(kpi.avgWin / Math.abs(kpi.avgLoss)).toFixed(2)}
      </KpiCard>
    </div>
  );
}