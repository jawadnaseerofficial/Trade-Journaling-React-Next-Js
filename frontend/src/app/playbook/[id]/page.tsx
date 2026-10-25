import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { PlaybookDetail_ } from "@/components/playbook/detail-view";
import { api } from "@/lib/api";
import { serverToken } from "@/lib/auth-server";

export default async function PlaybookDetailPage({ params }: { params: { id: string } }) {
  const token = serverToken();
  if (!token) redirect("/login");
  const detail = await api.playbooks.get(params.id, token).catch(() => null);
  if (!detail) redirect("/playbook");
  return (
    <AppShell title="Playbook">
      <PlaybookDetail_ initial={detail} />
    </AppShell>
  );
}