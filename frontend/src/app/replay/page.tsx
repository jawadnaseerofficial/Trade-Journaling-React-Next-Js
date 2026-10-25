import { AppShell } from "@/components/layout/app-shell";
import { ReplayView } from "@/components/replay/replay-view";

export default function ReplayPage({ searchParams }: { searchParams: { trade?: string; day?: string } }) {
  return (
    <AppShell title="Tracking">
      <ReplayView tradeId={searchParams.trade ?? null} day={searchParams.day ?? null} />
    </AppShell>
  );
}