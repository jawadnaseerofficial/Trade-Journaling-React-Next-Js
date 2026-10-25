// app/reports/[tab]/page.tsx
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { ReportsView } from "@/components/reports/reports-view";
import { serverToken } from "@/lib/auth-server";
const DIMS = ["dow", "symbol", "risk", "playbook", "tag", "expiry", "winslosses"];
export default function Page({ params }: { params: { tab: string } }) {
  if (!serverToken()) redirect("/login");
  const t = params.tab;
  const isDim = DIMS.includes(t);
  return <AppShell title="Reports"><ReportsView initialTab={isDim ? "reports" : t} initialDim={isDim ? t : "dow"} /></AppShell>;
}