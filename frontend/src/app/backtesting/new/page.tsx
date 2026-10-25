import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { CreateSessionForm } from "@/components/backtest/create-session-form";
import { api } from "@/lib/api";
import { serverToken } from "@/lib/auth-server";

export default async function NewBacktestPage() {
  const token = serverToken();
  if (!token) redirect("/login");
  const pbs = await api.playbooks.withRules(token).catch(() => []);
  return (
    <AppShell title="Backtesting">
      <p className="mb-3 text-[11px] font-semibold text-ink-soft">Backtesting / <span className="font-bold text-ink">Create new session</span></p>
      <CreateSessionForm playbooks={pbs} />
    </AppShell>
  );
}