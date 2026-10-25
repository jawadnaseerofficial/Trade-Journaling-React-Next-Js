import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { InfoHint } from "./info-hint";

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <section className={cn("rounded-card border border-line bg-surface shadow-card", className)}>
      {children}
    </section>
  );
}

export function CardHeader({
  title,
  hint,
  right,
  className,
}: {
  title?: string;
  hint?: string;
  right?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("flex items-center justify-between px-4 pb-2 pt-4", className)}>
      <div className="flex items-center gap-1.5">
        {title ? <h3 className="text-xs font-bold text-ink">{title}</h3> : null}
        {hint ? <InfoHint text={hint} /> : null}
      </div>
      {right}
    </header>
  );
}