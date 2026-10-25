"use client";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

export function StarRating({ value, onChange, size = 16 }: { value: number | null; onChange?: (v: number) => void; size?: number }) {
  const v = value ?? 0;
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          disabled={!onChange}
          onClick={() => onChange?.(i === v ? 0 : i)}
          className={cn(onChange ? "cursor-pointer" : "cursor-default")}
          aria-label={`${i} star${i > 1 ? "s" : ""}`}
        >
          <Star size={size} className={i <= v ? "fill-warn text-warn" : "text-line"} />
        </button>
      ))}
    </div>
  );
}