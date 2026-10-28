import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { LazyView } from "@/components/lazy/lazy-views";
import { api, ApiError } from "@/lib/api";
import { serverToken } from "@/lib/auth-server";

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning!";
  if (h < 18) return "Good afternoon!";
  return "Good evening!";
}

export default async function DashboardPage() {
  const token = serverToken();
  if (!token) redirect("/login");

  let data;
  try {
    data = await api.dashboard.summary(token);
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) redirect("/login");
    throw e;
  }

  return (
    <AppShell title="Dashboard" rangeLabel={data.rangeLabel}>
      <LazyView name="dashboard" data={data} greeting={greeting()} />
    </AppShell>
  );
}