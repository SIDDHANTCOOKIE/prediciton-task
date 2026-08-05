"use client";

import { useEffect, useMemo, useState } from "react";
import type { Position, Tier, Venue } from "@/lib/types";
import { Header } from "@/components/Header";
import { PositionsTable } from "@/components/PositionsTable";
import { MarketGroupedPositions } from "@/components/MarketGroupedPositions";
import { TableSkeleton } from "@/components/TableSkeleton";
import { VENUE_OPTIONS } from "@/components/VenueBadge";

type ApiResponse = { updatedAt: string | null; count: number; positions: Position[]; stale?: boolean; error?: string };

const TIERS: Tier[] = ["Elite", "Great", "Good", "Average", "Risky"];

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
        active ? "bg-text text-bg" : "text-text-muted hover:bg-row-hover hover:text-text"
      }`}
    >
      {children}
    </button>
  );
}

export default function PositionsPage() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"trader" | "market">("trader");
  const [minSize, setMinSize] = useState(0);
  const [venue, setVenue] = useState<Venue | "all">("all");
  const [side, setSide] = useState<"all" | "YES" | "NO">("all");
  const [tiers, setTiers] = useState<Tier[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/positions")
      .then(async (r) => {
        const json: ApiResponse = await r.json();
        if (!r.ok || json.error) throw new Error(json.error ?? `Live data request failed (HTTP ${r.status})`);
        return json;
      })
      .then((json) => {
        if (!cancelled) setData(json);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message ?? "Failed to load live positions data");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    if (!data) return [];
    return data.positions.filter((p) => {
      if (p.size < minSize) return false;
      if (venue !== "all" && p.venue !== venue) return false;
      if (side !== "all" && p.side !== side) return false;
      if (tiers.length > 0 && (!p.traderTier || !tiers.includes(p.traderTier))) return false;
      return true;
    });
  }, [data, minSize, venue, side, tiers]);

  function toggleTier(t: Tier) {
    setTiers((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  }

  return (
    <div className="mx-auto flex w-full max-w-[1100px] flex-1 flex-col">
      <Header updatedAt={data?.updatedAt ?? null} totalPnl={null} hasError={!!error} />

      {error && (
        <div
          className="mx-4 mt-4 rounded-lg border px-4 py-3 text-sm sm:mx-6"
          style={{ borderColor: "var(--red)", backgroundColor: "var(--red-soft)", color: "var(--red)" }}
        >
          <strong className="font-semibold">Live data unavailable.</strong> {error} No demo data is shown as a substitute.
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
        <div className="flex flex-col gap-3 border-b border-border-soft bg-bg-elevated/60 px-4 py-3 sm:px-6">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <div className="flex rounded-lg border border-border p-0.5">
              <Pill active={view === "trader"} onClick={() => setView("trader")}>
                By trader
              </Pill>
              <Pill active={view === "market"} onClick={() => setView("market")}>
                By market
              </Pill>
            </div>

            <div className="flex rounded-lg border border-border p-0.5">
              {(["all", "YES", "NO"] as const).map((s) => (
                <Pill key={s} active={side === s} onClick={() => setSide(s)}>
                  {s === "all" ? "All sides" : s}
                </Pill>
              ))}
            </div>

            <select
              value={venue}
              onChange={(e) => setVenue(e.target.value as Venue | "all")}
              className="rounded-lg border border-border bg-bg px-3 py-1.5 text-sm text-text outline-none"
            >
              {VENUE_OPTIONS.map((v) => (
                <option key={v.value} value={v.value}>
                  {v.label}
                </option>
              ))}
            </select>

            <label className="flex items-center gap-2 text-sm text-text-muted">
              Min size
              <input
                type="number"
                min={0}
                value={minSize}
                onChange={(e) => setMinSize(Number(e.target.value) || 0)}
                className="w-24 rounded-lg border border-border bg-bg px-2 py-1 text-text outline-none"
              />
            </label>

            <div className="flex flex-wrap gap-1">
              {TIERS.map((t) => (
                <Pill key={t} active={tiers.includes(t)} onClick={() => toggleTier(t)}>
                  {t}
                </Pill>
              ))}
            </div>
          </div>
          <div className="text-xs text-text-faint">
            {filtered.length} of {data.count} open positions
          </div>
        </div>
      )}

      <main className="flex-1">
        {!data && !error ? (
          <TableSkeleton />
        ) : !data ? null : view === "trader" ? (
          <PositionsTable positions={filtered} />
        ) : (
          <MarketGroupedPositions positions={filtered} />
        )}
      </main>

      <footer className="mt-auto border-t border-border-soft px-4 py-6 text-center text-xs text-text-faint sm:px-6">
        Live open positions for Polymarket&apos;s top 40 wallets by P&amp;L, fetched directly from Polymarket&apos;s public API — a different
        wallet set/ranking than the main leaderboard (served from our own backend), so tier badges may be sparse here.
      </footer>
    </div>
  );
}
