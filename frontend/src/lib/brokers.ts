export type CredFieldType = "text" | "password" | "checkbox" | "textarea";
export interface CredField {
  name: string;
  label: string;
  type: CredFieldType;
  placeholder?: string;
  required?: boolean;
}
export interface BrokerMeta {
  id: string;
  name: string;
  category: "Stocks & Options" | "Crypto" | "Futures" | "Forex & CFD" | "Multi-Asset";
  sync: boolean;          // real public "all fills" API implemented server-side
  csv: boolean;           // real exported CSV supported (universal)
  assets: string[];
  defaultTz: string;
  credentialFields: CredField[];
  steps: string[];
  note: string;
}

const KEY_SECRET: CredField[] = [
  { name: "apiKey", label: "API Key", type: "text", required: true, placeholder: "paste key" },
  { name: "secretKey", label: "Secret Key", type: "password", required: true, placeholder: "paste secret" },
];

export const BROKERS: BrokerMeta[] = [
  // ---------- LIVE SYNC (real API) ----------
  {
    id: "alpaca", name: "Alpaca", category: "Stocks & Options", sync: true, csv: true,
    assets: ["Stocks", "Options", "Crypto"], defaultTz: "US/Eastern",
    credentialFields: [...KEY_SECRET, { name: "live", label: "Use live account (else paper)", type: "checkbox" }],
    steps: [
      "Create free API keys at alpaca.markets → API Keys.",
      "Add the connection in Broker Sync, paste Key + Secret, choose paper/live.",
      "Click Sync — real fills stream straight from Alpaca's API.",
    ],
    note: "Alpaca has a real public API, so live sync works for stocks, options and crypto.",
  },
  {
    id: "kraken", name: "Kraken", category: "Crypto", sync: true, csv: true,
    assets: ["Crypto"], defaultTz: "UTC",
    credentialFields: KEY_SECRET,
    steps: [
      "Create API keys at kraken.com → Settings → API (enable 'Query Funds' / 'Query Open & Closed Orders').",
      "Add the connection in Broker Sync with Key + Secret.",
      "Click Sync — Kraken's TradesHistory returns every real fill in one call.",
    ],
    note: "Symbols appear as Kraken's native pair codes (e.g. XXBTZUSD = BTC/USD).",
  },

  // ---------- CRYPTO (CSV = real exported data) ----------
  {
    id: "coinbase", name: "Coinbase", category: "Crypto", sync: false, csv: true,
    assets: ["Crypto"], defaultTz: "UTC", credentialFields: [],
    steps: [
      "Coinbase → Statements → generate a Transaction History (CSV) for your date range.",
      "Or Advanced Trade → Reports → export fills CSV.",
      "Upload it in the File Upload tab.",
    ],
    note: "Coinbase's retail API needs an uploaded private key (JWT); we keep it honest via real CSV export.",
  },
  {
    id: "binance", name: "Binance", category: "Crypto", sync: false, csv: true,
    assets: ["Crypto"], defaultTz: "UTC", credentialFields: [],
    steps: [
      "Binance → Orders → Trade History → Export (CSV).",
      "Pick your date range and download the file.",
      "Upload it in the File Upload tab.",
    ],
    note: "Parser auto-detects Binance's Pair / Side / Amount / Price / Fee columns.",
  },
  {
    id: "bybit", name: "Bybit", category: "Crypto", sync: false, csv: true,
    assets: ["Crypto", "Futures"], defaultTz: "UTC", credentialFields: [],
    steps: ["Bybit → Orders → Order History → Export CSV.", "Upload it in the File Upload tab."],
    note: "Covers spot and derivatives fills.",
  },
  {
    id: "okx", name: "OKX", category: "Crypto", sync: false, csv: true,
    assets: ["Crypto", "Futures", "Options"], defaultTz: "UTC", credentialFields: [],
    steps: ["OKX → Orders → Trade History → Export.", "Upload the CSV in the File Upload tab."],
    note: "Spot, swaps, futures and options fills.",
  },
  {
    id: "kucoin", name: "KuCoin", category: "Crypto", sync: false, csv: true,
    assets: ["Crypto"], defaultTz: "UTC", credentialFields: [],
    steps: ["KuCoin → Orders → Trade History → Export CSV.", "Upload in File Upload."],
    note: "",
  },
  {
    id: "mexc", name: "MEXC", category: "Crypto", sync: false, csv: true,
    assets: ["Crypto"], defaultTz: "UTC", credentialFields: [],
    steps: ["MEXC → Orders → History → Export.", "Upload in File Upload."],
    note: "",
  },
  {
    id: "gate", name: "Gate.io", category: "Crypto", sync: false, csv: true,
    assets: ["Crypto"], defaultTz: "UTC", credentialFields: [],
    steps: ["Gate.io → Orders → Trade History → Export CSV.", "Upload in File Upload."],
    note: "",
  },
  {
    id: "bitget", name: "Bitget", category: "Crypto", sync: false, csv: true,
    assets: ["Crypto", "Futures"], defaultTz: "UTC", credentialFields: [],
    steps: ["Bitget → Orders → History → Export.", "Upload in File Upload."],
    note: "",
  },
  {
    id: "htx", name: "HTX", category: "Crypto", sync: false, csv: true,
    assets: ["Crypto"], defaultTz: "UTC", credentialFields: [],
    steps: ["HTX → Orders → Trade History → Export CSV.", "Upload in File Upload."],
    note: "",
  },
  {
    id: "deribit", name: "Deribit", category: "Crypto", sync: false, csv: true,
    assets: ["Crypto", "Options", "Futures"], defaultTz: "UTC", credentialFields: [],
    steps: ["Deribit → History → Trade History → Export.", "Upload in File Upload."],
    note: "Crypto options & perpetuals.",
  },
  {
    id: "crypto_com", name: "Crypto.com", category: "Crypto", sync: false, csv: true,
    assets: ["Crypto"], defaultTz: "UTC", credentialFields: [],
    steps: ["Crypto.com app → History → Export statement (CSV).", "Upload in File Upload."],
    note: "",
  },
  {
    id: "gemini", name: "Gemini", category: "Crypto", sync: false, csv: true,
    assets: ["Crypto"], defaultTz: "UTC", credentialFields: [],
    steps: ["Gemini → Activity → Export CSV.", "Upload in File Upload."],
    note: "",
  },

  // ---------- STOCKS & OPTIONS (CSV = real exported data) ----------
  {
    id: "webull", name: "Webull", category: "Stocks & Options", sync: false, csv: true,
    assets: ["Stocks", "Options", "Futures", "Crypto"], defaultTz: "US/Eastern", credentialFields: [],
    steps: [
      "In Webull, click the Account button (or the Webull logo).",
      "Open the 'History' tab, click 'Filter', set your date range, Order Status = All, Done.",
      "Click the download (arrow) icon → Export Orders → Submit; the CSV is emailed to you.",
      "Upload that CSV in the File Upload tab.",
    ],
    note: "Webull allows one download per day; commissions aren't in the CSV — add them manually if needed.",
  },
  {
    id: "moomoo", name: "Moomoo", category: "Stocks & Options", sync: false, csv: true,
    assets: ["Stocks", "Options", "Futures"], defaultTz: "US/Eastern", credentialFields: [],
    steps: ["Moomoo → Trade → Order History → Export.", "Upload the CSV in File Upload."],
    note: "",
  },
  {
    id: "robinhood", name: "Robinhood", category: "Stocks & Options", sync: false, csv: true,
    assets: ["Stocks", "Options", "Crypto"], defaultTz: "US/Eastern", credentialFields: [],
    steps: ["Robinhood → Account → Statements → download 1099/Activity CSV.", "Upload in File Upload."],
    note: "Robinhood has no public retail API; CSV is the real path.",
  },
  {
    id: "fidelity", name: "Fidelity", category: "Stocks & Options", sync: false, csv: true,
    assets: ["Stocks", "Options"], defaultTz: "US/Eastern", credentialFields: [],
    steps: ["Fidelity → Accounts → Statements & Documents → export transaction CSV.", "Upload in File Upload."],
    note: "",
  },
  {
    id: "schwab", name: "Charles Schwab", category: "Stocks & Options", sync: false, csv: true,
    assets: ["Stocks", "Options", "Futures"], defaultTz: "US/Eastern", credentialFields: [],
    steps: ["Schwab → Statements → export activity CSV.", "Upload in File Upload."],
    note: "Includes former TD Ameritrade accounts.",
  },
  {
    id: "etrade", name: "E*TRADE", category: "Stocks & Options", sync: false, csv: true,
    assets: ["Stocks", "Options"], defaultTz: "US/Eastern", credentialFields: [],
    steps: ["E*TRADE → Trade Confirmation / activity → export CSV.", "Upload in File Upload."],
    note: "",
  },
  {
    id: "thinkorswim", name: "thinkorswim", category: "Stocks & Options", sync: false, csv: true,
    assets: ["Stocks", "Options", "Futures"], defaultTz: "US/Eastern", credentialFields: [],
    steps: ["TOS → Monitor → Activity → export trades to CSV.", "Upload in File Upload."],
    note: "",
  },
  {
    id: "tastytrade", name: "Tastytrade", category: "Stocks & Options", sync: false, csv: true,
    assets: ["Stocks", "Options", "Futures"], defaultTz: "US/Eastern", credentialFields: [],
    steps: ["Tastytrade → Account → Statements & Documents → export activity CSV.", "Upload in File Upload."],
    note: "",
  },
  {
    id: "tradestation", name: "TradeStation", category: "Stocks & Options", sync: false, csv: true,
    assets: ["Stocks", "Options", "Futures"], defaultTz: "US/Eastern", credentialFields: [],
    steps: ["TradeStation → Reports → export fills CSV.", "Upload in File Upload."],
    note: "",
  },
  {
    id: "ally", name: "Ally Invest", category: "Stocks & Options", sync: false, csv: true,
    assets: ["Stocks", "Options"], defaultTz: "US/Eastern", credentialFields: [],
    steps: ["Ally → Statements → export transactions CSV.", "Upload in File Upload."],
    note: "",
  },
  {
    id: "public", name: "Public", category: "Stocks & Options", sync: false, csv: true,
    assets: ["Stocks", "Options", "Crypto"], defaultTz: "US/Eastern", credentialFields: [],
    steps: ["Public → Statements → export CSV.", "Upload in File Upload."],
    note: "",
  },
  {
    id: "sofi", name: "SoFi Active Investing", category: "Stocks & Options", sync: false, csv: true,
    assets: ["Stocks", "Options"], defaultTz: "US/Eastern", credentialFields: [],
    steps: ["SoFi → Statements → export activity CSV.", "Upload in File Upload."],
    note: "",
  },
  {
    id: "firstrade", name: "Firstrade", category: "Stocks & Options", sync: false, csv: true,
    assets: ["Stocks", "Options"], defaultTz: "US/Eastern", credentialFields: [],
    steps: ["Firstrade → Statements → export transactions CSV.", "Upload in File Upload."],
    note: "",
  },

  // ---------- FUTURES ----------
  {
    id: "tradovate", name: "Tradovate", category: "Futures", sync: false, csv: true,
    assets: ["Futures"], defaultTz: "US/Central", credentialFields: [],
    steps: ["Tradovate → Reports → export fills CSV.", "Upload in File Upload."],
    note: "",
  },
  {
    id: "ninjatrader", name: "NinjaTrader", category: "Futures", sync: false, csv: true,
    assets: ["Futures"], defaultTz: "US/Central", credentialFields: [],
    steps: ["NinjaTrader → Reports → Trade Log → export CSV.", "Upload in File Upload."],
    note: "",
  },
  {
    id: "amp", name: "AMP Futures", category: "Futures", sync: false, csv: true,
    assets: ["Futures"], defaultTz: "US/Central", credentialFields: [],
    steps: ["AMP → client portal → statements → export fills.", "Upload in File Upload."],
    note: "",
  },
  {
    id: "symbria", name: "Symbria", category: "Futures", sync: false, csv: true,
    assets: ["Futures"], defaultTz: "US/Central", credentialFields: [],
    steps: ["Symbria → reports → export fills CSV.", "Upload in File Upload."],
    note: "",
  },

  // ---------- FOREX & CFD ----------
  {
    id: "oanda", name: "OANDA", category: "Forex & CFD", sync: false, csv: true,
    assets: ["Forex", "CFD"], defaultTz: "US/Eastern", credentialFields: [],
    steps: ["OANDA → Statements → export transaction history CSV.", "Upload in File Upload."],
    note: "",
  },
  {
    id: "fxcm", name: "FXCM", category: "Forex & CFD", sync: false, csv: true,
    assets: ["Forex", "CFD"], defaultTz: "US/Eastern", credentialFields: [],
    steps: ["FXCM → Reports → export trades CSV.", "Upload in File Upload."],
    note: "",
  },
  {
    id: "ig", name: "IG", category: "Forex & CFD", sync: false, csv: true,
    assets: ["Forex", "CFD", "Stocks"], defaultTz: "US/Eastern", credentialFields: [],
    steps: ["IG → Account history → export CSV.", "Upload in File Upload."],
    note: "",
  },
  {
    id: "plus500", name: "Plus500", category: "Forex & CFD", sync: false, csv: true,
    assets: ["CFD", "Forex"], defaultTz: "US/Eastern", credentialFields: [],
    steps: ["Plus500 → Statement → export deals CSV.", "Upload in File Upload."],
    note: "",
  },
  {
    id: "cmc", name: "CMC Markets", category: "Forex & CFD", sync: false, csv: true,
    assets: ["Forex", "CFD", "Stocks"], defaultTz: "US/Eastern", credentialFields: [],
    steps: ["CMC → Account history → export CSV.", "Upload in File Upload."],
    note: "",
  },
  {
    id: "dukascopy", name: "Dukascopy", category: "Forex & CFD", sync: false, csv: true,
    assets: ["Forex"], defaultTz: "US/Eastern", credentialFields: [],
    steps: ["Dukascopy → Account statement → export trades.", "Upload in File Upload."],
    note: "",
  },
  {
    id: "mt5", name: "MetaTrader 5 (brokers)", category: "Forex & CFD", sync: false, csv: true,
    assets: ["Forex", "CFD", "Stocks", "Futures"], defaultTz: "US/Eastern", credentialFields: [],
    steps: ["MT5 → Toolbox → Account History → right-click → Save as report (CSV/HTML).", "Upload in File Upload."],
    note: "Covers any broker that runs on MT4/MT5 (e.g. IC Markets, Pepperstone, Exness).",
  },

  // ---------- MULTI-ASSET ----------
  {
    id: "ibkr", name: "Interactive Brokers", category: "Multi-Asset", sync: false, csv: true,
    assets: ["Stocks", "Options", "Futures", "Forex", "Crypto"], defaultTz: "US/Eastern", credentialFields: [],
    steps: [
      "IBKR → Performance & Reports → Flex Queries → Trade Confirmation.",
      "Set the date range, Generate, download the CSV.",
      "Upload it in the File Upload tab.",
    ],
    note: "IBKR live sync needs the gated Client Portal API / a running TWS gateway; Flex CSV is the reliable real path.",
  },
  {
    id: "saxo", name: "Saxo", category: "Multi-Asset", sync: false, csv: true,
    assets: ["Stocks", "Options", "Futures", "Forex", "CFD"], defaultTz: "US/Eastern", credentialFields: [],
    steps: ["Saxo → Statements → export transactions CSV.", "Upload in File Upload."],
    note: "",
  },
  {
    id: "etoro", name: "eToro", category: "Multi-Asset", sync: false, csv: true,
    assets: ["Stocks", "Crypto", "CFD"], defaultTz: "US/Eastern", credentialFields: [],
    steps: ["eToro → Portfolio → History → export CSV.", "Upload in File Upload."],
    note: "",
  },
  {
    id: "capital_com", name: "Capital.com", category: "Multi-Asset", sync: false, csv: true,
    assets: ["CFD", "Crypto", "Forex"], defaultTz: "US/Eastern", credentialFields: [],
    steps: ["Capital.com → History → export trades CSV.", "Upload in File Upload."],
    note: "",
  },

  // ---------- GENERIC ----------
  {
    id: "generic", name: "Generic CSV", category: "Multi-Asset", sync: false, csv: true,
    assets: ["Stocks", "Options", "Futures", "Forex", "Crypto", "CFD"], defaultTz: "US/Eastern", credentialFields: [],
    steps: ["Export any broker's trade/execution CSV.", "Our parser auto-detects Date, Symbol, Side, Qty, Price, Commission, Fee."],
    note: "Tolerant parser — works with most broker exports out of the box.",
  },
];

export const CATEGORIES = ["Stocks & Options", "Crypto", "Futures", "Forex & CFD", "Multi-Asset"] as const;
export const brokerById = (id: string) => BROKERS.find((b) => b.id === id) ?? BROKERS.at(-1)!;
export const syncBrokers = () => BROKERS.filter((b) => b.sync);
export const csvBrokers = () => BROKERS.filter((b) => b.csv);
export const TIMEZONES = ["US/Eastern", "US/Central", "US/Mountain", "US/Pacific", "UTC"];