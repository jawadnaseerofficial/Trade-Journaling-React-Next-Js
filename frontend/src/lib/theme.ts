"use client";

import { useCallback, useSyncExternalStore } from "react";

export type Theme = "light" | "dark" | "system";
export type Resolved = "light" | "dark";

const KEY = "tj.theme";
const isBrowser = typeof window !== "undefined" && typeof document !== "undefined";

function readStore(): Theme | null {
  if (!isBrowser) return null;
  try {
    const v = window.localStorage.getItem(KEY);
    return v === "light" || v === "dark" || v === "system" ? v : null;
  } catch {
    return null;
  }
}

function writeStore(t: Theme) {
  if (!isBrowser) return;
  try {
    window.localStorage.setItem(KEY, t);
  } catch {
    /* storage blocked — ignore, in-memory still works */
  }
}

function systemPref(): Resolved {
  if (!isBrowser) return "light";
  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  } catch {
    return "light";
  }
}

export function resolveTheme(t: Theme): Resolved {
  return t === "system" ? systemPref() : t;
}

function applyResolved(r: Resolved) {
  if (!isBrowser) return;
  const el = document.documentElement;
  el.classList.toggle("dark", r === "dark");
  // makes native controls (date pickers, scrollbars, form fields) follow the theme too
  el.style.colorScheme = r;
}

/* ------------------------------------------------------------------ *
 * The store: ONE object for the whole app. Every consumer (topbar,   *
 * settings, anything) reads/writes this, so they can never desync.   *
 * No provider, no context to forget to mount.                        *
 * ------------------------------------------------------------------ */
type Listener = () => void;

const store = {
  theme: (readStore() ?? "system") as Theme,
  listeners: new Set<Listener>(),

  subscribe(fn: Listener) {
    store.listeners.add(fn);
    return () => {
      store.listeners.delete(fn);
    };
  },

  // stable primitive snapshot -> safe for useSyncExternalStore
  getSnapshot(): Theme {
    return store.theme;
  },
  getServerSnapshot(): Theme {
    return "system"; // deterministic on server => no hydration mismatch
  },

  notify() {
    store.listeners.forEach((l) => l());
  },

  // central commit. `write`/`backend` flags let external events (other tabs)
  // sync without re-writing storage or re-patching the API.
  commit(t: Theme, opts: { write?: boolean; backend?: boolean } = {}) {
    const { write = true, backend = true } = opts;
    if (t === store.theme && write) {
      // same value, but still ensure DOM is correct (e.g. after a system flip)
      applyResolved(resolveTheme(t));
      return;
    }
    store.theme = t;
    applyResolved(resolveTheme(t));
    if (write) writeStore(t);
    if (backend) scheduleBackend(t);
    store.notify();
  },

  set(t: Theme) {
    store.commit(t);
  },

  toggle() {
    const r = resolveTheme(store.theme);
    store.commit(r === "dark" ? "light" : "dark");
  },
};

/* best-effort server persistence: dynamic import so this file NEVER has a
   hard dependency on api/auth (no import cycle, no brick if signatures move).
   Debounced so rapid toggling doesn't spam the API. Failures are swallowed —
   localStorage + the html class are the instant, authoritative UI truth. */
let backendTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleBackend(t: Theme) {
  if (!isBrowser) return;
  if (backendTimer) clearTimeout(backendTimer);
  backendTimer = setTimeout(async () => {
    try {
      const { clientGetToken } = await import("@/lib/auth");
      const token = clientGetToken();
      if (!token) return; // not logged in -> local-only is fine
      const { api } = await import("@/lib/api");
      await api.settings.patchProfile({ theme_pref: t }, token);
    } catch {
      /* field name / endpoint mismatch or offline -> ignore, UI already correct */
    }
  }, 450);
}

/* cross-tab sync (parens matter: key check must gate ALL value checks) */
if (isBrowser) {
  window.addEventListener("storage", (e) => {
    if (e.key === KEY && (e.newValue === "light" || e.newValue === "dark" || e.newValue === "system")) {
      store.commit(e.newValue as Theme, { write: false, backend: false });
    }
  });
  /* react live to OS theme changes while in "system" mode */
  try {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onSys = () => {
      if (store.theme === "system") applyResolved(resolveTheme("system"));
    };
    mq.addEventListener?.("change", onSys);
  } catch {
    /* older browsers: fine */
  }
  /* apply ASAP on load so the very first painted frame is already correct
     (the optional head script in the layout beats even this for zero flash) */
  applyResolved(resolveTheme(store.theme));
}

export function useTheme() {
  const theme = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
  const resolved = resolveTheme(theme);
  const setTheme = useCallback((t: Theme) => store.set(t), []);
  const toggle = useCallback(() => store.toggle(), []);
  return { theme, resolved, setTheme, toggle, system: systemPref } as const;
}

/* ------------------------------------------------------------------ *
 * Legacy-compat shims. The canonical API is `useTheme()` above.       *
 * These exist ONLY so any older importer (e.g. a sidebar that used    *
 * `getStoredTheme`/`toggleTheme` with local state) resolves to a real *
 * function instead of crashing — and because they drive the SAME      *
 * store, they can never desync the topbar/settings control.           *
 * New code should use `useTheme()`.                                   *
 * ------------------------------------------------------------------ */
export function getStoredTheme(): Theme | null {
  return readStore();
}

export function toggleTheme(): Theme {
  store.toggle();
  return store.theme;
}