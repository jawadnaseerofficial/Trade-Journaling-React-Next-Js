import { ReplayLiveView } from "@/components/replay/replay-live-view";

export default function ReplayLivePage({ searchParams }: { searchParams: { trade?: string; day?: string } }) {
  return <ReplayLiveView tradeId={searchParams.trade ?? null} day={searchParams.day ?? null} />;
}