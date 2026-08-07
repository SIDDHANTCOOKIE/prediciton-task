"use client";

import { useMemo, useState } from "react";
import type { Trader, FilterState, SortKey } from "@/lib/types";
import { DEFAULT_FILTERS, traderKey } from "@/lib/types";
import { applyFiltersAndSort } from "@/lib/filtering";
import { useLiveData } from "@/lib/useLiveData";
import { Header } from "@/components/Header";
import { FilterRail } from "@/components/FilterRail";
import { LeaderboardTable } from "@/components/LeaderboardTable";
import { TableSkeleton } from "@/components/TableSkeleton";
import { FormulaCaption } from "@/components/FormulaCaption";
import { CompareBar } from "@/components/CompareBar";
import { CompareDrawer } from "@/components/CompareDrawer";

type ApiResponse = { updatedAt: string | null; count: number; traders: Trader[]; stale?: boolean; error?: string };

export default function Home() {
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  // The URL itself carries the period — the backend serves a genuinely different, real snapshot
  // per period (server/src/routes/leaderboard.ts), not a client-side filter over one fixed
  // all-time fetch. useLiveData refetches whenever its url argument changes, so switching a
  // Period pill triggers a real request.
  const { data, error, isRefreshing, refresh } = useLiveData<ApiResponse>(`/api/leaderboard?period=${filters.period}`);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [compareOpen, setCompareOpen] = useState(false);

  const result = useMemo(() => (data ? applyFiltersAndSort(data.traders, filters) : []), [data, filters]);

  // Sums the currently FILTERED set's real P&L for the selected period (from Polymarket's own
  // period leaderboard, not derived) — responds to both the venue filter and the Period pills.
  const totalPnl = useMemo(() => {
    if (!data) return null;
    return result.reduce((sum, t) => sum + t.stats.pnl, 0);
  }, [data, result]);

  // Always-visible per-platform split (unaffected by filters) so the "whole" picture
  // and the platform breakdown are both on screen at once. "both" (multi-venue accounts)
  // gets its own bucket rather than being split — the upstream gives one combined pnl
  // per account, not a per-platform breakdown, so splitting it would be fabricated.
  const pnlByVenue = useMemo(() => {
    if (!data) return null;
    const byVenue = new Map<string, number>();
    for (const t of data.traders) {
      byVenue.set(t.platform, (byVenue.get(t.platform) ?? 0) + t.stats.pnl);
    }
    return byVenue;
  }, [data]);

  function handleSortChange(key: SortKey) {
    setFilters((f) => (f.sortKey === key ? { ...f, sortDir: f.sortDir === "desc" ? "asc" : "desc" } : { ...f, sortKey: key, sortDir: "desc" }));
  }

  function toggleSelect(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else if (next.size < 3) next.add(key);
      return next;
    });
  }

  const selectedTraders = useMemo(() => result.filter((t) => selected.has(traderKey(t))), [result, selected]);

  const categories = useMemo(() => {
    if (!data) return [];
    const set = new Set<string>();
    data.traders.forEach((t) => t.dominantCategory && set.add(t.dominantCategory));
    return [...set].sort();
  }, [data]);

  return (
    <div className="mx-auto flex w-full max-w-[1100px] flex-1 flex-col">
      <Header
        updatedAt={data?.updatedAt ?? null}
        totalPnl={totalPnl}
        pnlByVenue={pnlByVenue}
        activeVenue={filters.venue}
        onVenueSelect={(v) => setFilters((f) => ({ ...f, venue: v }))}
        hasError={!data && !!error}
        stale={!!data?.stale}
        isRefreshing={isRefreshing}
        onRefresh={refresh}
      />

      {error && (
        <div
          className="mx-4 mt-4 rounded-lg border px-4 py-3 text-sm sm:mx-6"
          style={{ borderColor: "var(--red)", backgroundColor: "var(--red-soft)", color: "var(--red)" }}
        >
          <strong className="font-semibold">Live data unavailable.</strong> {error}{" "}
          {data ? "Showing the last successful snapshot." : "No demo data is shown as a substitute — try again shortly."}
        </div>
      )}

      {data?.stale && (
        <div
          className="mx-4 mt-4 rounded-lg border px-4 py-3 text-sm sm:mx-6"
          style={{ borderColor: "var(--orange)", backgroundColor: "var(--orange-soft)", color: "var(--orange)" }}
        >
          Showing the last successful live snapshot — data hasn&apos;t refreshed recently (the backend may have been
          asleep/idle, or a refresh attempt failed).
        </div>
      )}

      {data && (
        <FilterRail filters={filters} onChange={setFilters} resultCount={result.length} totalCount={data.count} categories={categories} />
      )}
      {data && <FormulaCaption sortKey={filters.sortKey} />}

      <main className="flex-1">
        {!data && !error ? (
          <TableSkeleton />
        ) : data ? (
          <LeaderboardTable traders={result} totalCount={data.count} filters={filters} onSortChange={handleSortChange} selected={selected} onToggleSelect={toggleSelect} />
        ) : null}
      </main>

      <footer className="mt-auto border-t border-border-soft px-4 py-6 text-center text-xs text-text-faint sm:px-6">
        Live data ingested directly from Polymarket & Kalshi APIs, with locally calculated risk-adjusted scores.
      </footer>

      <CompareBar
        count={selected.size}
        onOpen={() => setCompareOpen(true)}
        onClear={() => {
          setSelected(new Set());
          setCompareOpen(false);
        }}
      />
      {compareOpen && selectedTraders.length >= 2 && <CompareDrawer traders={selectedTraders} onClose={() => setCompareOpen(false)} />}
    </div>
  );
}
