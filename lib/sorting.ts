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
    accessor: (t) => t.smart_score.score,
    isRatio: true,
    format: (t) => t.smart_score.score.toFixed(1),
  },
  {
    key: "returnOnCapital",
    label: "Efficiency (P&L ÷ Deposits)",
    shortLabel: "Efficiency",
    description: "Formula: P&L ÷ Deposited capital — profit per dollar actually put in. A simple, transparent alternative to the composite Score.",
    accessor: (t) => (t.deposits > 0 ? t.stats.pnl / t.deposits : 0),
    isRatio: true,
    format: (t) => `${((t.deposits > 0 ? t.stats.pnl / t.deposits : 0) * 100).toFixed(0)}%`,
  },
  {
    key: "sortino",
    label: "Sortino Ratio",
    shortLabel: "Sortino",
    description: "Return per unit of downside risk only — ignores harmless upside volatility.",
    accessor: (t) => t.smart_score.sortinoRatio,
    isRatio: true,
    format: (t) => t.smart_score.sortinoRatio.toFixed(2),
  },
  {
    key: "sharpe",
    label: "Sharpe Ratio",
    shortLabel: "Sharpe",
    description: "Return per unit of total volatility.",
    accessor: (t) => t.smart_score.sharpeRatio,
    isRatio: true,
    format: (t) => t.smart_score.sharpeRatio.toFixed(2),
  },
  {
    key: "calmar",
    label: "Calmar Ratio",
    shortLabel: "Calmar",
    description: "Annualized return divided by max drawdown — reward vs. worst pain endured.",
    accessor: (t) => t.smart_score.calmarRatio,
    isRatio: true,
    format: (t) => t.smart_score.calmarRatio.toFixed(2),
  },
  {
    key: "rSquared",
    label: "Consistency (R²)",
    shortLabel: "R²",
    description: "How linear and steady the equity curve is — punishes one lucky spike.",
    accessor: (t) => t.smart_score.rSquared,
    isRatio: true,
    format: (t) => t.smart_score.rSquared.toFixed(3),
  },
  {
    key: "profitFactor",
    label: "Profit Factor",
    shortLabel: "PF",
    description: "Gross profit divided by gross loss.",
    accessor: (t) => t.smart_score.profitFactor,
    isRatio: true,
    format: (t) => t.smart_score.profitFactor.toFixed(2),
  },
  {
    key: "winRate",
    label: "Win Rate",
    shortLabel: "Win %",
    description: "Share of winning trades.",
    accessor: (t) => t.smart_score.winRate,
    isRatio: true,
    format: (t) => `${(t.smart_score.winRate * 100).toFixed(1)}%`,
  },
  {
    key: "pnl",
    label: "P&L (raw)",
    shortLabel: "P&L",
    description: "Total realized profit — the original site's only sort.",
    accessor: (t) => t.stats.pnl,
    isRatio: false,
    format: (t) => t.stats.pnl.toFixed(0),
  },
];

export function getSortOption(key: SortKey): SortOption {
  return SORT_OPTIONS.find((o) => o.key === key) ?? SORT_OPTIONS[0];
}

/** A trader is eligible for a ratio-based sort only with enough sample size to trust the ratio. */
export function isEligibleForRatioSort(t: Trader): boolean {
  return t.smart_score.dataPoints >= MIN_DATA_POINTS_FOR_RATIO_SORT;
}

/** Traders with no resolvable deposits (e.g. Kalshi accounts with no linked wallet) have no
 *  real denominator for Efficiency (P&L ÷ Deposits) — always excluded from that specific sort,
 *  independent of the general thin-sample toggle, rather than shown a fake tied 0%. */
export function hasUsableDeposits(t: Trader): boolean {
  return t.deposits > 0;
}
