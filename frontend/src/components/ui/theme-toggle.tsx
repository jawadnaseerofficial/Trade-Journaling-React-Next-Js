"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useTheme, type Theme } from "@/lib/theme";

const OPTIONS: { id: Theme; label: string; Icon: typeof Sun }[] = [
  { id: "light", label: "Light", Icon: Sun },
  { id: "dark", label: "Dark", Icon: Moon },
  { id: "system", label: "System", Icon: Monitor },
];

/**
 * Single shared theme control. Render `variant="icon"` in the topbar and
 * `variant="segmented"` in Settings — both read/write the SAME store via
 * useTheme(), so they can never disagree.
 */
export function ThemeToggle({
  variant = "icon",
  className,
}: {
  variant?: "icon" | "segmented";
  className?: string;
}) {
  // `toggle` flips the *resolved* appearance (handles "system" correctly)
  // and is typed to the store, so no string-widening and no desync.
  const { theme, setTheme, toggle } = useTheme();

  // avoid hydration icon flash: render a neutral glyph until mounted
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (variant === "segmented") {
    return (
      <div
        role="radiogroup"
        aria-label="Theme"
        className={cn(
          "inline-flex items-center gap-1 rounded-lg border border-line bg-canvas p-1",
          className
        )}
      >
        {OPTIONS.map(({ id, label, Icon }) => {
          const active = mounted && theme === id;
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setTheme(id)}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-bold transition-colors",
                active
                  ? "bg-surface text-primary-600 shadow-sm"
                  : "text-ink-mute hover:text-ink-soft"
              )}
            >
              <Icon size={13} />
              <span className="hidden sm:inline">{label}</span>
            </button>
          );
        })}
      </div>
    );
  }

  // compact icon button for the topbar: shows the CURRENT mode,
  // click = flip light/dark via the store's resolved toggle
  const Icon = !mounted
    ? Sun
    : theme === "dark"
    ? Moon
    : theme === "system"
    ? Monitor
    : Sun;

  const modeLabel = !mounted ? "light" : theme;

  return (
    <button
      type="button"
      aria-label={`Theme: ${modeLabel}`}
      title={`Theme: ${modeLabel} — click to toggle light/dark`}
      onClick={toggle}
      className={cn(
        "grid h-8 w-8 place-items-center rounded-lg border border-line bg-surface text-ink-soft transition-all hover:border-primary-300 hover:text-primary-600",
        className
      )}
    >
      <Icon size={15} className="transition-transform duration-300" />
    </button>
  );
}