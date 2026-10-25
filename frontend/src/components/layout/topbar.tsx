"use client";
import { Bell, CalendarRange, ChevronDown, ChevronLeft, ChevronsUpDown, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Topbar({
  title,
  rangeLabel,
  onToggle,
}: {
  title: string;
  rangeLabel?: string;
  onToggle: () => void;
}) {
  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-line bg-surface px-5">
      <Button variant="icon" size="iconSm" aria-label="Toggle sidebar" onClick={onToggle}>
        <ChevronLeft size={15} />
      </Button>
      <h1 className="text-sm font-bold">{title}</h1>

      <div className="ml-auto flex items-center gap-2">
        <Button variant="icon" size="iconSm" className="rounded-full border-0 bg-primary-50 text-primary-600">
          <Sparkles size={14} />
        </Button>
        <Button variant="icon" size="sm" className="rounded-lg px-2.5">
          <CalendarRange size={14} className="text-primary-500" />
          <span className="text-[11px] font-semibold">{rangeLabel ?? "Select date range"}</span>
          <ChevronDown size={13} className="text-ink-mute" />
        </Button>
        <Button variant="icon" size="sm" className="rounded-lg px-2.5">
          <span className="grid h-4 w-4 place-items-center rounded-full bg-primary-100 text-[8px] font-black text-primary-600">W</span>
          <span className="text-[11px] font-semibold">Webull Main PA</span>
          <ChevronsUpDown size={13} className="text-ink-mute" />
        </Button>
        <Button variant="icon" size="iconSm" aria-label="Notifications">
          <Bell size={15} />
        </Button>
      </div>
    </header>
  );
}