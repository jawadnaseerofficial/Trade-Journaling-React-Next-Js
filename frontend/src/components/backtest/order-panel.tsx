"use client";
import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { cn, money } from "@/lib/utils";
import { sizeFromRisk } from "@/lib/backtest-engine";
import type { BtOrderPayload } from "@/types";

const RISK_CHIPS = [0.5, 1, 2, 3, 5];

export function OrderPanel({ symbol, currentPrice, balance, startBalance, onClose, onSubmit }:
  { symbol: string; currentPrice: number; balance: number; startBalance: number;
    onClose: () => void; onSubmit: (p: BtOrderPayload) => void }) {
  const [advanced, setAdvanced] = useState(false);
  const [basis, setBasis] = useState<"current" | "initial">("current");
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [type, setType] = useState<"market" | "limit">("market");
  const [qty, setQty] = useState(0);
  const [limitPrice, setLimitPrice] = useState(0);
  const [tp, setTp] = useState(0);
  const [sl, setSl] = useState(0);
  const [riskPct, setRiskPct] = useState(1);

  const refEntry = type === "limit" && limitPrice > 0 ? limitPrice : currentPrice;
  const basisBal = basis === "initial" ? startBalance : balance;
  const sized = useMemo(() => (advanced ? sizeFromRisk({ balance: basisBal, entry: refEntry, sl: sl > 0 ? sl : null, riskPct }) : null), [advanced, basisBal, refEntry, sl, riskPct]);
  const effQty = advanced && sized != null ? sized : qty;
  const riskAmount = advanced ? basisBal * (riskPct / 100) : (sl > 0 ? Math.abs(refEntry - sl) * effQty : 0);
  const reward = tp > 0 ? Math.abs(tp - refEntry) * effQty : 0;

  function submit(s: "buy" | "sell") {
    if (effQty <= 0) return;
    onSubmit({ side: s, type, qty: effQty, limitPrice: type === "limit" ? limitPrice : null,
      tp: tp > 0 ? tp : null, sl: sl > 0 ? sl : null, riskPct: advanced ? riskPct : null, basis: advanced ? basis : undefined });
  }

  return (
    <div className="flex h-full w-72 shrink-0 flex-col border-l border-line bg-surface">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <p className="text-xs font-extrabold uppercase tracking-wide">Place order</p>
        <button onClick={onClose} className="text-ink-mute hover:text-ink"><X size={15} /></button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin p-4">
        <label className="flex items-center justify-between rounded-lg border border-line px-3 py-2 text-[11px] font-bold">
          Advanced order
          <button onClick={() => setAdvanced((v) => !v)} className={cn("relative h-4 w-7 rounded-full transition-colors", advanced ? "bg-primary-500" : "bg-line")}>
            <span className={cn("absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all", advanced ? "left-3.5" : "left-0.5")} />
          </button>
        </label>

        {advanced && (
          <>
            <div className="mt-3 flex gap-3 text-[11px] font-semibold">
              {(["current", "initial"] as const).map((b) => (
                <label key={b} className="flex items-center gap-1.5 capitalize">
                  <input type="radio" name="basis" checked={basis === b} onChange={() => setBasis(b)} className="accent-primary-500" /> {b} balance
                </label>
              ))}
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {RISK_CHIPS.map((c) => (
                <button key={c} onClick={() => setRiskPct(c)} className={cn("rounded border px-2 py-1 text-[10px] font-bold", riskPct === c ? "border-primary-500 bg-primary-50 text-primary-600" : "border-line text-ink-soft hover:bg-canvas")}>{c}%</button>
              ))}
            </div>
            <Field label="Risk percent"><UnitInput type="number" step="any" value={riskPct} onChange={(e) => setRiskPct(Number(e.target.value))} unit="%" /></Field>
            <Field label="Risk amount"><div className="flex h-9 items-center justify-between rounded-lg border border-line px-3 text-[11px] font-bold tabular-nums"><span>{money(riskAmount)}</span><span className="text-ink-mute">USD</span></div></Field>
            <Field label="Position size"><div className="flex h-9 items-center justify-between rounded-lg border border-line px-3 text-[11px] font-bold tabular-nums"><span>{sized != null ? sized.toFixed(4) : qty || "--"}</span><span className="text-ink-mute">{symbol}</span></div></Field>
          </>
        )}

        <div className="mt-3 grid grid-cols-2 gap-2">
          <Field label="Type">
            <Select value={type} onChange={(e) => setType(e.target.value as "market" | "limit")}><option value="market">Market</option><option value="limit">Limit</option></Select>
          </Field>
          <Field label="Market price"><div className="flex h-9 items-center rounded-lg bg-canvas px-3 text-[11px] font-bold tabular-nums">USD {currentPrice.toFixed(2)}</div></Field>
        </div>
        {type === "limit" && <Field label="Limit price"><Input type="number" step="any" value={limitPrice} onChange={(e) => setLimitPrice(Number(e.target.value))} placeholder="USD" /></Field>}
        {!advanced && <Field label="Quantity"><UnitInput type="number" step="any" value={qty} onChange={(e) => setQty(Number(e.target.value))} unit={symbol} /></Field>}
        <div className="mt-2 grid grid-cols-2 gap-2">
          <Field label="Profit target"><Input type="number" step="any" value={tp} onChange={(e) => setTp(Number(e.target.value))} placeholder="USD 0" /></Field>
          <Field label="Stop loss"><Input type="number" step="any" value={sl} onChange={(e) => setSl(Number(e.target.value))} placeholder="USD 0" /></Field>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <Stat label="Reward" value={money(reward)} tone="pos" /><Stat label="Risk" value={money(riskAmount)} tone="neg" /><Stat label="Total" value={money(riskAmount)} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 border-t border-line p-3">
        <Button className="bg-success text-white hover:bg-success-deep" disabled={effQty <= 0} onClick={() => submit("buy")}>Buy</Button>
        <Button className="bg-danger text-white hover:bg-danger-deep" disabled={effQty <= 0} onClick={() => submit("sell")}>Sell</Button>
      </div>
    </div>
  );
}

// Input + trailing unit, WITHOUT mutating the shared ui/input primitive.
function UnitInput({ unit, className, ...rest }: { unit: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="relative">
      <Input className={cn("pr-10", className)} {...rest} />
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-ink-mute">{unit}</span>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="mt-3 block text-[10px] font-semibold text-ink-soft">{label}<div className="mt-1">{children}</div></label>;
}
function Stat({ label, value, tone }: { label: string; value: string; tone?: "pos" | "neg" }) {
  return <div><p className={cn("text-[9px] font-bold uppercase", tone === "pos" ? "text-success" : tone === "neg" ? "text-danger" : "text-ink-mute")}>{label}</p><p className="text-[11px] font-bold tabular-nums">{value}</p></div>;
}