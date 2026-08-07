import type { Trader, FilterState } from "./types";
import { getSortOption, isEligibleForRatioSort, hasUsableVolume } from "./sorting";

const RECENT_WINDOW_DAYS = 7;

function isRecentlyActive(t: Trader): boolean {
  if (!t.smart_score?.lastDate) return false;
  const last = new Date(t.smart_score.lastDate);
  const diffDays = (Date.now() - last.getTime()) / (1000 * 60 * 60 * 24);
  return diffDays <= RECENT_WINDOW_DAYS;
}

export function applyFilters(traders: Trader[], f: FilterState): Trader[] {
  const search = f.search.trim().toLowerCase();
  return traders.filter((t) => {
    if (search && !t.name.toLowerCase().includes(search)) return false;
    if (f.venue !== "all" && t.platform !== f.venue) return false;
    if (f.category !== "all" && t.dominantCategory !== f.category) return false;
    if (f.tiers.length > 0 && (!t.smart_score || !f.tiers.includes(t.smart_score.tier))) return false;
    if (f.profitableOnly && t.stats.pnl <= 0) return false;
    if (t.stats.pnl < f.minPnl) return false;
    if (t.stats.buys + t.stats.sells < f.minVolume) return false;
    // Score-based filters only apply once the user actively tightens them past their default
    // ("no constraint") value — a null score (too little history in this period, see
    // lib/metrics.ts's MIN_DAYS_FOR_SCORE) can't prove it clears a bar the user hasn't set, so it
    // isn't judged by that criterion at all until they do, rather than being silently dropped by
    // a default that was never meant to filter anything.
    if (f.minScore > 0 && (t.smart_score?.score ?? -Infinity) < f.minScore) return false;
    if (f.minSharpe > -Infinity && (t.smart_score?.sharpeRatio ?? -Infinity) < f.minSharpe) return false;
    if (f.minSortino > -Infinity && (t.smart_score?.sortinoRatio ?? -Infinity) < f.minSortino) return false;
    if (f.minWinRate > 0 && (t.smart_score?.winRate ?? -Infinity) < f.minWinRate) return false;
    if (f.maxDrawdownPercent < 1 && (t.smart_score?.maxDrawdownPercent ?? Infinity) > f.maxDrawdownPercent) return false;
    if (f.hideLowConfidence && t.isConfident === false) return false;
    if (f.hideThinSamples && !isEligibleForRatioSort(t)) return false;
    if (f.sortKey === "returnOnCapital" && !hasUsableVolume(t)) return false;
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
