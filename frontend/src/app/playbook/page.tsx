import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { PlaybookIndex } from "@/components/playbook/playbook-index";
import { api } from "@/lib/api";
import { serverToken } from "@/lib/auth-server";

export default async function PlaybookPage() {
  const token = serverToken();
  if (!token) redirect("/login");
  const list = await api.playbooks.list("my", token).catch(() => []);
  return (
    <AppShell title="Playbook">
      <PlaybookIndex initial={list} />
    </AppShell>
  );
}