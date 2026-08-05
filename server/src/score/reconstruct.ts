import { DailyReturn } from "../../../lib/metrics";

export type PolymarketActivity = {
  id: string;
  type: string; // "TRADE", "REDEEM", "SPLIT", "MERGE", "REWARD", "CONVERSION"
  timestamp: number; // confirmed live: Unix SECONDS (e.g. 1731664609 = Nov 2024), not milliseconds
  cashAmount?: number; // Depending on API response
  size?: number;
  price?: number;
  asset?: string;
  [key: string]: any;
};

/** Polymarket's /activity endpoint returns `timestamp` in Unix seconds — confirmed live
 *  (1731664609 = Nov 2024). `new Date(seconds)` misinterprets that as milliseconds, collapsing
 *  every trader's entire history into the same few minutes near the Unix epoch, which is exactly
 *  what was producing dataPoints===1 (and therefore a meaningless flat score) for nearly every
 *  trader. */
function activityTimestampMs(raw: unknown): number {
  return Number(raw) * 1000;
}

export type ReconstructResult = {
  /** Per-day deltas (NOT cumulative) — this is what computeSmartScore expects; it does its
   *  own cumulation internally for Sharpe/Sortino/drawdown/R². Feeding cumulative totals here
   *  would make every risk-adjusted metric wrong. */
  series: DailyReturn[];
  /** Cumulative equity points, one per day in `series` order — for the row sparkline, which
   *  wants a running-total shape, not daily deltas. */
  equityCurve: number[];
  /** Capital-base proxy (peak cost basis) used as the Efficiency (P&L ÷ Deposits) denominator. */
  deposits: number;
  /** Dollar volume split by side, for the minVolume filter (buys+sells ~ total volume traded). */
  buyVolume: number;
  sellVolume: number;
  /** False when the reconstructed all-time PnL doesn't reconcile with the upstream leaderboard's
   *  authoritative PnL within tolerance — surfaced to the UI so users can hide low-confidence rows
   *  rather than trust a possibly-wrong curve. */
  isConfident: boolean;
};

export function reconstructEquityCurve(
  activities: any[],
  positions: any[],
  leaderboardPnl: number
): ReconstructResult {
  // Sort activities chronologically
  const sorted = [...activities].sort((a, b) => activityTimestampMs(a.timestamp) - activityTimestampMs(b.timestamp));

  const dailyCashFlow = new Map<string, number>();
  let cumulativeCost = 0;
  let maxCumulativeCost = 0;
  let realizedPnl = 0;
  let buyVolume = 0;
  let sellVolume = 0;

  for (const act of sorted) {
    const date = new Date(activityTimestampMs(act.timestamp)).toISOString().split("T")[0];
    let cashChange = 0;

    const type = act.type?.toUpperCase();
    if (type === "TRADE") {
      const side = act.side?.toUpperCase();
      const size = Number(act.size || act.shares || 0);
      const price = Number(act.price || act.averagePrice || 0);
      const amount = size * price;

      if (side === "BUY") {
        cashChange = -amount;
        cumulativeCost += amount;
        buyVolume += amount;
      } else if (side === "SELL") {
        cashChange = amount;
        cumulativeCost -= amount;
        sellVolume += amount;
        // Approximation of realized PnL from trades is hard without matching lots,
        // but cash flow is easy.
      }
    } else if (type === "REDEEM") {
      const payout = Number(act.amount || act.usdcSize || act.cashAmount || 0);
      cashChange = payout;
      // Cost was already subtracted on BUY.
    } else if (type === "REWARD") {
      const reward = Number(act.amount || act.cashAmount || 0);
      cashChange = reward;
    }

    // SPLIT/MERGE are cash-neutral, only affect positions.
    // CONVERSION (e.g. USDC -> CT) might be neutral if we just track portfolio value.

    maxCumulativeCost = Math.max(maxCumulativeCost, cumulativeCost);
    realizedPnl += cashChange;

    dailyCashFlow.set(date, (dailyCashFlow.get(date) || 0) + cashChange);
  }

  // Unrealized PnL from open positions
  let unrealizedPnl = 0;
  for (const pos of positions) {
    // Current value of open positions
    const size = Number(pos.size || pos.shares || 0);
    const curPrice = Number(pos.curPrice || pos.currentPrice || pos.avgPrice || 0);
    unrealizedPnl += size * curPrice;
  }

  const totalCalculatedPnl = realizedPnl + unrealizedPnl;

  // Validation Gate: Reconstructed all-time PnL vs Leaderboard PnL
  // Allow a tolerance due to delayed positions API or slight price mismatches.
  const diff = Math.abs(totalCalculatedPnl - leaderboardPnl);
  const tolerance = Math.max(50, Math.abs(leaderboardPnl * 0.05)); // $50 or 5%
  const isConfident = diff <= tolerance;

  // Capital base proxy: peak cost basis from trade flow.
  const deposits = Math.max(maxCumulativeCost, 0);

  const dates = Array.from(dailyCashFlow.keys()).sort();

  // Reconciliation residual: when confident, fold the (small, by definition) gap between our
  // reconstructed total and the leaderboard's authoritative total into the last day, so the
  // final cumulative equity matches the real PnL exactly rather than drifting from rounding/
  // lot-matching approximations in the TRADE cash-flow above.
  const reconciliationResidual = isConfident ? leaderboardPnl - totalCalculatedPnl : 0;

  const series: DailyReturn[] = [];
  const equityCurve: number[] = [];
  let cumEquity = 0;

  dates.forEach((date, i) => {
    const isLastDay = i === dates.length - 1;
    // Simplification: unrealized P&L (and the reconciliation residual) is only knowable as of
    // now, so both land on the most recent day rather than being smeared across history —
    // we don't have historical mark prices for every open market on every past day.
    let dayPnl = dailyCashFlow.get(date) || 0;
    if (isLastDay) dayPnl += unrealizedPnl + reconciliationResidual;

    const returnPct = deposits > 0 ? dayPnl / deposits : 0;
    series.push({ date, pnl: dayPnl, returnPct });

    cumEquity += dayPnl;
    equityCurve.push(cumEquity);
  });

  // Ensure there's at least one data point if they have a leaderboard PnL
  if (series.length === 0) {
    const today = new Date().toISOString().split("T")[0];
    const dayPnl = totalCalculatedPnl;
    series.push({ date: today, pnl: dayPnl, returnPct: deposits > 0 ? dayPnl / deposits : 0 });
    equityCurve.push(dayPnl);
  }

  return { series, equityCurve, deposits, buyVolume, sellVolume, isConfident };
}
