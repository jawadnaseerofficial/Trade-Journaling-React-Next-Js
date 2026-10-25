import { cn, money } from "@/lib/utils";

export function Money({ value, className }: { value: number; className?: string }) {
  return (
    <span
      className={cn(
        "font-semibold tabular-nums",
        value > 0 ? "text-success" : value < 0 ? "text-danger" : "text-ink",
        className,
      )}
    >
      {money(value)}
    </span>
  );
}