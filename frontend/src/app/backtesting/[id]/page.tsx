import { redirect } from "next/navigation";
import { RunnerView } from "@/components/backtest/runner-view";
import { ApiError, api } from "@/lib/api";
import { serverToken } from "@/lib/auth-server";

export default async function BacktestRunnerPage({ params }: { params: { id: string } }) {
  const token = serverToken();
  if (!token) redirect("/login");
  try {
    const run = await api.backtests.run(params.id, token);
    return <RunnerView initial={run} />;   // full-bleed: no AppShell, like Replay-Live
  } catch (e) {
    if (e instanceof ApiError && (e.status === 401 || e.status === 403)) redirect("/login");
    redirect("/backtesting");
  }
}