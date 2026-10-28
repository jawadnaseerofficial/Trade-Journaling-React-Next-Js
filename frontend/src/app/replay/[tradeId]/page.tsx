import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { ReplayView } from "@/components/replay/replay-view";
import { api } from "@/lib/api";
import { serverToken } from "@/lib/auth-server";

export default async function ReplayTradePage({ params }: { params: { tradeId: string } }) {
  const token = serverToken();
  if (!token) redirect("/login");
  const data = await api.trades.replay(params.tradeId, "1m", token).catch(() => null);
  return (
    <AppShell title="Tracking">
      <ReplayView initial={data} tradeId={params.tradeId} day={null} />
    </AppShell>
  );
}