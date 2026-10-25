// app/reports/[tab]/[dim]/page.tsx  (for /reports/reports/<dim> if you prefer nested; harmless if unused)
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { ReportsView } from "@/components/reports/reports-view";
import { serverToken } from "@/lib/auth-server";
export default function Page({ params }: { params: { tab: string; dim: string } }) {
  if (!serverToken()) redirect("/login");
  return <AppShell title="Reports"><ReportsView initialTab="reports" initialDim={params.dim} /></AppShell>;
}