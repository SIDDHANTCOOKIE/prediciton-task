"use client";

import { useEffect, useMemo, useState } from "react";
import type { Trader, FilterState, SortKey } from "@/lib/types";
import { DEFAULT_FILTERS, traderKey } from "@/lib/types";
import { applyFiltersAndSort } from "@/lib/filtering";
import { Header } from "@/components/Header";
import { FilterRail } from "@/components/FilterRail";
import { LeaderboardTable } from "@/components/LeaderboardTable";
import { TableSkeleton } from "@/components/TableSkeleton";
import { FormulaCaption } from "@/components/FormulaCaption";
import { CompareBar } from "@/components/CompareBar";
import { CompareDrawer } from "@/components/CompareDrawer";

type ApiResponse = { updatedAt: string | null; count: number; traders: Trader[]; stale?: boolean; error?: string };

export default function Home() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [compareOpen, setCompareOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/leaderboard")
      .then(async (r) => {
        const json: ApiResponse = await r.json();
        if (!r.ok || json.error) throw new Error(json.error ?? `Live data request failed (HTTP ${r.status})`);
        return json;
      })
      .then((json) => {
        if (!cancelled) setData(json);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message ?? "Failed to load live leaderboard data");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const result = useMemo(() => (data ? applyFiltersAndSort(data.traders, filters) : []), [data, filters]);

  // This upstream doesn't expose a daily equity series, so a "today" delta isn't
  // computable — show the real combined all-time P&L instead of a fabricated daily
  // figure. Sums the currently FILTERED set, so it responds to the venue filter etc.
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
        hasError={!!error}
      />

      {error && (
        <div
          className="mx-4 mt-4 rounded-lg border px-4 py-3 text-sm sm:mx-6"
          style={{ borderColor: "var(--red)", backgroundColor: "var(--red-soft)", color: "var(--red)" }}
        >
          <strong className="font-semibold">Live data unavailable.</strong> {error} No demo data is shown as a substitute — try again shortly.
        </div>
      )}

      {data?.stale && (
        <div
          className="mx-4 mt-4 rounded-lg border px-4 py-3 text-sm sm:mx-6"
          style={{ borderColor: "var(--orange)", backgroundColor: "var(--orange-soft)", color: "var(--orange)" }}
        >
          Showing the last successful live snapshot — the most recent refresh attempt failed.
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
          <LeaderboardTable traders={result} filters={filters} onSortChange={handleSortChange} selected={selected} onToggleSelect={toggleSelect} />
        ) : null}
      </main>

      <footer className="mt-auto border-t border-border-soft px-4 py-6 text-center text-xs text-text-faint sm:px-6">
        Live trader data via predicting.top&apos;s public leaderboard API — re-ranked and re-filtered here for efficiency-first sorting.
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
