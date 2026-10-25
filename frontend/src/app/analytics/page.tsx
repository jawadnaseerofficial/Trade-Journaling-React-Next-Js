import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { AnalyticsView } from "@/components/analytics/analytics-view";
import { serverToken } from "@/lib/auth-server";

export default function Page() {
  if (!serverToken()) redirect("/login");
  return (
    <AppShell title="Analytics">
      <AnalyticsView />
    </AppShell>
  );
}