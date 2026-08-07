import type { Trader, SortKey } from "./types";

export const MIN_DATA_POINTS_FOR_RATIO_SORT = 30;

export type SortOption = {
  key: SortKey;
  label: string;
  shortLabel: string;
  description: string;
  accessor: (t: Trader) => number;
  isRatio: boolean; // subject to the sample-size guard rail
  format: (t: Trader) => string;
};

export const SORT_OPTIONS: SortOption[] = [
  {
    key: "score",
    label: "Most Efficient (Score)",
    shortLabel: "Score",
    description: "Weighted composite: consistency, risk-adjusted returns, win rate, drawdown, profit factor.",
    accessor: (t) => t.smart_score?.score ?? -Infinity,
    isRatio: true,
    format: (t) => (t.smart_score ? t.smart_score.score.toFixed(1) : "—"),
  },
  {
    key: "returnOnCapital",
    label: "Efficiency (P&L ÷ Volume)",
    shortLabel: "Efficiency",
    description: "Formula: P&L ÷ total dollar volume traded — profit per dollar put at risk. A simple, transparent alternative to the composite Score.",
    accessor: (t) => (hasUsableVolume(t) ? t.stats.pnl / (t.stats.buys + t.stats.sells) : 0),
    isRatio: true,
    format: (t) => `${(hasUsableVolume(t) ? (t.stats.pnl / (t.stats.buys + t.stats.sells)) * 100 : 0).toFixed(0)}%`,
  },
  {
    key: "sortino",
    label: "Sortino Ratio",
    shortLabel: "Sortino",
    description: "Return per unit of downside risk only — ignores harmless upside volatility.",
    accessor: (t) => t.smart_score?.sortinoRatio ?? -Infinity,
    isRatio: true,
    format: (t) => (t.smart_score ? t.smart_score.sortinoRatio.toFixed(2) : "—"),
  },
  {
    key: "sharpe",
    label: "Sharpe Ratio",
    shortLabel: "Sharpe",
    description: "Return per unit of total volatility.",
    accessor: (t) => t.smart_score?.sharpeRatio ?? -Infinity,
    isRatio: true,
    format: (t) => (t.smart_score ? t.smart_score.sharpeRatio.toFixed(2) : "—"),
  },
  {
    key: "calmar",
    label: "Calmar Ratio",
    shortLabel: "Calmar",
    description: "Annualized return divided by max drawdown — reward vs. worst pain endured.",
    accessor: (t) => t.smart_score?.calmarRatio ?? -Infinity,
    isRatio: true,
    format: (t) => (t.smart_score ? t.smart_score.calmarRatio.toFixed(2) : "—"),
  },
  {
    key: "rSquared",
    label: "Consistency (R²)",
    shortLabel: "R²",
    description: "How linear and steady the equity curve is — punishes one lucky spike.",
    accessor: (t) => t.smart_score?.rSquared ?? -Infinity,
    isRatio: true,
    format: (t) => (t.smart_score ? t.smart_score.rSquared.toFixed(3) : "—"),
  },
  {
    key: "profitFactor",
    label: "Profit Factor",
    shortLabel: "PF",
    description: "Gross profit divided by gross loss.",
    accessor: (t) => t.smart_score?.profitFactor ?? -Infinity,
    isRatio: true,
    format: (t) => (t.smart_score ? t.smart_score.profitFactor.toFixed(2) : "—"),
  },
  {
    key: "winRate",
    label: "Win Rate",
    shortLabel: "Win %",
    description: "Share of winning trades.",
    accessor: (t) => t.smart_score?.winRate ?? -Infinity,
    isRatio: true,
    format: (t) => (t.smart_score ? `${(t.smart_score.winRate * 100).toFixed(1)}%` : "—"),
  },
  {
    key: "pnl",
    label: "P&L (raw)",
    shortLabel: "P&L",
    description: "Total realized profit — the original site's only sort. Always available, even when there's too little history to score.",
    accessor: (t) => t.stats.pnl,
    isRatio: false,
    format: (t) => t.stats.pnl.toFixed(0),
  },
];

export function getSortOption(key: SortKey): SortOption {
  return SORT_OPTIONS.find((o) => o.key === key) ?? SORT_OPTIONS[0];
}

/** A trader is eligible for a ratio-based sort only with enough sample size to trust the ratio.
 *  A null score (see Trader.smart_score) means dataPoints is unknowable and defaults to 0, so it
 *  never clears the bar — consistent with "—" being shown instead of a number for that row. */
export function isEligibleForRatioSort(t: Trader): boolean {
  return (t.smart_score?.dataPoints ?? 0) >= MIN_DATA_POINTS_FOR_RATIO_SORT;
}

/** Traders with zero recorded volume have no real denominator for Efficiency (P&L ÷ Volume) —
 *  excluded from that specific sort rather than shown a fake tied 0%. In practice this is
 *  effectively always true for a real leaderboard row (vol comes straight from Polymarket's own
 *  board), but the guard stays as a divide-by-zero safeguard. */
export function hasUsableVolume(t: Trader): boolean {
  return t.stats.buys + t.stats.sells > 0;
}
