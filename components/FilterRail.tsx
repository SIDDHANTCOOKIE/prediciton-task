"use client";

import { useState } from "react";
import clsx from "clsx";
import type { FilterState, Period, Tier, Venue } from "@/lib/types";
import { SORT_OPTIONS, MIN_DATA_POINTS_FOR_RATIO_SORT } from "@/lib/sorting";
import { VENUE_OPTIONS } from "@/components/VenueBadge";
import { Dropdown } from "@/components/Dropdown";
import { formatUsd } from "@/lib/format";

const PERIODS: Period[] = ["1D", "1W", "1M", "YTD", "ALL"];
const TIERS: Tier[] = ["Elite", "Great", "Good", "Average", "Risky"];
// Thresholds sized to the real observed P&L distribution (live check: min ~$79k, p25 ~$383k,
// median ~$3.7M, p75 ~$6.1M, max ~$22.5M) — the previous $5+/$1k+/$10k+ steps were leftover from
// a much smaller-scale dataset and every current trader cleared all three, making the buttons
// functionally identical to "All".
const PNL_QUICK: { label: string; value: number }[] = [
  { label: "All", value: -Infinity },
  { label: "$100k+", value: 100_000 },
  { label: "$1M+", value: 1_000_000 },
  { label: "$5M+", value: 5_000_000 },
];

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
        active ? "bg-text text-bg" : "text-text-muted hover:bg-row-hover hover:text-text"
      )}
    >
      {children}
    </button>
  );
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="px-0.5 text-[10px] font-semibold uppercase tracking-wide text-text-faint">{label}</span>
      {children}
    </div>
  );
}

function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      title={hint}
      className={clsx(
        "flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors",
        checked ? "border-accent bg-accent-soft text-text" : "border-border text-text-muted hover:text-text"
      )}
    >
      <span
        className={clsx(
          "flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border transition-colors",
          checked ? "border-accent bg-accent" : "border-border"
        )}
      >
        {checked && (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </span>
      {label}
    </button>
  );
}

export function FilterRail({
  filters,
  onChange,
  resultCount,
  totalCount,
  categories = [],
}: {
  filters: FilterState;
  onChange: (next: FilterState) => void;
  resultCount: number;
  totalCount: number;
  categories?: string[];
}) {
  const [moreOpen, setMoreOpen] = useState(false);
  const sortOption = SORT_OPTIONS.find((o) => o.key === filters.sortKey)!;

  function set<K extends keyof FilterState>(key: K, value: FilterState[K]) {
    onChange({ ...filters, [key]: value });
  }

  function toggleTier(t: Tier) {
    const has = filters.tiers.includes(t);
    set("tiers", has ? filters.tiers.filter((x) => x !== t) : [...filters.tiers, t]);
  }

  const activeExtraCount = [
    filters.minWinRate > 0,
    filters.maxDrawdownPercent < 1,

    filters.affiliatedOnly,
    filters.multiWalletOnly,
    filters.recentlyActiveOnly,
    !filters.hideThinSamples,
  ].filter(Boolean).length;

  return (
    <div className="flex flex-col gap-3 border-b border-border-soft bg-bg-elevated/60 px-4 py-3 sm:px-6">
      {/* Row 1: search + sort */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <svg
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-faint"
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            value={filters.search}
            onChange={(e) => set("search", e.target.value)}
            placeholder="Search traders…"
            className="w-full rounded-lg border border-border bg-bg px-3 py-2 pl-9 text-sm text-text placeholder:text-text-faint outline-none transition-colors focus:border-accent"
          />
        </div>

        <Dropdown
          align="right"
          trigger={({ open }) => (
            <button
              className={clsx(
                "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                open ? "border-accent text-text" : "border-border text-text hover:border-text-faint"
              )}
            >
              <span className="text-text-faint">Sort by</span>
              {sortOption.shortLabel}
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
          )}
        >
          {(close) => (
            <div className="max-h-[420px] overflow-y-auto py-1.5">
              {SORT_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => {
                    set("sortKey", opt.key);
                    close();
                  }}
                  className={clsx(
                    "block w-full px-3.5 py-2.5 text-left transition-colors hover:bg-row-hover",
                    opt.key === filters.sortKey && "bg-accent-soft"
                  )}
                >
                  <div className="flex items-center justify-between text-sm font-medium text-text">
                    {opt.label}
                    {opt.key === "score" && (
                      <span className="rounded-full bg-accent-soft px-1.5 py-0.5 text-[10px] font-semibold text-accent">DEFAULT</span>
                    )}
                  </div>
                  <div className="mt-0.5 text-xs leading-snug text-text-faint">{opt.description}</div>
                </button>
              ))}
            </div>
          )}
        </Dropdown>

        <button
          onClick={() => set("sortDir", filters.sortDir === "desc" ? "asc" : "desc")}
          title={filters.sortDir === "desc" ? "High to low" : "Low to high"}
          className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-lg border border-border text-text-muted transition-colors hover:border-text-faint hover:text-text"
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            className={clsx("transition-transform", filters.sortDir === "asc" && "rotate-180")}
          >
            <path d="M12 5v14M5 12l7 7 7-7" />
          </svg>
        </button>
      </div>

      {/* Row 2: period + venue + pnl quick-select */}
      <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
        <FilterGroup label="Period">
          <div className="flex rounded-lg border border-border p-0.5">
            {PERIODS.map((p) => (
              <Pill key={p} active={filters.period === p} onClick={() => set("period", p)}>
                {p}
              </Pill>
            ))}
          </div>
        </FilterGroup>

        <Dropdown
          trigger={({ open }) => (
            <button
              className={clsx(
                "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
                open ? "border-accent text-text" : "border-border text-text-muted hover:text-text"
              )}
            >
              <span className="text-text-faint">Venue:</span>
              {VENUE_OPTIONS.find((v) => v.value === filters.venue)?.label}
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
          )}
        >
          {(close) => (
            <div className="py-1.5">
              {VENUE_OPTIONS.map((v) => (
                <button
                  key={v.value}
                  onClick={() => {
                    set("venue", v.value as Venue | "all");
                    close();
                  }}
                  className={clsx(
                    "block w-full px-3.5 py-2 text-left text-sm transition-colors hover:bg-row-hover",
                    v.value === filters.venue ? "text-accent" : "text-text"
                  )}
                >
                  {v.label}
                </button>
              ))}
            </div>
          )}
        </Dropdown>

        {categories.length > 0 && (
          <Dropdown
            trigger={({ open }) => (
              <button
                className={clsx(
                  "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
                  open ? "border-accent text-text" : "border-border text-text-muted hover:text-text"
                )}
              >
                {filters.category === "all" ? "All categories" : filters.category}
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
            )}
          >
            {(close) => (
              <div className="max-h-64 overflow-y-auto py-1.5">
                {["all", ...categories].map((c) => (
                  <button
                    key={c}
                    onClick={() => {
                      set("category", c);
                      close();
                    }}
                    className={clsx(
                      "block w-full px-3.5 py-2 text-left text-sm transition-colors hover:bg-row-hover",
                      c === filters.category ? "text-accent" : "text-text"
                    )}
                  >
                    {c === "all" ? "All categories" : c}
                  </button>
                ))}
              </div>
            )}
          </Dropdown>
        )}

        <FilterGroup label="Min P&L">
          <div className="flex rounded-lg border border-border p-0.5">
            {PNL_QUICK.map((q) => (
              <Pill key={q.label} active={filters.minPnl === q.value} onClick={() => set("minPnl", q.value)}>
                {q.label}
              </Pill>
            ))}
          </div>
        </FilterGroup>

        <FilterGroup label="Tier">
          <div className="flex flex-wrap gap-1">
            {TIERS.map((t) => (
              <Pill key={t} active={filters.tiers.includes(t)} onClick={() => toggleTier(t)}>
                {t}
              </Pill>
            ))}
          </div>
        </FilterGroup>

        <button
          onClick={() => setMoreOpen((v) => !v)}
          className={clsx(
            "ml-auto flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
            moreOpen || activeExtraCount > 0 ? "border-accent text-text" : "border-border text-text-muted hover:text-text"
          )}
        >
          More filters
          {activeExtraCount > 0 && (
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-white">
              {activeExtraCount}
            </span>
          )}
        </button>
      </div>

      {moreOpen && (
        <div className="animate-fade-in-up flex flex-col gap-4 rounded-xl border border-border-soft bg-bg p-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <label className="flex flex-col gap-1.5">
              <span className="flex justify-between text-xs font-medium text-text-muted">
                Min win rate <span className="font-mono text-text">{(filters.minWinRate * 100).toFixed(0)}%</span>
              </span>
              <input
                type="range"
                min={0}
                max={0.9}
                step={0.05}
                value={filters.minWinRate}
                onChange={(e) => set("minWinRate", Number(e.target.value))}
                className="accent-[var(--accent)]"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="flex justify-between text-xs font-medium text-text-muted">
                Max drawdown ceiling{" "}
                <span className="font-mono text-text">{filters.maxDrawdownPercent >= 1 ? "None" : `${(filters.maxDrawdownPercent * 100).toFixed(0)}%`}</span>
              </span>
              <input
                type="range"
                min={0.05}
                max={1}
                step={0.05}
                value={filters.maxDrawdownPercent}
                onChange={(e) => set("maxDrawdownPercent", Number(e.target.value))}
                className="accent-[var(--accent)]"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="flex justify-between text-xs font-medium text-text-muted">
                Min score <span className="font-mono text-text">{filters.minScore.toFixed(0)}</span>
              </span>
              <input
                type="range"
                min={0}
                max={95}
                step={5}
                value={filters.minScore}
                onChange={(e) => set("minScore", Number(e.target.value))}
                className="accent-[var(--accent)]"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="flex justify-between text-xs font-medium text-text-muted">
                Min volume <span className="font-mono text-text">{formatUsd(filters.minVolume, { compact: true })}</span>
              </span>
              <input
                type="range"
                min={0}
                max={5_000_000}
                step={100_000}
                value={filters.minVolume}
                onChange={(e) => set("minVolume", Number(e.target.value))}
                className="accent-[var(--accent)]"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="flex justify-between text-xs font-medium text-text-muted">
                Min capital <span className="font-mono text-text">{formatUsd(filters.minCapital, { compact: true })}</span>
              </span>
              <input
                type="range"
                min={0}
                max={5_000_000}
                step={100_000}
                value={filters.minCapital}
                onChange={(e) => set("minCapital", Number(e.target.value))}
                className="accent-[var(--accent)]"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="flex justify-between text-xs font-medium text-text-muted">
                Min Sharpe <span className="font-mono text-text">{filters.minSharpe === -Infinity ? "Any" : filters.minSharpe.toFixed(1)}</span>
              </span>
              <input
                type="range"
                min={-2}
                max={5}
                step={0.5}
                value={filters.minSharpe === -Infinity ? -2 : filters.minSharpe}
                onChange={(e) => set("minSharpe", Number(e.target.value) <= -2 ? -Infinity : Number(e.target.value))}
                className="accent-[var(--accent)]"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="flex justify-between text-xs font-medium text-text-muted">
                Min Sortino <span className="font-mono text-text">{filters.minSortino === -Infinity ? "Any" : filters.minSortino.toFixed(1)}</span>
              </span>
              <input
                type="range"
                min={-2}
                max={5}
                step={0.5}
                value={filters.minSortino === -Infinity ? -2 : filters.minSortino}
                onChange={(e) => set("minSortino", Number(e.target.value) <= -2 ? -Infinity : Number(e.target.value))}
                className="accent-[var(--accent)]"
              />
            </label>
          </div>

          <div className="flex flex-wrap gap-2">
            <Toggle checked={filters.profitableOnly} onChange={(v) => set("profitableOnly", v)} label="Profitable only" />
            <Toggle
              checked={filters.hideThinSamples}
              onChange={(v) => set("hideThinSamples", v)}
              label={`Hide thin samples (<${MIN_DATA_POINTS_FOR_RATIO_SORT}d)`}
              hint="Excludes traders whose sample size is too small to trust a ratio-based rank"
            />
            <Toggle
              checked={filters.hideLowConfidence}
              onChange={(v) => set("hideLowConfidence", v)}
              label="Hide low confidence"
              hint="Hide traders whose score is based on partial history — either a genuine mismatch, or Polymarket's API hard-limiting how much lifetime history is retrievable"
            />

            <Toggle checked={filters.affiliatedOnly} onChange={(v) => set("affiliatedOnly", v)} label="Verified / affiliated" />
            <Toggle checked={filters.multiWalletOnly} onChange={(v) => set("multiWalletOnly", v)} label="Multi-wallet" />
            <Toggle checked={filters.recentlyActiveOnly} onChange={(v) => set("recentlyActiveOnly", v)} label="Active this week" />
          </div>
        </div>
      )}

      <div className="text-xs text-text-faint">
        {resultCount} of {totalCount} traders
      </div>
    </div>
  );
}
