"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FileClock, Plus, RefreshCw, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { clientGetToken } from "@/lib/auth";
import { brokerById, syncBrokers } from "@/lib/brokers";
import type { BrokerConnection } from "@/types";

type CredValue = string | boolean;

export function BrokerSyncTab() {
  const router = useRouter();
  const providers = useMemo(() => syncBrokers(), []);
  const [list, setList] = useState<BrokerConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [brokerId, setBrokerId] = useState(providers[0]?.id ?? "alpaca");
  const [label, setLabel] = useState("");
  const [creds, setCreds] = useState<Record<string, CredValue>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);

  const meta = brokerById(brokerId);

  const load = useCallback(async () => {
    setLoading(true);
    try { setList(await api.brokers.list(clientGetToken() ?? undefined)); }
    catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  function pickBroker(id: string) {
    setBrokerId(id);
    const init: Record<string, CredValue> = {};
    for (const f of brokerById(id).credentialFields) init[f.name] = f.type === "checkbox" ? false : "";
    setCreds(init);
  }
  useEffect(() => { pickBroker(providers[0]?.id ?? "alpaca"); }, [providers]);

  const missingRequired = meta.credentialFields.some(
    (f) => f.required && f.type !== "checkbox" && !String(creds[f.name] ?? "").trim(),
  );

  async function add() {
    setBusy(true); setError(null);
    try {
      await api.brokers.create(brokerId, label || meta.name, creds, clientGetToken() ?? undefined);
      setOpen(false); setLabel(""); pickBroker(brokerId);
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not add broker"); }
    finally { setBusy(false); }
  }

  async function sync(id: string) {
    setSyncingId(id); setError(null);
    try {
      const r = await api.brokers.sync(id, clientGetToken() ?? undefined);
      await load();
      if (r.importedTrades > 0) setTimeout(() => { router.push("/"); router.refresh(); }, 1000);
    } catch (e) { setError(e instanceof Error ? e.message : "Sync failed"); await load(); }
    finally { setSyncingId(null); }
  }

  async function remove(id: string) {
    await api.brokers.remove(id, clientGetToken() ?? undefined);
    await load();
  }

  return (
    <Card className="min-h-[420px] p-6">
      {loading ? (
        <p className="text-center text-[11px] text-ink-mute">Loading connections…</p>
      ) : list.length === 0 ? (
        <div className="grid place-items-center py-16 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-canvas"><FileClock size={22} className="text-ink-mute" /></span>
          <p className="mt-3 text-xs font-semibold text-ink-soft">No Broker added yet</p>
          <Button className="mt-4" onClick={() => setOpen(true)}><Plus size={14} /> Add New Broker</Button>
          <p className="mt-3 max-w-sm text-[10px] text-ink-mute">
            Live sync is available for {providers.map((p) => p.name).join(", ")}. Every other broker
            (Webull, Binance, Coinbase, IBKR, Robinhood, Fidelity, OANDA, MT5…) is fully supported through
            the <span className="font-bold text-ink-soft">File Upload</span> tab using their real exported CSV.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold">Connected brokers</h3>
            <Button size="sm" onClick={() => setOpen(true)}><Plus size={13} /> Add New Broker</Button>
          </div>
          {error && <p className="text-[11px] font-semibold text-danger">{error}</p>}
          {list.map((c) => (
            <div key={c.id} className="flex items-center justify-between rounded-card border border-line bg-canvas/40 px-4 py-3">
              <div>
                <p className="text-xs font-bold">{c.label || c.broker}</p>
                <p className="text-[10px] text-ink-mute">{c.broker} · {c.lastSyncAt ? `last sync ${new Date(c.lastSyncAt).toLocaleString()}` : "never synced"}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={c.status === "active" ? "success" : "warn"}>{c.status}</Badge>
                <Button variant="outline" size="sm" disabled={syncingId === c.id} onClick={() => sync(c.id)}>
                  <RefreshCw size={12} className={syncingId === c.id ? "animate-spin" : ""} /> Sync now
                </Button>
                <Button variant="ghost" size="iconSm" aria-label="Remove" onClick={() => remove(c.id)}><Trash2 size={14} /></Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} title="Add New Broker"
        footer={<>
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
          <Button size="sm" disabled={busy || missingRequired} onClick={add}>{busy ? "Saving…" : "Save & Test"}</Button>
        </>}>
        <div className="flex flex-col gap-3">
          <p className="text-[11px] text-ink-soft">
            Only brokers with a real public "all fills" API appear here. Secrets are encrypted at rest.
            For any other broker, close this and use the File Upload tab with its exported CSV.
          </p>
          <label className="text-[11px] font-semibold">Broker</label>
          <Select value={brokerId} onChange={(e) => pickBroker(e.target.value)}>
            {providers.map((b) => <option key={b.id} value={b.id}>{b.name} — {b.category}</option>)}
          </Select>
          <label className="text-[11px] font-semibold">Label (optional)</label>
          <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder={`e.g. ${meta.name} Live`} />
          {meta.credentialFields.map((f) => (
            <div key={f.name} className="flex flex-col gap-1">
              {f.type === "checkbox" ? (
                <label className="flex items-center gap-2 text-[11px] font-semibold">
                  <input type="checkbox" checked={Boolean(creds[f.name])}
                    onChange={(e) => setCreds((c) => ({ ...c, [f.name]: e.target.checked }))} />
                  {f.label}
                </label>
              ) : (
                <>
                  <label className="text-[11px] font-semibold">{f.label}{f.required ? " *" : ""}</label>
                  {f.type === "textarea" ? (
                    <textarea
                      value={String(creds[f.name] ?? "")}
                      onChange={(e) => setCreds((c) => ({ ...c, [f.name]: e.target.value }))}
                      placeholder={f.placeholder}
                      className="h-24 w-full rounded-lg border border-line bg-surface px-3 py-2 font-mono text-[11px] focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
                    />
                  ) : (
                    <Input
                      type={f.type === "password" ? "password" : "text"}
                      value={String(creds[f.name] ?? "")}
                      onChange={(e) => setCreds((c) => ({ ...c, [f.name]: e.target.value }))}
                      placeholder={f.placeholder}
                    />
                  )}
                </>
              )}
            </div>
          ))}
          {error && <p className="text-[11px] font-semibold text-danger">{error}</p>}
        </div>
      </Dialog>
    </Card>
  );
}