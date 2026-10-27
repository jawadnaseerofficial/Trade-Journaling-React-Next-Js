"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Plus, LayoutGrid, CalendarDays, Table2, FileBarChart2, BarChart3,
  FlaskConical, NotebookPen, BookOpen, PlayCircle, Settings,
  LogOut, ChevronLeft, ChevronRight, type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { clientClearToken } from "@/lib/auth";

const NAV_ITEMS: { id: string; label: string; icon: LucideIcon; href: string }[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutGrid, href: "/" },
  { id: "trades", label: "Trade Log", icon: Table2, href: "/trades" },
  { id: "analytics", label: "Analytics", icon: BarChart3, href: "/analytics" },
  { id: "journal", label: "Daily Journal", icon: CalendarDays, href: "/journal" },
  { id: "reports", label: "Reports", icon: FileBarChart2, href: "/reports" },
  { id: "notebook", label: "Notebook", icon: NotebookPen, href: "/notebook" },
  { id: "playbook", label: "Playbook", icon: BookOpen, href: "/playbook" },
  { id: "replay", label: "Trade Replay", icon: PlayCircle, href: "/replay" },
  { id: "backtesting", label: "Backtesting", icon: FlaskConical, href: "/backtesting" },
  { id: "settings", label: "Settings", icon: Settings, href: "/settings" },
];

export function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const pathname = usePathname();
  const router = useRouter();

  const addActive = pathname === "/add-trade";

  function onLogout() {
    clientClearToken();
    router.push("/login");
  }

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-30 flex flex-col bg-sidebar py-4 transition-[width] duration-200 ease-out",
        collapsed ? "w-[68px] px-2" : "w-[232px] px-3",
      )}
    >
      {/* floating collapse toggle (desktop rail handle) */}
      <button
        onClick={onToggle}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        className="absolute -right-3 top-6 z-40 grid h-6 w-6 place-items-center rounded-full border border-line bg-surface text-ink shadow-card transition-colors hover:text-primary-600"
      >
        {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>

      {/* brand */}
      <Link href="/" className={cn("mb-4 flex items-center", collapsed ? "justify-center" : "px-2")}>
        {collapsed ? (
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-primary-500 to-success text-[11px] font-black text-white">tJ</span>
        ) : (
          <span className="text-lg font-black tracking-tight">
            <span className="bg-gradient-to-r from-primary-300 via-primary-500 to-success bg-clip-text text-transparent">tradeJournaling</span>
          </span>
        )}
      </Link>

      {/* add trade */}
      <Link href="/add-trade" className={cn("mb-4 block", collapsed && "px-0")}>
        <Button className={cn("w-full", addActive && "ring-2 ring-primary-300")} title="Add Trade">
          <Plus size={14} strokeWidth={3} />
          {!collapsed && "Add Trade"}
        </Button>
      </Link>

      {/* nav (scrolls invisibly on short windows; no visible scrollbar) */}
      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto scrollbar-none">
        {NAV_ITEMS.map(({ id, label, icon: Icon, href }) => {
          const active = pathname === href;
          return (
            <Link
              key={id}
              href={href}
              title={collapsed ? label : undefined}
              className={cn(
                "flex items-center rounded-lg text-xs font-semibold transition-colors",
                collapsed ? "justify-center px-0 py-2.5" : "gap-2.5 px-3 py-2",
                active ? "bg-primary-500 text-white shadow-sm" : "text-white/60 hover:bg-white/5 hover:text-white",
              )}
            >
              <Icon size={15} strokeWidth={2.2} />
              {!collapsed && label}
            </Link>
          );
        })}
      </nav>

      {/* bottom: logout only — theme now lives solely in the topbar/settings store */}
      <div className={cn("mt-3 flex flex-col gap-1 border-t border-white/10 pt-3", collapsed && "items-center")}>
        <button
          onClick={onLogout}
          title="Logout"
          className={cn(
            "flex items-center rounded-lg text-xs font-semibold text-white/60 transition-colors hover:bg-white/5 hover:text-white",
            collapsed ? "justify-center px-0 py-2.5" : "gap-2.5 px-3 py-2",
          )}
        >
          <LogOut size={15} strokeWidth={2.2} />
          {!collapsed && "Logout"}
        </button>
      </div>
    </aside>
  );
}