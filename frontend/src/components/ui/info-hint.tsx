import { Info } from "lucide-react";

export function InfoHint({ text }: { text: string }) {
  return (
    <span className="group relative inline-flex">
      <Info size={13} className="cursor-help text-ink-mute" />
      <span className="pointer-events-none absolute left-1/2 top-full z-20 mt-1.5 -translate-x-1/2 whitespace-nowrap rounded-md bg-sidebar px-2 py-1 text-[10px] font-medium text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
        {text}
      </span>
    </span>
  );
}