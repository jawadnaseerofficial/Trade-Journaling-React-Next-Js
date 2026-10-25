"use client";
import { useState } from "react";
import { Tabs } from "@/components/ui/tabs";
import { FileUploadTab } from "./file-upload-tab";
import { BrokerSyncTab } from "./broker-sync-tab";
import { ManualTab } from "./manual-tab";
import type { Account } from "@/types";

const TABS = [
  { id: "file", label: "File Upload" },
  { id: "broker", label: "Broker Sync" },
  { id: "manual", label: "Manual" },
];

export function AddTradeView({ accounts }: { accounts: Account[] }) {
  const [tab, setTab] = useState("file");
  const tz = accounts[0]?.timezone ?? "US/Eastern";
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-card border border-line bg-surface px-2 pt-1 shadow-card">
        <Tabs items={TABS} active={tab} onChange={setTab} />
      </div>
      {tab === "file" && <FileUploadTab accounts={accounts} />}
      {tab === "broker" && <BrokerSyncTab />}
      {tab === "manual" && <ManualTab accounts={accounts} timezone={tz} />}
    </div>
  );
}