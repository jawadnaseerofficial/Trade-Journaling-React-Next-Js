import { compactMoney } from "@/lib/utils";

export function DonutRing({ winRate }: { winRate: number }) {
  const r = 15;
  const c = 2 * Math.PI * r;
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" className="-rotate-90">
      <circle cx="20" cy="20" r={r} fill="none" stroke="#E5484D" strokeWidth="4" />
      <circle
        cx="20" cy="20" r={r} fill="none" stroke="#12B981" strokeWidth="4"
        strokeDasharray={`${(winRate / 100) * c} ${c}`} strokeLinecap="round"
      />
    </svg>
  );
}

export function WinGauge({ winRate }: { winRate: number }) {
  const r = 26;
  const half = Math.PI * r;
  return (
    <div className="flex flex-col items-center">
      <svg width="64" height="36" viewBox="0 0 64 36">
        <path d="M6 32 A 26 26 0 0 1 58 32" fill="none" stroke="#FADADD" strokeWidth="5" strokeLinecap="round" />
        <path
          d="M6 32 A 26 26 0 0 1 58 32" fill="none" stroke="#12B981" strokeWidth="5"
          strokeLinecap="round" strokeDasharray={`${(winRate / 100) * half} ${half}`}
        />
      </svg>
      <div className="-mt-1 flex gap-2">
        <span className="h-1.5 w-1.5 rounded-full bg-success" />
        <span className="h-1.5 w-1.5 rounded-full bg-primary-500" />
        <span className="h-1.5 w-1.5 rounded-full bg-danger" />
      </div>
    </div>
  );
}

export function RatioBar({ avgWin, avgLoss }: { avgWin: number; avgLoss: number }) {
  const winShare = (avgWin / (avgWin + Math.abs(avgLoss))) * 100;
  return (
    <div className="w-28">
      <div className="flex h-1.5 overflow-hidden rounded-full">
        <div className="bg-success" style={{ width: `${winShare}%` }} />
        <div className="bg-danger" style={{ width: `${100 - winShare}%` }} />
      </div>
      <div className="mt-1 flex justify-between text-[9px] font-bold tabular-nums">
        <span className="text-success">{compactMoney(avgWin)}</span>
        <span className="text-danger">{compactMoney(avgLoss)}</span>
      </div>
    </div>
  );
}