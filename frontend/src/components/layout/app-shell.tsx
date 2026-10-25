"use client";
import { useEffect, useState, type ReactNode } from "react";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { cn } from "@/lib/utils";

const COLLAPSE_KEY = "tj-sidebar-collapsed";

export function AppShell({
  title,
  rangeLabel,
  children,
}: {
  title: string;
  rangeLabel?: string;
  children: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try { setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1"); } catch { /* ignore */ }
  }, []);
  function toggle() {
    setCollapsed((c) => {
      const n = !c;
      try { localStorage.setItem(COLLAPSE_KEY, n ? "1" : "0"); } catch { /* ignore */ }
      return n;
    });
  }

  return (
    <div className="min-h-screen">
      <Sidebar collapsed={collapsed} onToggle={toggle} />
      <div className={cn("transition-[padding] duration-200 ease-out", collapsed ? "pl-[68px]" : "pl-[232px]")}>
        <Topbar title={title} rangeLabel={rangeLabel} onToggle={toggle} />
        <main className="p-5">{children}</main>
      </div>
    </div>
  );
}