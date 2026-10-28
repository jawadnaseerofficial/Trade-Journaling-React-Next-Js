"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";

import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { useShell } from "./shell-context";
import { cn } from "@/lib/utils";

const COLLAPSE_KEY = "tj-sidebar-collapsed";

const TITLES: [string, string][] = [
  ["/add-trade", "Add Trade"],
  ["/trades", "Trade Log"],
  ["/analytics", "Analytics"],
  ["/journal", "Daily Journal"],
  ["/reports", "Reports"],
  ["/notebook", "Notebook"],
  ["/playbook", "Playbook"],
  ["/replay", "Trade Replay"],
  ["/backtesting", "Backtesting"],
  ["/settings", "Settings"],
  ["/", "Dashboard"],
];

function fallbackTitle(p: string): string {
  if (!p) return "Dashboard";
  for (const [pref, label] of TITLES) {
    if (pref === "/") return p === "/" ? "Dashboard" : label;
    if (p === pref || p.startsWith(pref + "/")) return label;
  }
  return "Dashboard";
}

export function RootChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { title, rangeLabel } = useShell();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1");
    } catch {
      /* ignore */
    }
  }, []);

  function toggle() {
    setCollapsed((c) => {
      const n = !c;
      try {
        localStorage.setItem(COLLAPSE_KEY, n ? "1" : "0");
      } catch {
        /* ignore */
      }
      return n;
    });
  }

  // login / register and full-screen replay pages have their own standalone layouts
  const isAuthPage = pathname === "/login" || pathname.startsWith("/login/");
  const isFullScreenPage = pathname === "/replay-live";
  if (isAuthPage || isFullScreenPage) {
    return <>{children}</>;
  }

  const displayTitle = title || fallbackTitle(pathname);

  return (
    <div className="min-h-screen">
      <Sidebar collapsed={collapsed} onToggle={toggle} />
      <div
        className={cn(
          "transition-[padding] duration-200 ease-out",
          collapsed ? "pl-[68px]" : "pl-[232px]",
        )}
      >
        <Topbar
          title={displayTitle}
          rangeLabel={rangeLabel}
          onToggle={toggle}
        />
        <main className="p-5">{children}</main>
      </div>
    </div>
  );
}