import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { DayView } from "@/components/dashboard/day-view";
import { serverToken } from "@/lib/auth-server";

export default function Page({ params }: { params: { date: string } }) {
  if (!serverToken()) redirect("/login");
  const date = params?.date ?? "";
  return (
    <AppShell title={date ? `Day · ${date}` : "Day"}>
      <DayView date={date} />
    </AppShell>
  );
}