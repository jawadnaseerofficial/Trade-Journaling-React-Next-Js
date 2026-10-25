import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

const safe = (v: number | null | undefined): number =>
  typeof v === "number" && Number.isFinite(v) ? v : 0;

export const money = (v: number, opts?: { sign?: boolean }) => {
  const n = safe(v);
  const abs = Math.abs(n).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const sign = n < 0 ? "-" : opts?.sign && n > 0 ? "+" : "";
  return `${sign}$${abs}`;
};

export const compactMoney = (v: number) => {
  const n = safe(v);
  return `${n < 0 ? "-" : ""}$${Math.abs(n).toLocaleString("en-US", { maximumFractionDigits: 1 })}`;
};

export const pct = (v: number) => `${safe(v).toFixed(2)}%`;