export const METRIC_GROUPS: { group: string; items: { id: string; label: string; unit: string }[] }[] = [
  { group: "Time Analysis", items: [
    { id: "avg_hold", label: "Avg hold time - cumulative", unit: "s" },
    { id: "trades", label: "Trade count", unit: "#" },
  ]},
  { group: "Profitability", items: [
    { id: "net_cum", label: "Net P&L - cumulative", unit: "$" },
    { id: "net_daily", label: "Net P&L - daily", unit: "$" },
    { id: "gross_cum", label: "Gross P&L - cumulative", unit: "$" },
    { id: "avg_win", label: "Avg win", unit: "$" },
    { id: "avg_loss", label: "Avg loss", unit: "$" },
    { id: "expectancy", label: "Trade expectancy", unit: "$" },
    { id: "profit_factor", label: "Profit factor", unit: "x" },
  ]},
  { group: "Risk & Drawdown", items: [
    { id: "max_dd", label: "Drawdown", unit: "$" },
  ]},
  { group: "Trading Activity & Volume", items: [
    { id: "volume", label: "Volume", unit: "#" },
    { id: "win_rate", label: "Win %", unit: "%" },
  ]},
  { group: "Streaks & Consistency", items: [
    { id: "win_streak", label: "Max win streak", unit: "#" },
    { id: "loss_streak", label: "Max loss streak", unit: "#" },
  ]},
];
export const ALL_METRICS = METRIC_GROUPS.flatMap((g) => g.items);

export const DIMENSIONS: { id: string; label: string; cap?: string }[] = [
  { id: "dow", label: "Day and time" }, { id: "month", label: "Month" }, { id: "hour", label: "Hour" },
  { id: "duration", label: "Trade duration" }, { id: "symbol", label: "Symbols" },
  { id: "playbook", label: "Playbook", cap: "playbook" }, { id: "risk", label: "Risk & size" },
  { id: "account", label: "Account", cap: "account" }, { id: "confidence", label: "Confidence", cap: "confidence" },
  { id: "entry_tf", label: "Entry time by", cap: "entry_tf" }, { id: "exit_tf", label: "Exit time by", cap: "exit_tf" },
  { id: "tag", label: "Tag", cap: "trade_tags" }, { id: "expiry", label: "Days till expiration", cap: "expiry" },
];

export const REPORT_MENU = [
  { id: "dow", label: "Day & Time" }, { id: "symbol", label: "Symbols" }, { id: "risk", label: "Risk" },
  { id: "playbook", label: "Playbooks" }, { id: "tag", label: "Tags" }, { id: "expiry", label: "Options: Days till expiration" },
  { id: "winslosses", label: "Wins vs Losses" },
];