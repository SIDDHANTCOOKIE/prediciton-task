import type { Trader, FilterState } from "./types";
import { getSortOption, isEligibleForRatioSort, hasUsableDeposits } from "./sorting";

const RECENT_WINDOW_DAYS = 7;

function isRecentlyActive(t: Trader): boolean {
  const last = new Date(t.smart_score.lastDate);
  const diffDays = (Date.now() - last.getTime()) / (1000 * 60 * 60 * 24);
  return diffDays <= RECENT_WINDOW_DAYS;
}

/** Applies the Period filter (1D/1W/1M/YTD/ALL): for a non-ALL period, re-points each trader's
 *  `stats.pnl` at that window's real P&L (Trader.periodPnl — see server/src/score/reconstruct.ts's
 *  computePeriodPnl) rather than their all-time total, so the P&L column, the pnl/Efficiency
 *  sorts, and the minPnl/profitableOnly filters all consistently reflect the selected window
 *  without each needing separate period-aware logic. A trader with no data for that period
 *  (currently: every Kalshi trader, whose ingester has no dated daily series — and any Polymarket
 *  trader whose activity fetch failed) is dropped rather than shown a fake/stale number, which is
 *  also what fixes a long-dormant trader still topping a "1D"/"1W" view: with no recent activity,
 *  their periodPnl for that window is a real $0 (or simply excluded by dataset trimming), not the
 *  large but old all-time total that used to render regardless of the period pill. */
function applyPeriod(traders: Trader[], period: FilterState["period"]): Trader[] {
  if (period === "ALL") return traders;
  const out: Trader[] = [];
  for (const t of traders) {
    const pnl = t.periodPnl?.[period];
    if (pnl === undefined) continue;
    out.push({ ...t, stats: { ...t.stats, pnl } });
  }
  return out;
}

export function applyFilters(traders: Trader[], f: FilterState): Trader[] {
  const search = f.search.trim().toLowerCase();
  return applyPeriod(traders, f.period).filter((t) => {
    if (search && !t.name.toLowerCase().includes(search)) return false;
    if (f.venue !== "all" && t.platform !== f.venue) return false;
    if (f.category !== "all" && t.dominantCategory !== f.category) return false;
    if (f.tiers.length > 0 && !f.tiers.includes(t.smart_score.tier)) return false;
    if (f.profitableOnly && t.stats.pnl <= 0) return false;
    if (t.stats.pnl < f.minPnl) return false;
    if ((t.stats.buys + t.stats.sells) < f.minVolume) return false;
    if (t.deposits < f.minCapital) return false;
    if (t.smart_score.score < f.minScore) return false;
    if (t.smart_score.sharpeRatio < f.minSharpe) return false;
    if (t.smart_score.sortinoRatio < f.minSortino) return false;
    if (t.smart_score.winRate < f.minWinRate) return false;
    if (t.smart_score.maxDrawdownPercent > f.maxDrawdownPercent) return false;
    if (f.hideLowConfidence && t.isConfident === false) return false;
    if (f.hideThinSamples && !isEligibleForRatioSort(t)) return false;
    if (f.sortKey === "returnOnCapital" && !hasUsableDeposits(t)) return false;
    if (f.xLinkedOnly && !t.twitter) return false;
    if (f.affiliatedOnly && !t.affiliated) return false;
    if (f.multiWalletOnly && t.wallet_count <= 1) return false;
    if (f.recentlyActiveOnly && !isRecentlyActive(t)) return false;
    return true;
  });
}

export function applySort(traders: Trader[], f: FilterState): Trader[] {
  const option = getSortOption(f.sortKey);
  const dir = f.sortDir === "asc" ? 1 : -1;
  return [...traders].sort((a, b) => dir * (option.accessor(a) - option.accessor(b)));
}

export function applyFiltersAndSort(traders: Trader[], f: FilterState): Trader[] {
  return applySort(applyFilters(traders, f), f);
}
