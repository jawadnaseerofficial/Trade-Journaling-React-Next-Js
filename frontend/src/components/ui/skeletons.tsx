import { cn } from "@/lib/utils";

function Bar({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-line/70", className)} />;
}

function Card({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-card border border-line bg-surface p-4 shadow-card", className)}>
      <Bar className="h-4 w-24" />
      <Bar className="mt-3 h-8 w-32" />
      <Bar className="mt-3 h-3 w-40" />
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i} />
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <div className="rounded-card border border-line bg-surface p-4 shadow-card xl:col-span-2">
          <Bar className="h-4 w-32" />
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Bar key={i} className="h-24 w-full" />
            ))}
          </div>
        </div>

        <div className="rounded-card border border-line bg-surface p-4 shadow-card">
          <Bar className="h-4 w-24" />
          <div className="mt-4 space-y-3">
            {Array.from({ length: 7 }).map((_, i) => (
              <Bar key={i} className="h-10 w-full" />
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-card border border-line bg-surface p-4 shadow-card">
        <Bar className="h-4 w-28" />
        <div className="mt-4 space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Bar key={i} className="h-9 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 10 }: { rows?: number }) {
  return (
    <div className="rounded-card border border-line bg-surface p-4 shadow-card">
      <div className="mb-4 flex items-center justify-between gap-3">
        <Bar className="h-4 w-32" />
        <Bar className="h-8 w-24" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="grid grid-cols-6 gap-3 rounded-lg border border-line/70 bg-canvas/50 p-3">
            {Array.from({ length: 6 }).map((_, j) => (
              <Bar key={j} className="h-5 w-full" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function ChartSkeleton({ height = 280 }: { height?: number }) {
  return (
    <div className="rounded-card border border-line bg-surface p-4 shadow-card">
      <Bar className="h-4 w-32" />
      <div
        className="mt-4 grid gap-3"
        style={{ gridTemplateColumns: "repeat(12, minmax(0, 1fr))", height, alignItems: "end" }}
      >
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="animate-pulse rounded-t-lg bg-line/70" style={{ height: `${25 + ((i * 13) % 65)}%` }} />
        ))}
      </div>
    </div>
  );
}

export function NotebookSkeleton() {
  return (
    <div className="grid gap-5 lg:grid-cols-[260px_320px_1fr]">
      <div className="rounded-card border border-line bg-surface p-4 shadow-card">
        <Bar className="h-4 w-20" />
        <div className="mt-4 space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Bar key={i} className="h-8 w-full" />
          ))}
        </div>
      </div>
      <div className="rounded-card border border-line bg-surface p-4 shadow-card">
        <Bar className="h-8 w-full" />
        <div className="mt-4 space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Bar key={i} className="h-16 w-full" />
          ))}
        </div>
      </div>
      <div className="rounded-card border border-line bg-surface p-4 shadow-card">
        <Bar className="h-6 w-48" />
        <Bar className="mt-3 h-4 w-32" />
        <div className="mt-6 space-y-3">
          {Array.from({ length: 12 }).map((_, i) => (
            <Bar key={i} className="h-5 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}

export function FormSkeleton() {
  return (
    <div className="mx-auto max-w-2xl space-y-4 rounded-card border border-line bg-surface p-6 shadow-card">
      <Bar className="h-6 w-48" />
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Bar className="h-3 w-24" />
          <Bar className="h-9 w-full" />
        </div>
      ))}
      <div className="flex justify-end gap-2 pt-2">
        <Bar className="h-9 w-24" />
        <Bar className="h-9 w-28" />
      </div>
    </div>
  );
}