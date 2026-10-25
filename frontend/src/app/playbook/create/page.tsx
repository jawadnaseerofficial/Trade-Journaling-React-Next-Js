import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { CreateWizard } from "@/components/playbook/create-wizard";
import { serverToken } from "@/lib/auth-server";

export default async function CreatePlaybookPage() {
  const token = serverToken();
  if (!token) redirect("/login");
  return (
    <AppShell title="Playbook">
      <p className="mb-3 text-[11px] font-semibold text-ink-soft">Playbook / <span className="font-bold text-ink">Create Playbook</span></p>
      <CreateWizard />
    </AppShell>
  );
}