"use client";
import { useEffect, useState } from "react";
import {
  Activity, Award, BarChart3, Bolt, Compass, Crown, Flame, Gauge, Gem, Ghost,
  Globe, HeartPulse, Leaf, LogOut, Monitor, Moon, Orbit, Rocket, ShieldAlert, Sparkles, Star, Sun, Target, Trash2, Waves,
  Check, Loader2, ShieldCheck, type LucideIcon,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Dialog } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { clientGetToken } from "@/lib/auth";
import * as authMod from "@/lib/auth";
import type { Profile } from "@/types";

// Defensive, production-grade logout: needs NO knowledge of the storage key. We call whatever
// token-clearing export exists, then scrub any JWT-shaped value out of storage (so even an
// unlisted helper name is covered), then hard-redirect with replace() (no back-button to a dead
// session). This is why the Danger Zone no longer depends on pasting lib/auth.ts.
const JWT_RE = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
function hardLogout() {
  try {
    const m = authMod as unknown as Record<string, unknown>;
    for (const name of ["clientClearToken", "clearToken", "logout", "signOut", "clientLogout", "clearAuth"]) {
      const f = m[name];
      if (typeof f === "function") { try { (f as () => void)(); } catch { /* keep going */ } }
    }
    const setTok = m.clientSetToken ?? m.setToken;
    if (typeof setTok === "function") { try { (setTok as (t: null) => void)(null); } catch { /* ignore */ } }
  } catch { /* module shape unknown -> rely on scrub */ }
  try {
    for (const store of [localStorage, sessionStorage]) {
      for (let i = store.length - 1; i >= 0; i--) {
        const k = store.key(i); if (!k) continue;
        const v = store.getItem(k);
        if (v && JWT_RE.test(v.trim())) store.removeItem(k);   // only token-shaped values; theme etc. untouched
      }
    }
  } catch { /* private mode */ }
  if (typeof window !== "undefined") window.location.replace("/login");
}

// Stored value = icon NAME (fits users.avatar VARCHAR(16)); rendered via this registry.
const AVATAR_ICONS: Record<string, LucideIcon> = {
  rocket: Rocket, target: Target, bolt: Bolt, flame: Flame, crown: Crown, gem: Gem,
  compass: Compass, orbit: Orbit, globe: Globe, star: Star, moon: Moon, sun: Sun,
  leaf: Leaf, waves: Waves, ghost: Ghost, award: Award, activity: Activity, gauge: Gauge,
  heartpulse: HeartPulse, barchart3: BarChart3,
};
const AVATAR_NAMES = Object.keys(AVATAR_ICONS);
const AvatarIcon = ({ name, size }: { name: string; size: number }) => {
  const Cmp = AVATAR_ICONS[name] ?? Sparkles;
  return <Cmp size={size} strokeWidth={2.2} />;
};

const CHARTS = [
  { v: "lightweight", l: "Lightweight candles (TradingView-style)" },
  { v: "candles", l: "Candlesticks" },
  { v: "simple", l: "Simple line/area" },
];
const THEMES: { v: "light" | "dark" | "system"; l: string; Icon: LucideIcon }[] = [
  { v: "light", l: "Light", Icon: Sun },
  { v: "dark", l: "Dark", Icon: Moon },
  { v: "system", l: "System", Icon: Monitor },
];

function applyTheme(pref: string) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const sysDark = typeof matchMedia === "function" && matchMedia("(prefers-color-scheme: dark)").matches;
  const dark = pref === "dark" || (pref === "system" && sysDark);
  root.classList.toggle("dark", dark);
  try { localStorage.setItem("theme", pref); } catch { /* private mode */ }
}

type Status = { kind: "idle" | "busy" | "ok" | "err"; msg?: string };
const idle: Status = { kind: "idle" };

function StatusLine({ s }: { s: Status }) {
  if (s.kind === "idle") return null;
  return (
    <p className={cn("mt-2 flex items-center gap-1 text-[11px] font-semibold",
      s.kind === "ok" ? "text-success" : s.kind === "err" ? "text-danger" : "text-ink-mute")}>
      {s.kind === "busy" && <Loader2 size={12} className="animate-spin" />}
      {s.kind === "ok" && <Check size={12} />}
      {s.msg}
    </p>
  );
}

export function SettingsView({ initial }: { initial: Profile }) {
  const tok = () => clientGetToken() ?? undefined;
  const [p, setP] = useState(initial);

  const [name, setName] = useState(initial.displayName ?? "");
  const [avatar, setAvatar] = useState(initial.avatar);
  const [chart, setChart] = useState(initial.chartStyle);
  const [theme, setTheme] = useState(initial.themePref || "system");
  const [profS, setProfS] = useState<Status>(idle);

  const [email, setEmail] = useState(initial.email);
  const [emailS, setEmailS] = useState<Status>(idle);

  const [ws, setWs] = useState(initial.tenantName);
  const [wsS, setWsS] = useState<Status>(idle);

  const [cur, setCur] = useState(""); const [np, setNp] = useState(""); const [cf, setCf] = useState("");
  const [pwS, setPwS] = useState<Status>(idle);

  const [dzS, setDzS] = useState<Status>(idle);
  const [delOpen, setDelOpen] = useState(false);
  const [delText, setDelText] = useState("");

  useEffect(() => { applyTheme(theme); }, [theme]);
  useEffect(() => {
    if (typeof matchMedia !== "function") return;
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const on = () => { if (theme === "system") applyTheme("system"); };
    mq.addEventListener?.("change", on);
    return () => mq.removeEventListener?.("change", on);
  }, [theme]);

  async function saveProfile() {
    setProfS({ kind: "busy", msg: "Saving…" });
    try {
      const res = await api.settings.patchProfile({ displayName: name.trim() || null, avatar, chartStyle: chart, themePref: theme }, tok());
      setP(res); setProfS({ kind: "ok", msg: "Profile saved." });
    } catch (e) { setProfS({ kind: "err", msg: e instanceof Error ? e.message : "Save failed" }); }
  }
  async function saveEmail() {
    const v = email.trim();
    if (!v || !v.includes("@")) { setEmailS({ kind: "err", msg: "Enter a valid email." }); return; }
    if (v === p.email) { setEmailS({ kind: "idle" }); return; }
    setEmailS({ kind: "busy", msg: "Updating…" });
    try {
      const res = await api.settings.changeEmail(v, tok());
      setP(res); setEmail(res.email); setEmailS({ kind: "ok", msg: "Email updated — you stay signed in." });
    } catch (e) { setEmailS({ kind: "err", msg: e instanceof Error ? e.message : "Update failed" }); }
  }
  async function saveWorkspace() {
    if (!ws.trim()) { setWsS({ kind: "err", msg: "Name required." }); return; }
    setWsS({ kind: "busy", msg: "Saving…" });
    try {
      const res = await api.settings.patchTenant(ws.trim(), tok());
      setP((x) => ({ ...x, tenantName: res.name })); setWsS({ kind: "ok", msg: "Workspace renamed." });
    } catch (e) { setWsS({ kind: "err", msg: e instanceof Error ? e.message : "Save failed" }); }
  }
  async function savePassword() {
    if (np !== cf) { setPwS({ kind: "err", msg: "New passwords don’t match." }); return; }
    if (np.length < 8) { setPwS({ kind: "err", msg: "New password must be ≥ 8 chars." }); return; }
    setPwS({ kind: "busy", msg: "Updating…" });
    try {
      await api.settings.changePassword({ currentPassword: cur, newPassword: np }, tok());
      setCur(""); setNp(""); setCf(""); setPwS({ kind: "ok", msg: "Password changed." });
    } catch (e) { setPwS({ kind: "err", msg: e instanceof Error ? e.message : "Change failed" }); }
  }

  function signOutDevice() { setDzS({ kind: "busy", msg: "Signing out…" }); hardLogout(); }
  async function signOutEverywhere() {
    setDzS({ kind: "busy", msg: "Revoking all sessions…" });
    try { await api.settings.logoutEverywhere(tok()); } catch { /* still clear locally */ }
    hardLogout();
  }
  async function doDelete() {
    if (delText !== "DELETE") return;
    setDzS({ kind: "busy", msg: "Deleting account…" });
    try {
      await api.settings.deleteAccount(tok());
      setDelOpen(false);
      hardLogout();
    } catch (e) { setDzS({ kind: "err", msg: e instanceof Error ? e.message : "Delete failed" }); }
  }

  const initials = (p.displayName?.trim()?.[0] ?? p.email?.[0] ?? "?").toUpperCase();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      {/* Profile */}
      <Card className="p-5">
        <div className="flex items-center gap-2"><Sparkles size={14} className="text-primary-600" /><p className="text-xs font-black uppercase tracking-wide">Profile</p></div>
        <div className="mt-4 flex items-center gap-4">
          <div className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-primary-50 text-primary-600">
            {avatar ? <AvatarIcon name={avatar} size={30} /> : <span className="text-2xl font-black">{initials}</span>}
          </div>
          <div className="flex flex-wrap gap-1">
            {AVATAR_NAMES.map((a) => (
              <button key={a} onClick={() => setAvatar(a)} title={a}
                className={cn("grid h-9 w-9 place-items-center rounded-lg border transition-colors",
                  avatar === a ? "border-primary-500 bg-primary-50 text-primary-600" : "border-line text-ink-soft hover:bg-canvas hover:text-primary-600")}>
                <AvatarIcon name={a} size={17} />
              </button>
            ))}
            <button onClick={() => setAvatar("")} className="rounded-lg border border-line px-2 text-[10px] font-bold text-ink-mute hover:bg-canvas">Initials</button>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="text-[11px] font-semibold text-ink-soft">Display name
            <Input className="mt-1" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
          </label>
          <label className="text-[11px] font-semibold text-ink-soft">Default chart style
            <Select className="mt-1" value={chart} onChange={(e) => setChart(e.target.value)}>
              {CHARTS.map((c) => <option key={c.v} value={c.v}>{c.l}</option>)}
            </Select>
          </label>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <Button size="sm" onClick={saveProfile}>Save profile</Button>
          <StatusLine s={profS} />
        </div>
      </Card>

      {/* Appearance */}
      <Card className="p-5">
        <div className="flex items-center gap-2"><Moon size={14} className="text-primary-600" /><p className="text-xs font-black uppercase tracking-wide">Appearance</p></div>
        <p className="mt-1 text-[11px] text-ink-soft">Theme across the whole app. <b>System</b> follows your OS. Stays in sync with the sidebar Dark‑Mode switch.</p>
        <div className="mt-3 inline-flex rounded-card border border-line bg-canvas p-0.5">
          {THEMES.map(({ v, l, Icon }) => (
            <button key={v} onClick={() => setTheme(v)}
              className={cn("flex items-center gap-1.5 rounded px-3 py-1.5 text-[11px] font-bold transition-colors",
                theme === v ? "bg-surface text-primary-600 shadow-sm" : "text-ink-mute hover:text-ink-soft")}>
              <Icon size={13} /> {l}
            </button>
          ))}
        </div>
        <div className="mt-3"><Button size="sm" onClick={saveProfile}>Save appearance</Button></div>
      </Card>

      {/* Email */}
      <Card className="p-5">
        <p className="text-xs font-black uppercase tracking-wide">Login email</p>
        <p className="mt-1 text-[11px] text-ink-soft">Your sign‑in identity. Changing it keeps you signed in on this device.</p>
        <div className="mt-3 flex items-end gap-2">
          <label className="flex-1 text-[11px] font-semibold text-ink-soft">Email
            <Input className="mt-1" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <Button size="sm" onClick={saveEmail} disabled={email.trim() === p.email}>Save email</Button>
        </div>
        <StatusLine s={emailS} />
      </Card>

      {/* Workspace */}
      <Card className="p-5">
        <p className="text-xs font-black uppercase tracking-wide">Workspace</p>
        <p className="mt-1 text-[11px] text-ink-soft">The name shown to everyone in this tenant.</p>
        <div className="mt-3 flex items-end gap-2">
          <label className="flex-1 text-[11px] font-semibold text-ink-soft">Workspace name
            <Input className="mt-1" value={ws} onChange={(e) => setWs(e.target.value)} />
          </label>
          <Button size="sm" onClick={saveWorkspace}>Save</Button>
        </div>
        <StatusLine s={wsS} />
      </Card>

      {/* Security */}
      <Card className="p-5">
        <div className="flex items-center gap-2"><ShieldCheck size={14} className="text-primary-600" /><p className="text-xs font-black uppercase tracking-wide">Security</p></div>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="text-[11px] font-semibold text-ink-soft">Current password<Input type="password" className="mt-1" value={cur} onChange={(e) => setCur(e.target.value)} /></label>
          <label className="text-[11px] font-semibold text-ink-soft">New password<Input type="password" className="mt-1" value={np} onChange={(e) => setNp(e.target.value)} /></label>
          <label className="text-[11px] font-semibold text-ink-soft">Confirm new<Input type="password" className="mt-1" value={cf} onChange={(e) => setCf(e.target.value)} /></label>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <Button size="sm" onClick={savePassword} disabled={!cur || !np}>Change password</Button>
          <StatusLine s={pwS} />
        </div>
      </Card>

      {/* Danger zone — fully wired */}
      <Card className="border-danger/30 p-5">
        <div className="flex items-center gap-2"><ShieldAlert size={14} className="text-danger" /><p className="text-xs font-black uppercase tracking-wide text-danger">Danger zone</p></div>
        <div className="mt-3 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3 rounded-lg border border-line px-3 py-2.5">
            <div><p className="text-[11px] font-bold">Sign out of this device</p><p className="text-[10px] text-ink-mute">Clears your token here and returns to the login screen.</p></div>
            <Button variant="outline" size="sm" onClick={signOutDevice}><LogOut size={13} /> Sign out</Button>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-lg border border-line px-3 py-2.5">
            <div><p className="text-[11px] font-bold">Sign out of all devices</p><p className="text-[10px] text-ink-mute">Revokes every active session workspace‑wide, then signs this device out.</p></div>
            <Button variant="outline" size="sm" onClick={signOutEverywhere}><LogOut size={13} /> Everywhere</Button>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-lg border border-danger/40 bg-danger-soft/40 px-3 py-2.5">
            <div><p className="text-[11px] font-bold text-danger-deep">Delete account</p><p className="text-[10px] text-ink-soft">Permanently removes your account{"" /* policy explained in confirm */} and, if you’re the only member, the entire workspace and all its data. Cannot be undone.</p></div>
            <Button size="sm" className="bg-danger text-white hover:bg-danger-deep" onClick={() => { setDelText(""); setDelOpen(true); }}><Trash2 size={13} /> Delete…</Button>
          </div>
          <StatusLine s={dzS} />
        </div>
      </Card>

      {/* About */}
      <Card className="p-5">
        <p className="text-xs font-black uppercase tracking-wide">About</p>
        <div className="mt-2 space-y-1 text-[11px] text-ink-soft">
          <p>tradeJournaling · web · v0.1.0</p>
          <p>Member since {new Date(p.createdAt).toLocaleDateString()}</p>
        </div>
      </Card>

      <Dialog open={delOpen} onClose={() => setDelOpen(false)} title="Delete account — this is permanent"
        footer={<>
          <Button variant="ghost" size="sm" onClick={() => setDelOpen(false)}>Cancel</Button>
          <Button size="sm" className="bg-danger text-white hover:bg-danger-deep" disabled={delText !== "DELETE" || dzS.kind === "busy"} onClick={doDelete}>Delete forever</Button>
        </>}>
        <p className="text-[11px] text-ink-soft">
          This deletes your account and, <b>if you are the only member of “{p.tenantName}”</b>, the entire workspace — every trade, journal entry, playbook, note and backtest session — irreversibly. If teammates share this workspace, only your account is removed and their data is left intact.
        </p>
        <p className="mt-3 text-[11px] font-semibold">Type <span className="font-black text-danger">DELETE</span> to confirm.</p>
        <Input className="mt-1" value={delText} onChange={(e) => setDelText(e.target.value)} placeholder="DELETE" />
      </Dialog>
    </div>
  );
}