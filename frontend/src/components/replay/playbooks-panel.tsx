"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { clientGetToken } from "@/lib/auth";
import type { ReplayTrade, WithRulesPlaybook } from "@/types";

export function PlaybooksPanel({ trade, onChanged }: { trade: ReplayTrade; onChanged: () => void }) {
  const tok = () => clientGetToken() ?? undefined;
  const [list, setList] = useState<WithRulesPlaybook[]>([]);
  const [selected, setSelected] = useState<string | null>(trade.playbook ?? null);
  const [followed, setFollowed] = useState<Set<string>>(new Set());

  useEffect(() => { api.playbooks.withRules(tok()).then(setList).catch(() => {}); }, []);
  useEffect(() => { setSelected(trade.playbook ?? null); setFollowed(new Set()); }, [trade.id, trade.playbook]);

  const pb = list.find((p) => p.id === selected) ?? null;
  const visibleRules = useMemo(() => {
    if (!pb) return [];
    const outcome = trade.netPnl > 0 ? "winner" : trade.netPnl < 0 ? "loser" : "break_even";
    return pb.groups.flatMap((g) => g.rules).filter((r) => r.visibility === "always" || r.visibility === outcome);
  }, [pb, trade.netPnl]);

  async function persist(nextSel: string | null, nextFollowed: Set<string>) {
    await api.trades.setPlaybook(trade.id, {
      playbookId: nextSel,
      rules: nextSel ? (list.find((p) => p.id === nextSel)?.groups.flatMap((g) => g.rules) ?? []).map((r) => ({ ruleId: r.id, followed: nextFollowed.has(r.id) })) : [],
    }, tok());
    onChanged();
  }
  function toggle(ruleId: string) {
    const n = new Set(followed);
    n.has(ruleId) ? n.delete(ruleId) : n.add(ruleId);
    setFollowed(n);
    persist(selected, n);
  }
  function checkAll() {
    const n = new Set(visibleRules.map((r) => r.id));
    setFollowed(n);
    persist(selected, n);
  }

  const followedVisible = visibleRules.filter((r) => followed.has(r.id)).length;

  return (
    <div className="mt-3">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-bold">Playbook</p>
        <Link href="/playbook/create" className="text-[10px] font-bold text-primary-600 hover:underline">Create new playbook</Link>
      </div>
      <select
        value={selected ?? ""}
        onChange={(e) => { const v = e.target.value || null; setSelected(v); setFollowed(new Set()); persist(v, new Set()); }}
        className="mt-1 h-9 w-full rounded-lg border border-line bg-surface px-2 text-xs font-medium outline-none focus:border-primary-500"
      >
        <option value="">— no playbook —</option>
        {list.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>

      {pb && (
        <>
          <div className="mt-3 flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-wide text-ink-mute">Rules Followed</p>
            <button onClick={checkAll} className="text-[10px] font-bold text-primary-600 hover:underline">CHECK ALL</button>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-canvas">
            <div className="h-full bg-success transition-all" style={{ width: `${visibleRules.length ? (followedVisible / visibleRules.length) * 100 : 0}%` }} />
          </div>
          <p className="mt-0.5 text-right text-[10px] font-bold tabular-nums text-ink-soft">{followedVisible} / {visibleRules.length}</p>

          {pb.groups.map((g) => {
            const rules = g.rules.filter((r) => visibleRules.some((v) => v.id === r.id));
            if (!rules.length) return null;
            return (
              <div key={g.id} className="mt-3">
                <p className="text-[9px] font-extrabold uppercase tracking-wide text-ink-mute">{g.name}</p>
                <div className="mt-1 flex flex-col gap-1.5">
                  {rules.map((r) => (
                    <label key={r.id} className="flex items-center gap-2 text-[11px] font-semibold text-ink-soft">
                      <input type="checkbox" checked={followed.has(r.id)} onChange={() => toggle(r.id)}
                        className="h-3.5 w-3.5 accent-primary-500" />
                      {r.name}
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}