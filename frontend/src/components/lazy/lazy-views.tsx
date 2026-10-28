"use client";

import dynamic from "next/dynamic";
import type { ComponentType, ReactNode } from "react";

import {
  ChartSkeleton,
  FormSkeleton,
  NotebookSkeleton,
  PageSkeleton,
  TableSkeleton,
} from "@/components/ui/skeletons";

/* If a module's named export is missing, fall back to default,
   and if that is missing too, fall back to a skeleton stub so we
   NEVER crash the route. A stuck skeleton = wrong export name = tell me. */
function stub(node: ReactNode): ComponentType<any> {
  return function Stub() {
    return <>{node}</>;
  };
}

const DashboardView = dynamic(
  () => import("@/components/dashboard/dashboard-view").then((m: any) => m.DashboardView ?? m.default ?? stub(<PageSkeleton />)),
  { ssr: false, loading: () => <PageSkeleton /> },
) as ComponentType<any>;

const AnalyticsView = dynamic(
  () => import("@/components/analytics/analytics-view").then((m: any) => m.AnalyticsView ?? m.default ?? stub(<PageSkeleton />)),
  { ssr: false, loading: () => <PageSkeleton /> },
) as ComponentType<any>;

const TradeLogView = dynamic(
  () => import("@/components/trade-log/trade-log-view").then((m: any) => m.TradeLogView ?? m.default ?? stub(<TableSkeleton rows={12} />)),
  { ssr: false, loading: () => <TableSkeleton rows={12} /> },
) as ComponentType<any>;

const ReportsView = dynamic(
  () => import("@/components/reports/reports-view").then((m: any) => m.ReportsView ?? m.default ?? stub(<ChartSkeleton height={360} />)),
  { ssr: false, loading: () => <ChartSkeleton height={360} /> },
) as ComponentType<any>;

const NotebookView = dynamic(
  () => import("@/components/notebook/notebook-view").then((m: any) => m.NotebookView ?? m.default ?? stub(<NotebookSkeleton />)),
  { ssr: false, loading: () => <NotebookSkeleton /> },
) as ComponentType<any>;

const JournalView = dynamic(
  () => import("@/components/journal/journal-view").then((m: any) => m.JournalView ?? m.default ?? stub(<PageSkeleton />)),
  { ssr: false, loading: () => <PageSkeleton /> },
) as ComponentType<any>;

const PlaybookView = dynamic(
  () => import("@/components/playbook/playbook-index").then((m: any) => m.PlaybookIndex ?? m.PlaybookView ?? m.default ?? stub(<PageSkeleton />)),
  { ssr: false, loading: () => <PageSkeleton /> },
) as ComponentType<any>;

const ReplayView = dynamic(
  () => import("@/components/replay/replay-view").then((m: any) => m.ReplayView ?? m.default ?? stub(<ChartSkeleton height={320} />)),
  { ssr: false, loading: () => <ChartSkeleton height={320} /> },
) as ComponentType<any>;

const ReplayLiveView = dynamic(
  () => import("@/components/replay/replay-live-view").then((m: any) => m.ReplayLiveView ?? m.default ?? stub(<ChartSkeleton height={320} />)),
  { ssr: false, loading: () => <ChartSkeleton height={320} /> },
) as ComponentType<any>;

const BacktestingView = dynamic(
  () => import("@/components/backtest/sessions-view").then((m: any) => m.SessionsView ?? m.BacktestingView ?? m.default ?? stub(<PageSkeleton />)),
  { ssr: false, loading: () => <PageSkeleton /> },
) as ComponentType<any>;

const SettingsView = dynamic(
  () => import("@/components/settings/settings-view").then((m: any) => m.SettingsView ?? m.default ?? stub(<FormSkeleton />)),
  { ssr: false, loading: () => <FormSkeleton /> },
) as ComponentType<any>;

const Views = {
  dashboard: DashboardView,
  analytics: AnalyticsView,
  trades: TradeLogView,
  reports: ReportsView,
  notebook: NotebookView,
  journal: JournalView,
  playbook: PlaybookView,
  replay: ReplayView,
  replayLive: ReplayLiveView,
  backtesting: BacktestingView,
  settings: SettingsView,
} as const;

export type LazyViewName = keyof typeof Views;

export function LazyView({ name, ...props }: { name: LazyViewName } & Record<string, any>) {
  const Comp = Views[name];
  return <Comp {...props} />;
}