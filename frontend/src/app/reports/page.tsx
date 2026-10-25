// app/reports/page.tsx
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { ReportsView } from "@/components/reports/reports-view";
import { serverToken } from "@/lib/auth-server";
export default function Page() { if (!serverToken()) redirect("/login"); return <AppShell title="Reports"><ReportsView initialTab="performance" initialDim="dow" /></AppShell>; }