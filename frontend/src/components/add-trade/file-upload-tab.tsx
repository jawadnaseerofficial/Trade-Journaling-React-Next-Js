"use client";
import { useRef, useState, type DragEvent } from "react";
import { useRouter } from "next/navigation";
import { FileText } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { clientGetToken } from "@/lib/auth";
import { CATEGORIES, TIMEZONES, brokerById, csvBrokers } from "@/lib/brokers";
import type { Account, ImportResult } from "@/types";

export function FileUploadTab({ accounts }: { accounts: Account[] }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [broker, setBroker] = useState("webull");
  const [tz, setTz] = useState(brokerById("webull").defaultTz);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const meta = brokerById(broker);

  function changeBroker(id: string) {
    setBroker(id);
    setTz(brokerById(id).defaultTz); // crypto -> UTC, stocks -> US/Eastern, etc.
  }

  async function doUpload(f: File) {
    if (!accountId) { setError("Select an account first"); return; }
    setBusy(true); setError(null); setResult(null);
    const form = new FormData();
    form.append("file", f);
    form.append("account_id", accountId);
    form.append("broker", broker);
    form.append("timezone", tz);
    try {
      const res = await api.trades.importCsv(form, clientGetToken() ?? undefined);
      setResult(res);
      setTimeout(() => { router.push("/"); router.refresh(); }, 1200);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed");
    } finally { setBusy(false); }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault(); setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) { setFile(f); doUpload(f); }
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Card className="p-6">
        <h2 className="text-base font-bold">Upload your CSV</h2>
        <p className="mt-1 text-[11px] text-ink-soft">Select the account you'd like to import your CSV to. Works with every broker's real exported file.</p>

        <label className="mt-5 block text-[11px] font-semibold">Account <span className="text-danger">required</span></label>
        <Select className="mt-1.5" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
          {accounts.length === 0 && <option value="">No accounts</option>}
          {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </Select>

        <label className="mt-4 block text-[11px] font-semibold">Broker</label>
        <Select className="mt-1.5" value={broker} onChange={(e) => changeBroker(e.target.value)}>
          {CATEGORIES.map((cat) => {
            const items = csvBrokers().filter((b) => b.category === cat);
            if (!items.length) return null;
            return (
              <optgroup key={cat} label={cat}>
                {items.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </optgroup>
            );
          })}
        </Select>

        <label className="mt-4 block text-[11px] font-semibold">Timezone</label>
        <p className="text-[10px] text-ink-mute">Match the timezone of the exported file (auto-set per broker; crypto defaults to UTC).</p>
        <Select className="mt-1.5" value={tz} onChange={(e) => setTz(e.target.value)}>
          {TIMEZONES.map((t) => <option key={t} value={t}>{t}</option>)}
        </Select>

        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={`mt-5 grid place-items-center rounded-card border-2 border-dashed px-4 py-10 text-center transition-colors ${dragging ? "border-primary-500 bg-primary-50" : "border-line bg-canvas/40"}`}
        >
          <FileText size={22} className="text-ink-mute" />
          <p className="mt-2 text-[11px] text-ink-soft">Drag and drop a file, or upload from your computer</p>
          <button type="button" className="mt-1 text-[11px] font-bold text-primary-600 underline" onClick={() => inputRef.current?.click()}>
            + Upload file
          </button>
          <input ref={inputRef} type="file" accept=".csv,text/csv" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) { setFile(f); doUpload(f); } }} />
        </div>

        {file && !busy && !result && <p className="mt-2 text-[11px] text-ink-soft">Selected: {file.name}</p>}
        {busy && <p className="mt-2 text-[11px] font-semibold text-primary-600">Parsing & importing…</p>}
        {result && (
          <p className="mt-2 text-[11px] font-semibold text-success-deep">
            Imported {result.importedTrades} trade(s) / {result.importedExecutions} execution(s){result.skippedRows ? ` · ${result.skippedRows} row(s) skipped` : ""}. Redirecting…
          </p>
        )}
        {error && <p className="mt-2 text-[11px] font-semibold text-danger">{error}</p>}
      </Card>

      <Card className="bg-primary-50/40 p-6">
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-full bg-sidebar text-[10px] font-black text-white">{meta.name[0]}</span>
          <h3 className="text-sm font-extrabold">{meta.name}</h3>
          <Badge tone="primary">{meta.category}</Badge>
        </div>
        <p className="mt-3 text-[11px] font-bold">Supported Asset Types:</p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {meta.assets.map((a) => <Badge key={a} tone="primary">{a}</Badge>)}
        </div>
        <p className="mt-4 text-[11px] font-bold">How to Import Trades from {meta.name}</p>
        <ol className="mt-2 space-y-1.5">
          {meta.steps.map((s, i) => (
            <li key={i} className="flex gap-2 text-[11px] text-ink-soft">
              <span className="font-bold text-primary-600">{i + 1}.</span><span>{s}</span>
            </li>
          ))}
        </ol>
        {meta.note && (
          <div className="mt-4 rounded-card border border-line bg-surface p-3">
            <p className="text-[11px] font-bold">Note</p>
            <p className="mt-1 text-[10px] text-ink-soft">{meta.note}</p>
          </div>
        )}
      </Card>
    </div>
  );
}