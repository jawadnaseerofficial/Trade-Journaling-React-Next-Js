"use client";

import { useEffect } from "react";

export const DATA_REFRESH_EVENT = "tj:data-imported";

export function notifyDataRefresh() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(DATA_REFRESH_EVENT));
}

export function useDataRefresh(onRefresh: () => void | Promise<void>) {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handler = () => {
      void onRefresh();
    };

    window.addEventListener(DATA_REFRESH_EVENT, handler);
    return () => window.removeEventListener(DATA_REFRESH_EVENT, handler);
  }, [onRefresh]);
}
