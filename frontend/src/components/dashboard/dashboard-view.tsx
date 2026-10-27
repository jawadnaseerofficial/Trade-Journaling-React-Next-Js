"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Import, RefreshCw, X, Upload, FileSpreadsheet, Loader2,
  CheckCircle2, AlertTriangle, ArrowUpRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { KpiStrip } from "./kpi-strip";
import { RecentTrades } from "./recent-trades";
import { TradingCalendar } from "./trading-calendar";
import { ScoreRadar } from "@/components/charts/score-radar";
import { CumulativeArea } from "@/components/charts/cumulative-area";
import { DailyBars } from "@/components/charts/daily-bars";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { clientGetToken } from "@/lib/auth";
import type { DashboardData, ImportResult } from "@/types";

function OpenLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold text-ink-mute transition-colors hover:bg-canvas hover:text-primary-600"
    >
      {label}
      <ArrowUpRight size={11} />
    </Link>
  );
}

function CornerArrow() {
  return (
    <span className="pointer-events-none absolute right-1.5 top-1.5 text-primary-600 opacity-0 transition-opacity group-hover:opacity-100">
      <ArrowUpRight size={13} />
    </span>
  );
}

export function DashboardView({ data, greeting }: { data: DashboardData; greeting: string }) {
  const router = useRouter();
  const tok = () => clientGetToken() ?? undefined;
  const today = new Date().toISOString().slice(0, 10);
  const dayHref = `/trades/day/${today}`;

  const lastImport = data.lastImportAt
    ? new Date(data.lastImportAt).toLocaleString("en-US", {
        month: "short", day: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
      })
    : "never";

  // ---- import modal state ----
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  function openModal() {
    setFile(null); setResult(null); setError(null); setDrag(false);
    setOpen(true);
  }
  function closeModal() {
    if (busy) return;
    setOpen(false);
  }
  function pickFile(f: File | null | undefined) {
    setError(null);
    if (!f) return;
    const okName = /\.csv$/i.test(f.name);
    const okType = !f.type || f.type === "text/csv" || f.type.endsWith("/csv");
    if (!okName && !okType) { setError("Only .csv files are supported."); return; }
    setFile(f);
  }
  async function runImport() {
    if (!file || busy) return;
    setBusy(true); setError(null); setResult(null);
    try {
      const fd = new FormData();
      fd.append("file", file); // matches the conventional UploadFile param on /api/trades/import
      const res = await api.trades.importCsv(fd, tok());
      setResult(res);
      router.refresh(); // re-run the server-fetched dashboard so new totals appear
      try { window.dispatchEvent(new Event("tj:data-imported")); } catch {}
    } catch (e: any) {
      const msg = e?.message || "Import failed.";
      setError(e?.status === 401 ? `${msg} (your session expired — log in again.)` : msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-bold">{greeting}</h2>
        <div className="flex items-center gap-2.5">
          <span className="flex items-center gap-1.5 text-[10px] font-medium text-ink-mute">
            <RefreshCw size={11} /> Last import was made: {lastImport}
          </span>
          <Button size="sm" onClick={openModal}><Import size={12} /> Import trades</Button>
        </div>
      </div>

      {/* KPI strip — whole strip opens Analytics */}
      <Link href="/analytics" className="group relative block rounded-xl transition hover:ring-2 hover:ring-primary-200">
        <CornerArrow />
        <KpiStrip kpi={data.kpi} />
      </Link>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader title="Trader Score" hint="Composite performance score" right={<><Badge>Beta</Badge><OpenLink href="/analytics" label="Analytics" /></>} />
          <Link href="/analytics" className="group relative block rounded-lg transition hover:bg-canvas/30">
            <CornerArrow />
            <ScoreRadar axes={data.score.axes} />
          </Link>
          <p className="pb-4 text-center text-[11px] font-semibold text-ink-soft">
            Your Score: <span className="text-sm font-extrabold text-success">{data.score.value}</span>
          </p>
        </Card>

        <Card>
          <CardHeader title="Daily Net Cumulative P&L" hint="Running total of realized P&L" right={<OpenLink href="/trades" label="Trade log" />} />
          <Link href="/trades" className="group relative block rounded-lg px-2 pb-4 transition hover:bg-canvas/40">
            <CornerArrow />
            <CumulativeArea data={data.cumulative} />
          </Link>
        </Card>

        <Card>
          <CardHeader title="Net Daily P&L" hint="Realized P&L per day — click to open today" right={<OpenLink href={dayHref} label="Today" />} />
          <Link href={dayHref} className="group relative block rounded-lg px-2 pb-4 transition hover:bg-canvas/40">
            <CornerArrow />
            <DailyBars data={data.daily} />
          </Link>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* RecentTrades + TradingCalendar render their own internal click targets,
            so they are intentionally NOT wrapped here (a wrapper would steal their
            row clicks / month-nav arrows). Per-day square routing lights up the
            moment trading-calendar.tsx is wired (see note in chat). */}
        <RecentTrades recent={data.recentTrades} open={data.openPositions} />
        <div className="lg:col-span-2">
          <TradingCalendar initial={data.calendar} />
        </div>
      </div>

      {/* ---------------- IMPORT MODAL ---------------- */}
      {open && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4 backdrop-blur-sm"
          onClick={closeModal}
          role="dialog"
          aria-modal="true"
          aria-label="Import trades"
        >
          <div
            className="w-full max-w-md rounded-card border border-line bg-surface p-5 shadow-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-[13px] font-black text-ink">Import trades</p>
                <p className="text-[10px] text-ink-mute">Upload a CSV — it flows into every section dynamically.</p>
              </div>
              <button onClick={closeModal} disabled={busy} aria-label="Close" className="grid h-7 w-7 place-items-center rounded-lg text-ink-mute transition-colors hover:bg-canvas hover:text-ink disabled:opacity-40">
                <X size={15} />
              </button>
            </div>

            {result ? (
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2 rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-[12px] font-bold text-success">
                  <CheckCircle2 size={15} /> Import complete
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg border border-line bg-canvas/50 p-2">
                    <p className="text-lg font-black tabular-nums text-success">{result.importedTrades}</p>
                    <p className="text-[9px] font-bold uppercase text-ink-mute">Trades</p>
                  </div>
                  <div className="rounded-lg border border-line bg-canvas/50 p-2">
                    <p className="text-lg font-black tabular-nums text-ink">{result.importedExecutions}</p>
                    <p className="text-[9px] font-bold uppercase text-ink-mute">Executions</p>
                  </div>
                  <div className={cn("rounded-lg border p-2", result.skippedRows > 0 ? "border-warn/40 bg-warn/10" : "border-line bg-canvas/50")}>
                    <p className={cn("text-lg font-black tabular-nums", result.skippedRows > 0 ? "text-warn" : "text-ink-mute")}>{result.skippedRows}</p>
                    <p className="text-[9px] font-bold uppercase text-ink-mute">Skipped</p>
                  </div>
                </div>
                {result.skippedRows > 0 && (
                  <p className="flex items-start gap-1.5 rounded-lg border border-warn/30 bg-warn/10 px-3 py-2 text-[10px] leading-relaxed text-warn">
                    <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                    {result.skippedRows} row(s) were skipped — they didn&apos;t match the importer&apos;s expected columns/format. The rest are live across Dashboard, Trade Log, Reports, Analytics and Notebook.
                  </p>
                )}
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => { setFile(null); setResult(null); setError(null); }}>Import another</Button>
                  <Button size="sm" className="flex-1" onClick={closeModal}>Done</Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <div
                  onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
                  onDragLeave={() => setDrag(false)}
                  onDrop={(e) => { e.preventDefault(); setDrag(false); pickFile(e.dataTransfer.files?.[0]); }}
                  onClick={() => inputRef.current?.click()}
                  className={cn(
                    "flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed px-4 py-7 text-center transition-colors",
                    drag ? "border-primary-400 bg-primary-50" : "border-line bg-canvas/40 hover:border-primary-300 hover:bg-primary-50/40"
                  )}
                >
                  <Upload size={20} className="text-primary-500" />
                  <p className="text-[12px] font-bold text-ink">Drop your CSV here, or click to browse</p>
                  <p className="text-[10px] text-ink-mute">.csv only · parsed by your backend importer</p>
                  <input
                    ref={inputRef}
                    type="file"
                    accept=".csv,text/csv"
                    className="hidden"
                    onChange={(e) => pickFile(e.target.files?.[0])}
                  />
                </div>

                {file && (
                  <div className="flex items-center gap-2 rounded-lg border border-line bg-canvas/50 px-3 py-2">
                    <FileSpreadsheet size={15} className="shrink-0 text-primary-500" />
                    <span className="flex-1 truncate text-[11px] font-semibold text-ink">{file.name}</span>
                    <span className="text-[10px] tabular-nums text-ink-mute">{(file.size / 1024).toFixed(1)} KB</span>
                    <button onClick={() => setFile(null)} aria-label="Remove file" className="text-ink-mute hover:text-danger"><X size={13} /></button>
                  </div>
                )}

                {error && (
                  <p className="flex items-start gap-1.5 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-[10px] leading-relaxed text-danger">
                    <AlertTriangle size={13} className="mt-0.5 shrink-0" /> {error}
                  </p>
                )}

                <Button className="w-full" disabled={!file || busy} onClick={runImport}>
                  {busy ? (<><Loader2 size={13} className="animate-spin" /> Importing…</>) : (<><Import size={13} /> Parse &amp; import</>)}
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}