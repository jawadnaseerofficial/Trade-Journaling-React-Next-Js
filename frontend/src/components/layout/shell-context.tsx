"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type ShellState = {
  title: string;
  rangeLabel?: string;
  setTitle: (t: string) => void;
  setRangeLabel: (r?: string) => void;
};

const ShellCtx = createContext<ShellState | null>(null);

export function ShellProvider({ children }: { children: ReactNode }) {
  const [title, setTitle] = useState("");
  const [rangeLabel, setRangeLabel] = useState<string | undefined>(undefined);

  const value = useMemo(
    () => ({ title, rangeLabel, setTitle, setRangeLabel }),
    [title, rangeLabel],
  );

  return <ShellCtx.Provider value={value}>{children}</ShellCtx.Provider>;
}

export function useShell() {
  const ctx = useContext(ShellCtx);
  if (!ctx) throw new Error("useShell must be used inside <ShellProvider>");
  return ctx;
}