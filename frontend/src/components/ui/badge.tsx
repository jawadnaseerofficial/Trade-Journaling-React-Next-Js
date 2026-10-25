import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const tones = {
  warn: "bg-warn/15 text-warn",
  primary: "bg-primary-50 text-primary-600",
  success: "bg-success-soft text-success-deep",
};

export function Badge({
  children,
  tone = "warn",
  className,
}: {
  children: ReactNode;
  tone?: keyof typeof tones;
  className?: string;
}) {
  return (
    <span className={cn("rounded px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider", tones[tone], className)}>
      {children}
    </span>
  );
}