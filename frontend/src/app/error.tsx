"use client";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="grid min-h-[60vh] place-items-center p-8">
      <div className="max-w-sm text-center">
        <h2 className="text-base font-bold">Something went wrong</h2>
        <p className="mt-2 text-xs text-ink-soft">{error.message}</p>
        <Button className="mt-4" onClick={reset}>Try again</Button>
      </div>
    </div>
  );
}