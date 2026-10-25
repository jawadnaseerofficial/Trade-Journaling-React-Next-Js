"use client";
import { cn } from "@/lib/utils";

export interface TabItem {
  id: string;
  label: string;
}

export function Tabs({
  items,
  active,
  onChange,
}: {
  items: TabItem[];
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex items-center gap-5 border-b border-line px-4">
      {items.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={cn(
            "-mb-px border-b-2 pb-2.5 pt-3 text-[11px] font-bold uppercase tracking-wider transition-colors",
            active === t.id
              ? "border-primary-500 text-primary-600"
              : "border-transparent text-ink-mute hover:text-ink-soft",
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}