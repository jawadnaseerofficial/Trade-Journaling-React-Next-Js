import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { NotebookView } from "@/components/notebook/notebook-view";
import { ApiError, api } from "@/lib/api";
import { serverToken } from "@/lib/auth-server";
import type { NbListItem, NbTree } from "@/types";

export default async function NotebookPage() {
  const token = serverToken();
  if (!token) redirect("/login");
  let tree: NbTree | null = null; let initial: NbListItem[] = []; let err: string | null = null;
  try {
    tree = await api.notebook.tree(token);
    initial = await api.notebook.notes("trade", undefined, undefined, token);
  } catch (e) {
    if (e instanceof ApiError && (e.status === 401 || e.status === 403)) redirect("/login");
    err = e instanceof Error ? e.message : "Failed to load notebook";
  }
  return (
    <AppShell title="Notebook">
      {tree ? <NotebookView initialTree={tree} initialNotes={initial} />
            : <p className="p-10 text-center text-[11px] text-ink-mute">Couldn’t load notebook: {err}</p>}
    </AppShell>
  );
}