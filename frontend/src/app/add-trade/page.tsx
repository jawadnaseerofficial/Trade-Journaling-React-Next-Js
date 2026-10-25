import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { AddTradeView } from "@/components/add-trade/add-trade-view";
import { api } from "@/lib/api";
import { serverToken } from "@/lib/auth-server";

export default async function AddTradePage() {
  const token = serverToken();
  if (!token) redirect("/login");
  const accounts = await api.accounts.list(token).catch(() => []);
  return (
    <AppShell title="Add Trade">
      <AddTradeView accounts={accounts} />
    </AppShell>
  );
}