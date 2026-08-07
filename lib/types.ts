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
  /** Null when the selected period has too little dated history to trust a variance-based score
   *  (see lib/metrics.ts's MIN_DAYS_FOR_SCORE — structurally always true for "1D", since a single
   *  day has no variance to measure). Every consumer must render a null score as "—", never as 0
   *  or an omitted row — the trader is real, just unscoreable in this window. */
  smart_score: SmartScore | null;
  /** Cumulative-equity points for the row sparkline, derived from real trade history. */
  equity_curve: number[];
  /** Score-based rank as of the previous live refresh; undefined until a second snapshot exists. */
  previousScoreRank?: number;
  /** Dominant Polymarket market category by traded volume, when resolvable. */
  dominantCategory?: string;
  /** True if this row's P&L is the venue's own authoritative figure (which it always is now —
   *  see server/src/ingest/polymarket.ts) rather than something reconstructed and reconciled
   *  against it. Kept for schema/UI compatibility; no longer expected to ever be false. */
  isConfident?: boolean;
  /** Historical: true meant a reconciliation gap was specifically due to Polymarket's now-removed
   *  /activity 5,000-event ceiling. No longer set by the ingester (nothing reconstructs history
   *  from /activity anymore), kept only so old snapshot rows in the DB still deserialize cleanly. */
  historyTruncated?: boolean;
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

/** Matches Polymarket's own period leaderboard exactly (data-api.polymarket.com's
 *  timePeriod=DAY|WEEK|MONTH|ALL) — no YTD tab, since Polymarket doesn't expose one and deriving
 *  it ourselves is exactly the fabrication this type once had (see git history: periodPnl). */
export type Period = "1D" | "1W" | "1M" | "ALL";

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
  profitableOnly: boolean;
  minPnl: number;
  minVolume: number;
  minScore: number;
  minSharpe: number;
  minSortino: number;
  minWinRate: number; // 0-1
  maxDrawdownPercent: number; // 0-1, 1 = no cap
  hideThinSamples: boolean;
  hideLowConfidence: boolean;
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
  profitableOnly: true,
  minPnl: -Infinity,
  minVolume: 0,
  minScore: 0,
  minSharpe: -Infinity,
  minSortino: -Infinity,
  minWinRate: 0,
  maxDrawdownPercent: 1,
  // Default OFF: Kalshi traders are hardcoded to dataPoints=0 (that ingester has no daily
  // equity curve by design), and short periods (1D/1W) structurally have too few days for most
  // Polymarket traders to clear MIN_DATA_POINTS_FOR_RATIO_SORT either. With this on by default,
  // it silently hid most of the leaderboard rather than just flagging the ones with too little
  // history to trust a ratio from. The existing per-row thin-sample warning icon
  // (LeaderboardTable) still signals this — opt-in hiding via the filter toggle, not silent
  // exclusion by default.
  hideThinSamples: false,
  hideLowConfidence: false,
  xLinkedOnly: false,
  affiliatedOnly: false,
  multiWalletOnly: false,
  recentlyActiveOnly: false,
};
