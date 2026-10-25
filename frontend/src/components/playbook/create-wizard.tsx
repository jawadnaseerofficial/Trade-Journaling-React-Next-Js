"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, ArrowLeft, GripVertical, Plus, Trash2, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { clientGetToken } from "@/lib/auth";

const EMOJIS = ["📈", "", "", "", "", "", "🎯", "⚡", "🌊", "", "", "", "✋", "❌", "🟨", "🔄"];
const COLORS = ["#6D5DE7", "#12B981", "#E5484D", "#F5A524", "#0EA5E9", "#EC4899", "#111827", "#FACC15"];
const VISIBILITIES = [
  { id: "always", label: "Always" },
  { id: "winner", label: "When trade is a winner" },
  { id: "loser", label: "When trade is a loser" },
  { id: "break_even", label: "When trade is break even" },
];

type DraftRule = { key: string; name: string; visibility: string };
type DraftGroup = { key: string; name: string; rules: DraftRule[] };

const newKey = () => Math.random().toString(36).slice(2, 9);

export function CreateWizard() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const [picker, setPicker] = useState<"none" | "icon" | "color">("none");
  const [groups, setGroups] = useState<DraftGroup[]>([
    { key: newKey(), name: "Entry Criteria", rules: [] },
    { key: newKey(), name: "Exit Criteria", rules: [] },
    { key: newKey(), name: "Market Conditions", rules: [] },
  ]);
  const [modal, setModal] = useState<{ groupKey: string } | null>(null);
  const [ruleName, setRuleName] = useState("");
  const [ruleVis, setRuleVis] = useState("always");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function addGroup() { setGroups((g) => [...g, { key: newKey(), name: `Group ${g.length + 1}`, rules: [] }]); }
  function renameGroup(key: string, n: string) { setGroups((g) => g.map((x) => (x.key === key ? { ...x, name: n } : x))); }
  function deleteGroup(key: string) { setGroups((g) => g.filter((x) => x.key !== key)); }
  function addInlineRule(gk: string) { setGroups((g) => g.map((x) => x.key === gk ? { ...x, rules: [...x.rules, { key: newKey(), name: "", visibility: "always" }] } : x)); }
  function setRule(gk: string, rk: string, n: string) { setGroups((g) => g.map((x) => x.key === gk ? { ...x, rules: x.rules.map((r) => r.key === rk ? { ...r, name: n } : r) } : x)); }
  function delRule(gk: string, rk: string) { setGroups((g) => g.map((x) => x.key === gk ? { ...x, rules: x.rules.filter((r) => r.key !== rk) } : x)); }

  async function create() {
    setBusy(true); setErr(null);
    try {
      const res = await api.playbooks.create({
        name: name.trim(), description: description.trim() || null, icon, color,
        groups: groups.map((g) => ({ name: g.name, rules: g.rules.filter((r) => r.name.trim()).map((r) => ({ name: r.name.trim(), visibility: r.visibility })) })),
      }, clientGetToken() ?? undefined);
      router.push(`/playbook/${res.id}`);
    } catch (e) { setErr(e instanceof Error ? e.message : "Create failed"); setBusy(false); }
  }

  return (
    <Card className="mx-auto w-full max-w-3xl p-6">
      {/* progress bars */}
      <div className="grid grid-cols-2 gap-6">
        <div>
          <div className={cn("h-1 rounded-full", step >= 1 ? "bg-ink" : "bg-line")} />
          <p className="mt-2 text-xs font-bold">General Information</p>
          <p className="text-[10px] text-ink-soft">Upload an icon or an image and name your trading playbook and get going with tradeJournaling.</p>
        </div>
        <div>
          <div className={cn("h-1 rounded-full", step >= 2 ? "bg-success" : "bg-line")} />
          <p className="mt-2 text-xs font-bold">Trading Playbook Rules</p>
          <p className="text-[10px] text-ink-soft">List your rules, track and optimize your playbook.</p>
        </div>
      </div>

      {step === 1 ? (
        <div className="mt-6">
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setPicker(picker === "icon" ? "none" : "icon")}>Add Icon</Button>
            <Button variant="outline" size="sm" onClick={() => setPicker(picker === "color" ? "none" : "color")}>Choose a Color</Button>
          </div>
          <p className="mt-1 text-[10px] text-ink-soft">Add Icon or choose a colour that represents your Playbook.</p>
          {picker === "icon" && (
            <div className="mt-2 flex flex-wrap gap-1 rounded-card border border-line p-2">
              {EMOJIS.map((e) => (
                <button key={e} onClick={() => { setIcon(e); setPicker("none"); }} className="grid h-8 w-8 place-items-center rounded hover:bg-canvas text-base">{e}</button>
              ))}
              {icon && <button onClick={() => setIcon("")} className="ml-auto flex items-center gap-1 px-2 text-[10px] text-ink-mute"><X size={11} /> clear</button>}
            </div>
          )}
          {picker === "color" && (
            <div className="mt-2 flex flex-wrap gap-2 rounded-card border border-line p-2">
              {COLORS.map((c) => (
                <button key={c} onClick={() => { setColor(c); setPicker("none"); }}
                  className={cn("h-7 w-7 rounded-full border-2", color === c ? "border-ink" : "border-transparent")} style={{ background: c }} />
              ))}
            </div>
          )}
          <div className="mt-4 flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-lg text-lg" style={{ background: `${color}22` }}>
              {icon || <span className="h-4 w-4 rounded" style={{ background: color }} />}
            </span>
            <div className="flex-1">
              <label className="text-[11px] font-semibold">Playbook Name</label>
              <Input className="mt-1" value={name} onChange={(e) => setName(e.target.value)} placeholder="Name your trading playbook" />
            </div>
          </div>
          <label className="mt-4 block text-[11px] font-semibold">Description</label>
          <Input className="mt-1" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Add description to your trading playbook" />
        </div>
      ) : (
        <div className="mt-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-bold">Trading Playbook Rules</p>
              <p className="text-[10px] text-ink-soft">Define your playbook rules with grouping.</p>
            </div>
            <Button variant="outline" size="sm" onClick={addGroup}><Plus size={12} /> Create New Group</Button>
          </div>

          <div className="mt-4 flex flex-col gap-3 rounded-card bg-canvas/60 p-3">
            {groups.map((g) => (
              <div key={g.key} className="rounded-card border border-line bg-surface p-3">
                <div className="flex items-center gap-2">
                  <GripVertical size={13} className="text-ink-mute" />
                  <input value={g.name} onChange={(e) => renameGroup(g.key, e.target.value)}
                    className="flex-1 bg-transparent text-xs font-bold outline-none" />
                  <button onClick={() => deleteGroup(g.key)} className="flex items-center gap-1 text-[10px] font-bold text-danger hover:underline"><Trash2 size={11} /> Delete</button>
                </div>
                <div className="mt-2 flex flex-col gap-2 pl-6">
                  {g.rules.map((r) => (
                    <div key={r.key} className="flex items-center gap-2">
                      <GripVertical size={12} className="text-ink-mute" />
                      <Input className="h-8 flex-1 text-[11px]" value={r.name} placeholder="Rule name…" onChange={(e) => setRule(g.key, r.key, e.target.value)} />
                      <button onClick={() => delRule(g.key, r.key)} className="flex items-center gap-1 text-[10px] font-bold text-danger hover:underline"><Trash2 size={11} /> Delete</button>
                    </div>
                  ))}
                  <button onClick={() => addInlineRule(g.key)} className="flex w-fit items-center gap-1 text-[11px] font-bold text-primary-600 hover:underline"><Plus size={12} /> Create new rule</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {err && <p className="mt-3 text-[11px] font-semibold text-danger">{err}</p>}

      <div className="mt-6 flex items-center justify-end gap-2 border-t border-line pt-4">
        <Button variant="ghost" size="sm" onClick={() => router.push("/playbook")}>Cancel</Button>
        {step === 2 && <Button variant="outline" size="sm" onClick={() => setStep(1)}><ArrowLeft size={12} /> Previous</Button>}
        {step === 1 ? (
          <Button size="sm" disabled={!name.trim()} onClick={() => setStep(2)}>Next <ArrowRight size={12} /></Button>
        ) : (
          <Button size="sm" disabled={busy} onClick={create}>{busy ? "Creating…" : "Create Playbook"}</Button>
        )}
      </div>

      {/* rule modal (name + visibility) — used from detail Rules tab too via same shape */}
      <Dialog open={!!modal} onClose={() => setModal(null)} title="Create new rule"
        footer={<><Button variant="ghost" size="sm" onClick={() => setModal(null)}>Cancel</Button>
          <Button size="sm" disabled={!ruleName.trim()} onClick={async () => {
            if (!modal) return;
            setGroups((g) => g.map((x) => x.key === modal.groupKey ? { ...x, rules: [...x.rules, { key: newKey(), name: ruleName.trim(), visibility: ruleVis }] } : x));
            setRuleName(""); setRuleVis("always"); setModal(null);
          }}>Create</Button></>}>
        <Input value={ruleName} onChange={(e) => setRuleName(e.target.value)} placeholder="How do you call this rule?" />
        <p className="mt-3 text-[11px] text-ink-soft">Show rule only when:</p>
        <div className="mt-2 flex flex-col gap-2">
          {VISIBILITIES.map((v) => (
            <label key={v.id} className="flex items-center gap-2 text-[11px] font-semibold">
              <input type="radio" name="rulevis" checked={ruleVis === v.id} onChange={() => setRuleVis(v.id)} /> {v.label}
            </label>
          ))}
        </div>
      </Dialog>
    </Card>
  );
}