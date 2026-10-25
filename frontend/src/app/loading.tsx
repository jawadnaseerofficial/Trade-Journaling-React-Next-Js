export default function Loading() {
  return (
    <div className="flex animate-pulse flex-col gap-4">
      <div className="h-6 w-40 rounded bg-line/60" />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-24 rounded-card bg-line/40" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-64 rounded-card bg-line/40" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="h-72 rounded-card bg-line/40" />
        <div className="h-72 rounded-card bg-line/40 lg:col-span-2" />
      </div>
    </div>
  );
}