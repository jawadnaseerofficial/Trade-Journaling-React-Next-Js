import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { SettingsView } from "@/components/settings/settings-view";
import { ApiError, api } from "@/lib/api";
import { serverToken } from "@/lib/auth-server";
import type { Profile } from "@/types";

export default async function SettingsPage() {
  const token = serverToken();
  if (!token) redirect("/login");
  let profile: Profile | null = null;
  let err: string | null = null;
  try {
    profile = await api.settings.profile(token);
  } catch (e) {
    if (e instanceof ApiError && (e.status === 401 || e.status === 403)) redirect("/login");
    err = e instanceof Error ? e.message : "Failed to load settings";
  }
  return (
    <AppShell title="Settings">
      {profile
        ? <SettingsView initial={profile} />
        : <p className="p-10 text-center text-[11px] text-ink-mute">Couldn’t load settings: {err}</p>}
    </AppShell>
  );
}