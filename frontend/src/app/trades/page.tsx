import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { TradeLogView } from "@/components/trade-log/trade-log-view";
import { Card } from "@/components/ui/card";
import { ApiError, api } from "@/lib/api";
import { serverToken } from "@/lib/auth-server";
import type { LogPage } from "@/types";

export default async function TradeLogPage() {
  const token = serverToken();
  if (!token) redirect("/login");

  let data: LogPage | null = null;
  let fatal: string | null = null;
  try {
    data = await api.trades.log({ page: 1, per_page: 50, sort: "openDate", direction: "desc" }, token);
  } catch (e) {
    // ONLY a genuine auth failure sends you to /login. A 500/network error must NOT loop you out.
    if (e instanceof ApiError && (e.status === 401 || e.status === 403)) redirect("/login");
    fatal = e instanceof Error ? e.message : "Failed to load trade log";
  }

  const accounts = await api.accounts.list(token).catch(() => []);

  if (!data) {
    return (
      <AppShell title="Trade Log">
        <Card className="mx-auto max-w-md p-10 text-center">
          <p className="text-sm font-bold">Trade Log unavailable</p>
          <p className="mt-1 text-[11px] text-ink-soft">{fatal ?? "Unexpected empty response."}</p>
          {/* full document reload -> re-runs this server component (no client-cache shortcut) */}
          <a href="/trades"
             className="mt-4 inline-flex items-center rounded-lg bg-primary-500 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-primary-600">
            Retry
          </a>
          <p className="mt-3 text-[10px] text-ink-mute">
            If this persists, the backend likely needs a restart after a code change.{" "}
            <Link href="/" className="font-bold text-primary-600 hover:underline">Back to dashboard</Link>
          </p>
        </Card>
      </AppShell>
    );
  }

  return (
    <AppShell title="Trade Log">
      <TradeLogView initial={data} accounts={accounts} />
    </AppShell>
  );
}