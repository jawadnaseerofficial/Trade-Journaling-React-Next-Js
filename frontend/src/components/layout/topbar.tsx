"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  CalendarRange,
  Check,
  ChevronDown,
  ChevronsUpDown,
  LogOut,
  Menu,
  Settings as SettingsIcon,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { clientClearToken, clientGetToken } from "@/lib/auth";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import type { Account } from "@/types";

type Range = { start?: string; end?: string };
type Note = { id: string; title: string; time?: string; read?: boolean };
type Me = { email?: string; displayName?: string | null; avatar?: string | null };

export function Topbar({
  title,
  rangeLabel,
  onToggle,
  accounts: accountsProp,
  activeAccountId: activeIdProp,
  onSelectAccount,
  range: rangeProp,
  onRangeChange,
  user: userProp,
  onLogout,
  notifications,
}: {
  title: string;
  rangeLabel?: string;
  onToggle?: () => void; // optional now; only drives the mobile hamburger
  accounts?: Account[];
  activeAccountId?: string;
  onSelectAccount?: (id: string) => void;
  range?: Range;
  onRangeChange?: (r: Range) => void;
  user?: Me;
  onLogout?: () => void;
  notifications?: Note[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const tok = () => clientGetToken() ?? undefined;

  // only one popover open at a time
  const [open, setOpen] = useState<null | "range" | "account" | "bell" | "user">(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  // ---- accounts (controlled by prop if given, else self-fetch, never crash) ----
  const [fetched, setFetched] = useState<Account[]>([]);
  const didFetch = useRef(false);
  const controlledAccounts = accountsProp !== undefined;
  useEffect(() => {
    if (controlledAccounts || didFetch.current) return;
    didFetch.current = true;
    api.accounts
      .list(tok())
      .then((r: any) => setFetched(Array.isArray(r) ? r : []))
      .catch(() => {});
  }, [controlledAccounts]);
  const accounts = controlledAccounts ? accountsProp! : fetched;

  const [storedAcct, setStoredAcct] = useState<string>("");
  useEffect(() => {
    try {
      setStoredAcct(window.localStorage.getItem("tj.activeAccountId") || "");
    } catch {}
  }, []);
  const activeId = activeIdProp ?? storedAcct ?? accounts[0]?.id ?? "";
  const activeAcct = accounts.find((a) => a.id === activeId) ?? accounts[0];

  function pickAccount(id: string) {
    try {
      window.localStorage.setItem("tj.activeAccountId", id);
    } catch {}
    setStoredAcct(id);
    onSelectAccount?.(id);
    window.dispatchEvent(new CustomEvent("tj:account", { detail: id }));
    setOpen(null);
  }

  // ---- date range (controlled by prop if given, else local + global event) ----
  const controlledRange = rangeProp !== undefined;
  const [localRange, setLocalRange] = useState<Range>({});
  const range = controlledRange ? rangeProp! : localRange;
  function commitRange(r: Range) {
    if (!controlledRange) setLocalRange(r);
    onRangeChange?.(r);
    window.dispatchEvent(new CustomEvent("tj:range", { detail: r }));
  }
  const rangeText = useMemo(() => {
    if (rangeLabel && !range.start && !range.end) return rangeLabel;
    if (range.start && range.end) return `${range.start} → ${range.end}`;
    if (range.start) return `From ${range.start}`;
    if (range.end) return `To ${range.end}`;
    return "Select date range";
  }, [range, rangeLabel]);

  // ---- current user (controlled by prop if given, else self-fetch) ----
  const [me, setMe] = useState<Me | null>(userProp ?? null);
  const didUser = useRef(false);
  useEffect(() => {
    if (userProp !== undefined || didUser.current) return;
    didUser.current = true;
    api.users
      .getMe(tok())
      .then((u: any) => setMe({ email: u?.email, displayName: u?.displayName ?? null, avatar: u?.avatar ?? null }))
      .catch(() => {});
  }, [userProp]);
  const shownUser = userProp ?? me;
  const initials = useMemo(() => {
    const src = (shownUser?.displayName || shownUser?.email || "?").trim();
    const parts = src.split(/[\s@._-]+/).filter(Boolean);
    return ((parts[0]?.[0] || "?") + (parts[1]?.[0] || "")).toUpperCase();
  }, [shownUser]);

  function doLogout() {
    setOpen(null);
    if (onLogout) return onLogout();
    try {
      clientClearToken();
    } catch {}
    router.push("/login");
  }

  // ---- close popovers on outside click / Escape ----
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(null);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const unread = (notifications ?? []).filter((n) => !n.read).length;

  const Pop = ({ children, w = "w-64" }: { children: React.ReactNode; w?: string }) => (
    <div className={cn("absolute right-0 top-11 z-40 rounded-xl border border-line bg-surface p-1.5 shadow-card", w)}>
      {children}
    </div>
  );
  const Item = ({ active, onClick, children }: any) => (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[11px] font-semibold transition-colors hover:bg-canvas",
        active ? "text-primary-600" : "text-ink-soft"
      )}
    >
      {children}
    </button>
  );

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-line bg-surface px-4 sm:px-5">
      {/* mobile-only sidebar opener — desktop topbar is clean (no stray button) */}
      {onToggle && (
        <Button variant="icon" size="iconSm" aria-label="Open menu" onClick={onToggle} className="lg:hidden">
          <Menu size={17} />
        </Button>
      )}

      <h1 className="truncate text-sm font-black tracking-tight text-ink">{title}</h1>

      <div ref={wrapRef} className="relative ml-auto flex items-center gap-1.5 sm:gap-2">
        {/* THEME — shared store, syncs with Settings automatically */}
        <ThemeToggle variant="icon" />

        {/* DATE RANGE */}
        <div className="relative">
          <Button
            variant="icon"
            size="sm"
            onClick={() => setOpen(open === "range" ? null : "range")}
            className="rounded-lg border border-line bg-surface px-2.5 text-ink-soft hover:border-primary-300 hover:text-primary-600"
          >
            <CalendarRange size={14} className="text-primary-500" />
            <span className="hidden max-w-[140px] truncate text-[11px] font-semibold md:inline">{rangeText}</span>
            <ChevronDown size={13} className="text-ink-mute" />
          </Button>
          {open === "range" && (
            <Pop w="w-72">
              <p className="px-2 py-1 text-[9px] font-black uppercase text-ink-mute">Date range</p>
              <div className="flex items-center gap-2 px-2 py-1.5">
                <input
                  type="date"
                  value={range.start || ""}
                  onChange={(e) => commitRange({ ...range, start: e.target.value || undefined })}
                  className="h-8 flex-1 rounded-lg border border-line bg-canvas px-2 text-[11px] text-ink outline-none focus:border-primary-400"
                />
                <span className="text-ink-mute">→</span>
                <input
                  type="date"
                  value={range.end || ""}
                  onChange={(e) => commitRange({ ...range, end: e.target.value || undefined })}
                  className="h-8 flex-1 rounded-lg border border-line bg-canvas px-2 text-[11px] text-ink outline-none focus:border-primary-400"
                />
              </div>
              <div className="mt-1 flex gap-1.5 px-2 pb-1.5">
                <Button variant="outline" size="sm" className="flex-1" onClick={() => commitRange({})}>
                  Clear
                </Button>
                <Button size="sm" className="flex-1" onClick={() => setOpen(null)}>
                  Done
                </Button>
              </div>
            </Pop>
          )}
        </div>

        {/* ACCOUNT (live) */}
        <div className="relative">
          <Button
            variant="icon"
            size="sm"
            onClick={() => setOpen(open === "account" ? null : "account")}
            className="rounded-lg border border-line bg-surface px-2 text-ink-soft hover:border-primary-300 hover:text-primary-600"
          >
            <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary-100 text-[9px] font-black text-primary-600">
              {(activeAcct?.name || "A").slice(0, 1).toUpperCase()}
            </span>
            <span className="hidden max-w-[120px] truncate text-[11px] font-semibold lg:inline">
              {activeAcct?.name || (accounts.length ? "Select account" : "No account")}
            </span>
            <ChevronsUpDown size={13} className="text-ink-mute" />
          </Button>
          {open === "account" && (
            <Pop w="w-64">
              <p className="px-2 py-1 text-[9px] font-black uppercase text-ink-mute">Accounts</p>
              <div className="max-h-72 overflow-y-auto">
                {accounts.length ? (
                  accounts.map((a) => (
                    <Item key={a.id} active={a.id === activeId} onClick={() => pickAccount(a.id)}>
                      <span className="grid h-5 w-5 place-items-center rounded-full bg-canvas text-[9px] font-black text-ink-soft">
                        {(a.name || "?").slice(0, 1).toUpperCase()}
                      </span>
                      <span className="flex-1 truncate">
                        <span className="block truncate font-bold text-ink">{a.name}</span>
                        {a.broker && <span className="block truncate text-[9px] font-medium text-ink-mute">{a.broker}</span>}
                      </span>
                      {a.id === activeId && <Check size={13} className="text-primary-600" />}
                    </Item>
                  ))
                ) : (
                  <p className="px-2 py-3 text-center text-[10px] text-ink-mute">No accounts yet.</p>
                )}
              </div>
            </Pop>
          )}
        </div>

        {/* NOTIFICATIONS */}
        <div className="relative">
          <Button
            variant="icon"
            size="iconSm"
            aria-label="Notifications"
            onClick={() => setOpen(open === "bell" ? null : "bell")}
            className="relative rounded-lg border border-line bg-surface text-ink-soft hover:border-primary-300 hover:text-primary-600"
          >
            <Bell size={15} />
            {unread > 0 && (
              <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-danger px-1 text-[8px] font-black text-white">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </Button>
          {open === "bell" && (
            <Pop w="w-72">
              <div className="flex items-center justify-between px-2 py-1">
                <p className="text-[9px] font-black uppercase text-ink-mute">Notifications</p>
                <button onClick={() => setOpen(null)} className="text-ink-mute hover:text-ink">
                  <X size={13} />
                </button>
              </div>
              <div className="max-h-72 overflow-y-auto">
                {notifications && notifications.length ? (
                  notifications.map((n) => (
                    <div key={n.id} className={cn("rounded-lg px-2.5 py-2 text-[11px]", !n.read && "bg-primary-50/50")}>
                      <p className="font-bold text-ink">{n.title}</p>
                      {n.time && <p className="text-[9px] text-ink-mute">{n.time}</p>}
                    </div>
                  ))
                ) : (
                  <p className="px-2 py-4 text-center text-[10px] text-ink-mute">You&apos;re all caught up.</p>
                )}
              </div>
            </Pop>
          )}
        </div>

        {/* USER MENU (live) */}
        <div className="relative">
          <button
            type="button"
            aria-label="Account menu"
            onClick={() => setOpen(open === "user" ? null : "user")}
            className="grid h-8 w-8 place-items-center rounded-full bg-primary-500 text-[11px] font-black text-white transition-transform hover:scale-105"
          >
            {initials}
          </button>
          {open === "user" && (
            <Pop w="w-60">
              <div className="border-b border-line/60 px-2.5 py-2">
                <p className="truncate text-[12px] font-black text-ink">{shownUser?.displayName || "Trader"}</p>
                {shownUser?.email && <p className="truncate text-[10px] text-ink-mute">{shownUser.email}</p>}
              </div>
              <div className="pt-1">
                <Item onClick={() => { setOpen(null); router.push("/settings"); }}>
                  <SettingsIcon size={14} className="text-ink-mute" /> Settings
                </Item>
                <Item onClick={doLogout}>
                  <LogOut size={14} className="text-ink-mute" /> Log out
                </Item>
              </div>
            </Pop>
          )}
        </div>
      </div>
    </header>
  );
}