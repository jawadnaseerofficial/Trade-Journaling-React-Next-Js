import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { SessionsView } from "@/components/backtest/sessions-view";
import { api } from "@/lib/api";
import { serverToken } from "@/lib/auth-server";

export default async function BacktestingPage() {
  const token = serverToken();
  if (!token) redirect("/login");
  const list = await api.backtests.list("my", token).catch(() => []);
  return (
    <AppShell title="Backtesting">
      <div className="mb-3 flex items-center gap-2"><h2 className="text-sm font-black">Backtesting</h2></div>
      <SessionsView initial={list} />
    </AppShell>
  );
}