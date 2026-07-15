import type { SmartScore } from "./metrics";

export type Venue = "polymarket" | "kalshi" | "myriad" | "opinion" | "both";

export type Trader = {
  rank: number; // recomputed at serve time based on active sort, this is the raw/original P&L rank
  name: string;
  wallet: string | null;
  additional_wallets: string[];
  wallet_count: number;
  twitter: string;
  pfp: string;
  platform: Venue;
  polymarket_profile: string;
  kalshi_profile: string;
  kalshi_username: string;
  myriad_profile: string;
  opinion_wallet: string | null;
  opinion_profile: string;
  join_date: string;
  views: number;
  largest_win: string;
  affiliated: boolean;
  stats: {
    pnl: number;
    buys: number;
    sells: number;
  };
  /** Real deposited capital, when the upstream can resolve it (e.g. via on-chain wallet transfers).
   *  0 when unavailable (e.g. Kalshi traders with no linked wallet) — used as the capital-efficiency
   *  denominator; traders with 0 are excluded from that sort rather than shown a fake ratio. */
  deposits: number;
  smart_score: SmartScore;
  /** Cumulative-equity points for the row sparkline, derived from real trade history. */
  equity_curve: number[];
  /** Score-based rank as of the previous live refresh; undefined until a second snapshot exists. */
  previousScoreRank?: number;
  /** Dominant Polymarket market category by traded volume, when resolvable. */
  dominantCategory?: string;
};

/** Stable unique identity for a trader row. Display names alone aren't guaranteed unique
 *  (the live upstream has produced duplicate display names) — `rank` is assigned uniquely
 *  per fetch, so name+rank is collision-proof without depending on wallet (which can be
 *  null for Kalshi accounts). Used for React keys and the compare/expand selection sets. */
export function traderKey(t: Trader): string {
  return `${t.name}__${t.rank}`;
}

export type SortKey =
  | "score"
  | "returnOnCapital"
  | "sharpe"
  | "sortino"
  | "calmar"
  | "rSquared"
  | "profitFactor"
  | "winRate"
  | "pnl";

export type Period = "1D" | "1W" | "1M" | "YTD" | "ALL";

export type Tier = "Elite" | "Great" | "Good" | "Average" | "Risky";

export type Position = {
  trader: string;
  wallet: string;
  venue: Venue;
  conditionId: string;
  marketTitle: string;
  side: "YES" | "NO";
  size: number;
  avgPrice: number;
  curPrice: number;
  currentValue: number;
  unrealizedPnl: number;
  traderTier?: Tier;
  traderScore?: number;
};

export type FilterState = {
  search: string;
  sortKey: SortKey;
  sortDir: "asc" | "desc";
  period: Period;
  venue: Venue | "all";
  category: string | "all";
  tiers: Tier[]; // empty = all tiers
  minPnl: number;
  minScore: number;
  minWinRate: number; // 0-1
  maxDrawdownPercent: number; // 0-1, 1 = no cap
  hideThinSamples: boolean;
  xLinkedOnly: boolean;
  affiliatedOnly: boolean;
  multiWalletOnly: boolean;
  recentlyActiveOnly: boolean;
};

export const DEFAULT_FILTERS: FilterState = {
  search: "",
  sortKey: "score",
  sortDir: "desc",
  period: "ALL",
  venue: "all",
  category: "all",
  tiers: [],
  minPnl: -Infinity,
  minScore: 0,
  minWinRate: 0,
  maxDrawdownPercent: 1,
  hideThinSamples: true,
  xLinkedOnly: false,
  affiliatedOnly: false,
  multiWalletOnly: false,
  recentlyActiveOnly: false,
};
