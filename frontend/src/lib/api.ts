import type {
  Account, BrokerConnection, CalendarMonth, ChartStyle, DashboardData, ImportResult,
  ManualTradePayload, MonthJournal, ReplayData, TradeSummary,
} from "@/types";

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
    this.name = "ApiError";
  }
}
export interface AuthUser { id: string; email: string; tenantId: string; chartStyle?: ChartStyle }
export interface TokenResponse { accessToken: string; tokenType: string; user: AuthUser }

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const RETRY_ON = new Set([502, 503, 504]);
const backoff = (a: number) => new Promise((r) => setTimeout(r, 250 * 2 ** a));

async function request<T>(path: string, init?: RequestInit, token?: string): Promise<T> {
  const retries = 2, timeoutMs = 20_000;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(`${BASE}${path}`, {
        ...init, signal: ctrl.signal, cache: "no-store",
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init?.headers ?? {}) },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        const detail = body?.detail ?? res.statusText;
        console.error(`API Error ${res.status}:`, detail, body);
        const err = new ApiError(res.status, body?.code ?? "unknown", detail);
        if (RETRY_ON.has(res.status) && attempt < retries) { lastErr = err; await backoff(attempt); continue; }
        throw err;
      }
      if (res.status === 204) return undefined as T;
      return (await res.json()) as T;
    } catch (e) {
      lastErr = e;
      if (e instanceof ApiError && !RETRY_ON.has(e.status)) throw e;
      if (attempt < retries) { await backoff(attempt); continue; }
    } finally { clearTimeout(timer); }
  }
  throw lastErr instanceof Error ? lastErr : new ApiError(0, "network", "Cannot reach the API");
}

const json = (token?: string) => ({ "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) });

function rpqs(f: import("@/types").RpFilters): string {
  const p = new URLSearchParams();
  if (f.start) p.set("start", f.start);
  if (f.end) p.set("end", f.end);
  (f.accounts ?? []).forEach((x) => p.append("accounts", x));
  (f.symbols ?? []).forEach((x) => p.append("symbols", x));
  (f.playbooks ?? []).forEach((x) => p.append("playbooks", x));
  (f.sides ?? []).forEach((x) => p.append("sides", x));
  (f.statuses ?? []).forEach((x) => p.append("statuses", x));
  if (f.pnlBasis) p.set("pnl_basis", f.pnlBasis);
  return p.toString();
}

export const api = {
  auth: {
    me: (token?: string) => request<AuthUser>("/api/auth/me", undefined, token),
    login: (email: string, password: string) =>
      request<TokenResponse>("/api/auth/login", { method: "POST", headers: json(), body: JSON.stringify({ email, password }) }),
    register: (email: string, password: string) =>
      request<TokenResponse>("/api/auth/register", { method: "POST", headers: json(), body: JSON.stringify({ email, password }) }),
  },
  users: {
    getMe: (token?: string) => request<AuthUser>("/api/users/me", undefined, token),
    setChartStyle: (chartStyle: ChartStyle, token?: string) =>
      request<{ ok: boolean; chartStyle: ChartStyle }>("/api/users/me", { method: "PATCH", headers: json(token), body: JSON.stringify({ chart_style: chartStyle }) }),
  },
  dashboard: {
    summary: (token?: string) => request<DashboardData>("/api/dashboard/summary", undefined, token),
    calendar: (month: string, token?: string) => request<CalendarMonth>(`/api/dashboard/calendar?month=${month}`, undefined, token),
  },
  accounts: { list: (token?: string) => request<Account[]>("/api/accounts", undefined, token) },
  journal: {
    month: (month: string, token?: string) => request<MonthJournal>(`/api/journal/month?month=${month}`, undefined, token),
    saveDayNote: (day: string, note: string | null, token?: string) =>
      request<{ ok: boolean }>("/api/journal/day", { method: "PUT", headers: json(token), body: JSON.stringify({ day, note }) }),
  },
  trades: {
    manual: (payload: ManualTradePayload, token?: string) =>
      request<{ id: string; symbol: string; status: string; netPnl: number; executions: number }>("/api/trades/manual",
        { method: "POST", headers: json(token), body: JSON.stringify(payload) }),
    importCsv: (form: FormData, token?: string) =>
      request<ImportResult>("/api/trades/import", { method: "POST", body: form, headers: token ? { Authorization: `Bearer ${token}` } : {} }),
    forReplay: (day: string | undefined, token?: string) =>
      request<{ tradeId: string | null }>(`/api/trades/for-replay${day ? `?day=${day}` : ""}`, undefined, token),
    byDay: (day: string, token?: string) =>
      request<TradeSummary[]>(`/api/trades/by-day?day=${day}`, undefined, token),
    replay: (id: string, interval: string, token?: string) =>
      request<ReplayData>(`/api/trades/${id}/replay?interval=${interval}`, undefined, token),
    patch: (id: string, body: Record<string, unknown>, token?: string) =>
      request<{ ok: boolean }>(`/api/trades/${id}`, { method: "PATCH", headers: json(token), body: JSON.stringify(body) }),
    addExecution: (id: string, body: Record<string, unknown>, token?: string) =>
      request<{ ok: boolean }>(`/api/trades/${id}/executions`, { method: "POST", headers: json(token), body: JSON.stringify(body) }),
    deleteExecution: (execId: string, token?: string) =>
      request<void>(`/api/trades/executions/${execId}`, { method: "DELETE" }, token),
    setPlaybook: (id: string, body: { playbookId: string | null; rules: { ruleId: string; followed: boolean }[] }, token?: string) =>
      request<{ ok: boolean }>(`/api/trades/${id}/playbook`, { method: "PUT", headers: json(token), body: JSON.stringify({ playbook_id: body.playbookId, rules: body.rules.map((r) => ({ ruleId: r.ruleId, followed: r.followed })) }) }),
    log: (q: Record<string, string | number | undefined>, token?: string) => {
      const p = new URLSearchParams();
      for (const [k, v] of Object.entries(q)) if (v !== undefined && v !== "") p.set(k, String(v));
      return request<import("@/types").LogPage>(`/api/trades/log?${p.toString()}`, undefined, token);
    },
    preview: (id: string, token?: string) =>
      request<import("@/types").TradePreview>(`/api/trades/preview/${id}`, undefined, token),
    previewBatch: (ids: string[], token?: string) =>
      request<Record<string, { mae: number | null; mfe: number | null; bestExitPct: number | null }>>(
        "/api/trades/preview-batch", { method: "POST", headers: json(token), body: JSON.stringify({ ids }) }),
    linkPlaybook: (id: string, playbookId: string | null, token?: string) =>
      request<{ ok: boolean }>(`/api/trades/${id}/playbook-link`, { method: "PUT", headers: json(token), body: JSON.stringify({ playbook_id: playbookId }) }),
  },
  playbooks: {
    list: (scope: string, token?: string) => request<import("@/types").PlaybookListItem[]>(`/api/playbooks?scope=${scope}`, undefined, token),
    withRules: (token?: string) => request<import("@/types").WithRulesPlaybook[]>("/api/playbooks/with-rules", undefined, token),
    create: (body: Record<string, unknown>, token?: string) =>
      request<{ id: string }>("/api/playbooks", { method: "POST", headers: json(token), body: JSON.stringify(body) }),
    get: (id: string, token?: string) => request<import("@/types").PlaybookDetail>(`/api/playbooks/${id}`, undefined, token),
    rename: (id: string, body: Record<string, unknown>, token?: string) =>
      request<{ ok: boolean }>(`/api/playbooks/${id}`, { method: "PATCH", headers: json(token), body: JSON.stringify(body) }),
    setVisibility: (id: string, visibility: string, token?: string) =>
      request<{ ok: boolean }>(`/api/playbooks/${id}/visibility`, { method: "PATCH", headers: json(token), body: JSON.stringify({ visibility }) }),
    remove: (id: string, token?: string) => request<void>(`/api/playbooks/${id}`, { method: "DELETE" }, token),
    overview: (id: string, token?: string) => request<import("@/types").PlaybookOverview>(`/api/playbooks/${id}/overview`, undefined, token),
    trades: (id: string, token?: string) => request<import("@/types").ExecutedRow[]>(`/api/playbooks/${id}/trades`, undefined, token),
    missed: (id: string, token?: string) => request<import("@/types").MissedRow[]>(`/api/playbooks/${id}/missed`, undefined, token),
    addMissed: (id: string, body: Record<string, unknown>, token?: string) =>
      request<{ ok: boolean }>(`/api/playbooks/${id}/missed`, { method: "POST", headers: json(token), body: JSON.stringify(body) }),
    removeMissed: (mid: string, token?: string) => request<void>(`/api/playbooks/missed/${mid}`, { method: "DELETE" }, token),
    notes: (id: string, token?: string) => request<import("@/types").PlaybookNote[]>(`/api/playbooks/${id}/notes`, undefined, token),
    addNote: (id: string, title: string, token?: string) =>
      request<{ id: string }>(`/api/playbooks/${id}/notes`, { method: "POST", headers: json(token), body: JSON.stringify({ title }) }),
    updateNote: (nid: string, body: Record<string, unknown>, token?: string) =>
      request<{ ok: boolean }>(`/api/playbooks/notes/${nid}`, { method: "PATCH", headers: json(token), body: JSON.stringify(body) }),
    removeNote: (nid: string, token?: string) => request<void>(`/api/playbooks/notes/${nid}`, { method: "DELETE" }, token),
    addGroup: (id: string, name: string, token?: string) =>
      request<{ id: string }>(`/api/playbooks/${id}/groups`, { method: "POST", headers: json(token), body: JSON.stringify({ name }) }),
    renameGroup: (gid: string, name: string, token?: string) =>
      request<{ ok: boolean }>(`/api/playbooks/groups/${gid}`, { method: "PATCH", headers: json(token), body: JSON.stringify({ name }) }),
    removeGroup: (gid: string, token?: string) => request<void>(`/api/playbooks/groups/${gid}`, { method: "DELETE" }, token),
    addRule: (gid: string, body: { name: string; visibility?: string }, token?: string) =>
      request<{ id: string }>(`/api/playbooks/groups/${gid}/rules`, { method: "POST", headers: json(token), body: JSON.stringify({ name: body.name, visibility: body.visibility ?? "always" }) }),
    updateRule: (rid: string, name: string, token?: string) =>
      request<{ ok: boolean }>(`/api/playbooks/rules/${rid}`, { method: "PATCH", headers: json(token), body: JSON.stringify({ name }) }),
    removeRule: (rid: string, token?: string) => request<void>(`/api/playbooks/rules/${rid}`, { method: "DELETE" }, token),
    share: (id: string, email: string, token?: string) =>
      request<{ ok: boolean }>(`/api/playbooks/${id}/share`, { method: "POST", headers: json(token), body: JSON.stringify({ email }) }),
  },
  backtests: {
    list: (scope: string, token?: string) => request<import("@/types").BtSessionListItem[]>(`/api/backtests?scope=${scope}`, undefined, token),
    create: (body: Record<string, unknown>, token?: string) =>
      request<{ id: string }>("/api/backtests", { method: "POST", headers: json(token), body: JSON.stringify(body) }),
    run: (id: string, token?: string) => request<import("@/types").BtRun>(`/api/backtests/${id}/run`, undefined, token),
    addAction: (id: string, body: Record<string, unknown>, token?: string) =>
      request<{ ok: boolean }>(`/api/backtests/${id}/actions`, { method: "POST", headers: json(token), body: JSON.stringify(body) }),
    progress: (id: string, lastTime: number | null, token?: string) =>
      request<{ ok: boolean }>(`/api/backtests/${id}/progress`, { method: "PATCH", headers: json(token), body: JSON.stringify({ last_time: lastTime }) }),
    rename: (id: string, body: Record<string, unknown>, token?: string) =>
      request<{ ok: boolean }>(`/api/backtests/${id}`, { method: "PATCH", headers: json(token), body: JSON.stringify(body) }),
    setVisibility: (id: string, visibility: string, token?: string) =>
      request<{ ok: boolean }>(`/api/backtests/${id}/visibility`, { method: "PATCH", headers: json(token), body: JSON.stringify({ visibility }) }),
    shares: (id: string, token?: string) => request<import("@/types").BtShare[]>(`/api/backtests/${id}/shares`, undefined, token),
    share: (id: string, email: string, token?: string) =>
      request<{ ok: boolean; userId: string }>(`/api/backtests/${id}/share`, { method: "POST", headers: json(token), body: JSON.stringify({ email }) }),
    unshare: (id: string, uid: string, token?: string) => request<void>(`/api/backtests/${id}/shares/${uid}`, { method: "DELETE" }, token),
    remove: (id: string, token?: string) => request<void>(`/api/backtests/${id}`, { method: "DELETE" }, token),
  },
  market: {
    candles: (symbol: string, day: string, interval: string, token?: string) =>
      request<import("@/types").Candle[]>(`/api/market/candles?symbol=${symbol}&day=${day}&interval=${interval}`, undefined, token),
  },
  brokers: {
    list: (token?: string) => request<BrokerConnection[]>("/api/brokers", undefined, token),
    create: (broker: string, label: string, credentials: Record<string, unknown>, token?: string) =>
      request<BrokerConnection>("/api/brokers", { method: "POST", headers: json(token), body: JSON.stringify({ broker, label, credentials }) }),
    remove: (id: string, token?: string) => request<void>(`/api/brokers/${id}`, { method: "DELETE" }, token),
    sync: (id: string, token?: string) =>
      request<{ importedTrades: number; importedExecutions: number }>(`/api/brokers/${id}/sync`, { method: "POST" }, token),
  },
  settings: {
    profile: (token?: string) => request<import("@/types").Profile>("/api/settings/profile", undefined, token),
    patchProfile: (body: Record<string, unknown>, token?: string) =>
      request<import("@/types").Profile>("/api/settings/profile", { method: "PATCH", headers: json(token), body: JSON.stringify(body) }),
    changeEmail: (email: string, token?: string) =>
      request<import("@/types").Profile>("/api/settings/email", { method: "PATCH", headers: json(token), body: JSON.stringify({ email }) }),
    patchTenant: (name: string, token?: string) =>
      request<{ name: string }>("/api/settings/tenant", { method: "PATCH", headers: json(token), body: JSON.stringify({ name }) }),
    changePassword: (body: Record<string, unknown>, token?: string) =>
      request<{ ok: boolean }>("/api/settings/change-password", { method: "POST", headers: json(token), body: JSON.stringify(body) }),
    logoutEverywhere: (token?: string) =>
      request<{ ok: boolean; token_version: number }>("/api/settings/logout-everywhere", { method: "POST", headers: json(token) }),
    deleteAccount: (token?: string) =>
      request<{ mode: string }>("/api/settings/account", { method: "DELETE" }, token),
  },
  notebook: {
    tree: (token?: string) => request<import("@/types").NbTree>("/api/notebook/tree", undefined, token),
    notes: (folder: string, q?: string, tag?: string, token?: string) =>
      request<import("@/types").NbListItem[]>(`/api/notebook/notes?folder=${encodeURIComponent(folder)}${q ? `&q=${encodeURIComponent(q)}` : ""}${tag ? `&tag=${encodeURIComponent(tag)}` : ""}`, undefined, token),
    note: (id: string, token?: string) => request<import("@/types").NbDetail>(`/api/notebook/notes/${id}`, undefined, token),
    create: (body: Record<string, unknown>, token?: string) =>
      request<{ id: string }>("/api/notebook/notes", { method: "POST", headers: json(token), body: JSON.stringify(body) }),
    patch: (id: string, body: Record<string, unknown>, token?: string) =>
      request<{ ok: boolean; updatedAt: string }>(`/api/notebook/notes/${id}`, { method: "PATCH", headers: json(token), body: JSON.stringify(body) }),
    setTags: (id: string, tags: string[], token?: string) =>
      request<{ tags: string[] }>(`/api/notebook/notes/${id}/tags`, { method: "PUT", headers: json(token), body: JSON.stringify({ tags }) }),
    del: (id: string, token?: string) => request<void>(`/api/notebook/notes/${id}`, { method: "DELETE" }, token),
    restore: (id: string, token?: string) => request<{ ok: boolean }>(`/api/notebook/notes/${id}/restore`, { method: "POST", headers: json(token) }),
    purge: (id: string, token?: string) => request<void>(`/api/notebook/notes/${id}/permanent`, { method: "DELETE" }, token),
    share: (id: string, token?: string) => request<{ shareToken: string | null; url: string | null }>(`/api/notebook/notes/${id}/share`, { method: "POST", headers: json(token) }),
    exportUrl: (id: string) => `/api/notebook/notes/${id}/export`,
    folderCreate: (body: Record<string, unknown>, token?: string) =>
      request<{ id: string }>("/api/notebook/folders", { method: "POST", headers: json(token), body: JSON.stringify(body) }),
    folderPatch: (id: string, body: Record<string, unknown>, token?: string) =>
      request<{ ok: boolean }>(`/api/notebook/folders/${id}`, { method: "PATCH", headers: json(token), body: JSON.stringify(body) }),
    folderDelete: (id: string, token?: string) => request<void>(`/api/notebook/folders/${id}`, { method: "DELETE" }, token),
    templates: (token?: string) => request<import("@/types").NbTemplate[]>("/api/notebook/templates", undefined, token),
    templateCreate: (body: Record<string, unknown>, token?: string) =>
      request<{ id: string }>("/api/notebook/templates", { method: "POST", headers: json(token), body: JSON.stringify(body) }),
    templatePatch: (id: string, body: Record<string, unknown>, token?: string) =>
      request<{ ok: boolean }>(`/api/notebook/templates/${id}`, { method: "PATCH", headers: json(token), body: JSON.stringify(body) }),
    templateDelete: (id: string, token?: string) => request<void>(`/api/notebook/templates/${id}`, { method: "DELETE" }, token),
  },
  reports: {
    caps: (token?: string) => request<import("@/types").RpCaps>("/api/reports/capabilities", undefined, token),
    dimension: (dim: string, f: import("@/types").RpFilters, token?: string) =>
      request<import("@/types").RpDimension>(`/api/reports/dimension/${dim}?${rpqs(f)}`, undefined, token),
    cross: (a: string, b: string, m: string, f: import("@/types").RpFilters, token?: string) =>
      request<import("@/types").RpCross>(`/api/reports/cross?dimA=${a}&dimB=${b}&metric=${m}&${rpqs(f)}`, undefined, token),
    performance: (metrics: string[], gran: string, f: import("@/types").RpFilters, token?: string) =>
      request<import("@/types").RpPerformance>(`/api/reports/performance?metrics=${metrics.join(",")}&gran=${gran}&${rpqs(f)}`, undefined, token),
    overview: (f: import("@/types").RpFilters, token?: string) =>
      request<import("@/types").RpOverview>(`/api/reports/overview?${rpqs(f)}`, undefined, token),
    compare: (a: import("@/types").RpFilters, b: import("@/types").RpFilters, token?: string) =>
      request<import("@/types").RpCompare>("/api/reports/compare", { method: "POST", headers: json(token), body: JSON.stringify({ a, b }) }),
    calendar: (month: string, f: import("@/types").RpFilters, token?: string) =>
      request<import("@/types").RpCalendar>(`/api/reports/calendar?month=${month}&${rpqs(f)}`, undefined, token),
    winsLosses: (f: import("@/types").RpFilters, token?: string) =>
      request<{ available: boolean; rows: any[]; bySymbol: import("@/types").RpBucket[] }>(`/api/reports/wins-losses?${rpqs(f)}`, undefined, token),
  },

  analytics: {
    summary: (f: import("@/types").RpFilters, token?: string) =>
      request<import("@/types").AnalyticsOut>(`/api/analytics/summary?${rpqs(f)}`, undefined, token),
  },
};