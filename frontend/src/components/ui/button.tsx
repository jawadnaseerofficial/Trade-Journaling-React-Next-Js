"use client";
import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Variant = "solid" | "outline" | "ghost" | "icon";
type Size = "sm" | "md" | "icon" | "iconSm";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const styles: Record<Variant, string> = {
  solid: "bg-primary-500 text-white hover:bg-primary-600 shadow-sm",
  outline: "bg-surface text-primary-600 border border-line hover:border-primary-300 hover:bg-primary-50",
  ghost: "text-ink-soft hover:bg-primary-50 hover:text-primary-600",
  icon: "bg-surface border border-line text-ink-soft hover:text-primary-600 hover:border-primary-300",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-9 px-4 text-xs",
  icon: "h-9 w-9",
  iconSm: "h-8 w-8",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "solid", size = "md", ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-lg font-semibold transition-colors",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500",
        "disabled:pointer-events-none disabled:opacity-50",
        styles[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  ),
);
Button.displayName = "Button";