import type { Trader, FilterState } from "./types";
import { getSortOption, isEligibleForRatioSort } from "./sorting";

const RECENT_WINDOW_DAYS = 7;

function isRecentlyActive(t: Trader): boolean {
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
    if (f.tiers.length > 0 && !f.tiers.includes(t.smart_score.tier)) return false;
    if (t.stats.pnl < f.minPnl) return false;
    if (t.smart_score.score < f.minScore) return false;
    if (t.smart_score.winRate < f.minWinRate) return false;
    if (t.smart_score.maxDrawdownPercent > f.maxDrawdownPercent) return false;
    if (f.hideThinSamples && !isEligibleForRatioSort(t)) return false;
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
