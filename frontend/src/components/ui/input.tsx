import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "h-9 w-full rounded-lg border border-line bg-surface px-3 text-xs font-medium text-ink",
        "placeholder:text-ink-mute focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";