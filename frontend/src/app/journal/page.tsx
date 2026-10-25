import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { JournalView } from "@/components/journal/journal-view";
import { api } from "@/lib/api";
import { serverToken } from "@/lib/auth-server";

const currentMonth = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };

export default async function JournalPage({ searchParams }: { searchParams: { day?: string; month?: string } }) {
  const token = serverToken();
  if (!token) redirect("/login");
  const month = searchParams.month ?? (searchParams.day ? searchParams.day.slice(0, 7) : currentMonth());
  const data = await api.journal.month(month, token).catch(() => ({ month, days: [] }));
  const focused = searchParams.day ?? null;
  const rangeLabel = focused
    ? new Date(focused + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" })
    : data.days.length ? `${data.days.at(-1)!.label} – ${data.days[0].label}` : "This month";
  return (
    <AppShell title="Daily Journal" rangeLabel={rangeLabel}>
      <JournalView initialMonth={month} initialDays={data.days} focusedDay={focused} />
    </AppShell>
  );
}