import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { LazyView } from "@/components/lazy/lazy-views";
import { serverToken } from "@/lib/auth-server";

export default function Page() {
  if (!serverToken()) redirect("/login");

  return (
    <AppShell title="Analytics">
      <LazyView name="analytics" />
    </AppShell>
  );
}