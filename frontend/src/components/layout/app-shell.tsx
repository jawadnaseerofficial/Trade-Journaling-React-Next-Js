"use client";

import { useEffect, type ReactNode } from "react";
import { useShell } from "./shell-context";

export function AppShell({
  title,
  rangeLabel,
  children,
}: {
  title: string;
  rangeLabel?: string;
  children: ReactNode;
}) {
  const { setTitle, setRangeLabel } = useShell();

  useEffect(() => {
    setTitle(title);
  }, [title, setTitle]);

  useEffect(() => {
    setRangeLabel(rangeLabel);
  }, [rangeLabel, setRangeLabel]);

  // The real sidebar + topbar are rendered once by <RootChrome> in the layout.
  // Here we only pass the page content through, so navigation never remounts the chrome.
  return <>{children}</>;
}