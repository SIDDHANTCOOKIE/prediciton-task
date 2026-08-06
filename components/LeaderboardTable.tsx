"use client";

import { Fragment, useState } from "react";
import clsx from "clsx";
import { traderKey, type Trader, type FilterState, type SortKey } from "@/lib/types";
import { getSortOption, isEligibleForRatioSort } from "@/lib/sorting";
import { ScoreBadge, TierChip } from "@/components/ScoreBadge";
import { VenueBadges } from "@/components/VenueBadge";
import { Sparkline } from "@/components/Sparkline";
import { ScoreBreakdownPanel } from "@/components/ScoreBreakdownPanel";
import { formatUsd, formatPercent, shortAddress, traderProfileUrl } from "@/lib/format";

const COLUMNS: { key: SortKey | "rank" | "trader" | "venue" | "select"; label: string; sortable: boolean; className?: string }[] = [
  { key: "select", label: "", sortable: false, className: "w-8" },
  { key: "rank", label: "#", sortable: false, className: "w-12" },
  { key: "trader", label: "Trader", sortable: false, className: "min-w-[220px]" },
  { key: "score", label: "Score", sortable: true },
  { key: "returnOnCapital", label: "Efficiency", sortable: true },
  { key: "pnl", label: "P&L", sortable: true },
  { key: "winRate", label: "Win %", sortable: true },
  { key: "venue", label: "Venue", sortable: false },
];

function SortIcon({ active, dir }: { active: boolean; dir: "asc" | "desc" }) {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      className={clsx("transition-opacity", active ? "opacity-100" : "opacity-0 group-hover:opacity-30")}
      style={{ transform: dir === "asc" ? "rotate(180deg)" : undefined }}
    >
      <path d="M12 5v14M5 12l7 7 7-7" />
    </svg>
  );
}

function Avatar({ name, pfp }: { name: string; pfp: string }) {
  if (pfp) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={pfp} alt={name} className="h-8 w-8 shrink-0 rounded-full object-cover" referrerPolicy="no-referrer" />;
  }
  const initial = name.charAt(0).toUpperCase();
  const hue = (name.charCodeAt(0) * 47) % 360;
  return (
    <div
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
      style={{ backgroundColor: `hsl(${hue} 55% 45%)` }}
    >
      {initial}
    </div>
  );
}

export function LeaderboardTable({
  traders,
  totalCount,
  filters,
  onSortChange,
  selected,
  onToggleSelect,
}: {
  traders: Trader[];
  /** Total traders before filtering — distinguishes "the dataset is empty" (an ingestion/freshness
   *  problem) from "your filters matched nothing" (a filter problem). Without this, an empty
   *  ingest looks identical to an over-narrow filter and misdirects toward tweaking filters. */
  totalCount: number;
  filters: FilterState;
  onSortChange: (key: SortKey) => void;
  selected: Set<string>;
  onToggleSelect: (key: string) => void;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (traders.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 px-6 py-20 text-center">
        {totalCount === 0 ? (
          <>
            <span className="text-sm font-medium text-text">No trader data available right now</span>
            <span className="text-xs text-text-faint">The live dataset is empty — this is a data freshness issue, not your filters. Try again shortly.</span>
          </>
        ) : (
          <>
            <span className="text-sm font-medium text-text">No traders match these filters</span>
            <span className="text-xs text-text-faint">Try widening the min-score or drawdown filters.</span>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border-soft text-left text-xs text-text-faint">
            {COLUMNS.map((col, i) => {
              const sortable = col.sortable && col.key !== "rank" && col.key !== "trader" && col.key !== "venue";
              const isActive = sortable && filters.sortKey === col.key;
              return (
                <th
                  key={`${col.key}-${i}`}
                  className={clsx("px-3 py-2.5 font-medium", col.className, sortable && "group cursor-pointer select-none hover:text-text")}
                  onClick={sortable ? () => onSortChange(col.key as SortKey) : undefined}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.label}
                    {sortable && <SortIcon active={isActive} dir={filters.sortDir} />}
                  </span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {traders.map((t, idx) => {
            const key = traderKey(t);
            const isOpen = expanded === key;
            const hasDeposits = t.deposits > 0;
            const roc = hasDeposits ? t.stats.pnl / t.deposits : 0;
            const thin = !isEligibleForRatioSort(t);
            const activeSort = getSortOption(filters.sortKey);
            return (
              <Fragment key={key}>
                <tr
                  onClick={() => setExpanded(isOpen ? null : key)}
                  className="cursor-pointer border-b border-border-soft transition-colors hover:bg-row-hover"
                >
                  <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selected.has(key)}
                      onChange={() => onToggleSelect(key)}
                      className="h-3.5 w-3.5 accent-[var(--accent)]"
                      aria-label={`Select ${t.name} to compare`}
                    />
                  </td>
                  <td className="px-3 py-2.5 font-mono text-text-faint tabular-nums">
                    <span className="inline-flex items-center gap-1.5">
                      {idx + 1}
                      {filters.sortKey === "score" &&
                        typeof t.previousScoreRank === "number" &&
                        t.previousScoreRank !== idx + 1 &&
                        (() => {
                          const delta = t.previousScoreRank! - (idx + 1);
                          const up = delta > 0;
                          return (
                            <span
                              title={`Score rank ${up ? "rose" : "fell"} ${Math.abs(delta)} since last refresh`}
                              className="inline-flex items-center text-[10px] font-semibold"
                              style={{ color: up ? "var(--green)" : "var(--red)" }}
                            >
                              {up ? "▲" : "▼"}
                              {Math.abs(delta)}
                            </span>
                          );
                        })()}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    {(() => {
                      const profileUrl = traderProfileUrl(t);
                      const Wrapper = profileUrl ? "a" : "div";
                      return (
                        <Wrapper
                          {...(profileUrl
                            ? { href: profileUrl, target: "_blank", rel: "noopener noreferrer", title: `Open ${t.name}'s profile` }
                            : {})}
                          onClick={(e: React.MouseEvent) => e.stopPropagation()}
                          className={clsx("flex items-center gap-2.5", profileUrl && "group/profile cursor-pointer")}
                        >
                          <Avatar name={t.name} pfp={t.pfp} />
                          <div className="flex min-w-0 flex-col">
                            <span
                              className={clsx(
                                "flex items-center gap-1.5 truncate font-medium text-text",
                                profileUrl && "group-hover/profile:underline"
                              )}
                            >
                              {t.name}
                              {t.affiliated && (
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5" className="shrink-0">
                                  <path d="M20 6 9 17l-5-5" />
                                </svg>
                              )}
                              {t.wallet_count > 1 && (
                                <span className="rounded bg-border-soft px-1 text-[9px] font-semibold text-text-faint">{t.wallet_count}W</span>
                              )}
                            </span>
                            <span className="truncate font-mono text-[11px] text-text-faint">
                              {t.wallet ? shortAddress(t.wallet) : t.kalshi_username ? `@${t.kalshi_username}` : t.join_date}
                            </span>
                          </div>
                        </Wrapper>
                      );
                    })()}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <ScoreBadge score={t.smart_score.score} tier={t.smart_score.tier} size="sm" />
                      {thin && (
                        <span title={`Only ${t.smart_score.dataPoints} days tracked — excluded from ratio sorts by default`} className="text-text-faint">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10" />
                            <path d="M12 8v5M12 16h.01" />
                          </svg>
                        </span>
                      )}
                      {t.isConfident === false && t.historyTruncated && (
                        <span
                          title="Score based on partial trading history — Polymarket's public API only exposes each trader's most recent ~5,000 events (a hard platform limit), not their full lifetime record. Not an error, just an upstream data limit."
                          className="flex h-3.5 w-3.5 items-center justify-center rounded-full text-text-faint"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10" />
                            <path d="M12 16v-5M12 8h.01" strokeLinecap="round" />
                          </svg>
                        </span>
                      )}
                      {t.isConfident === false && !t.historyTruncated && (
                        <span title="Low confidence: reconstructed history's P&L doesn't match the venue's own reported total" className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-orange-soft text-[10px] font-bold text-orange">
                          !
                        </span>
                      )}
                    </div>
                  </td>
                  <td
                    className="px-3 py-2.5 font-mono tabular-nums"
                    style={hasDeposits ? { color: roc >= 0 ? "var(--green)" : "var(--red)" } : { color: "var(--text-faint)" }}
                    title={hasDeposits ? undefined : "No resolvable deposit data for this trader"}
                  >
                    {hasDeposits ? `${roc >= 0 ? "+" : ""}${(roc * 100).toFixed(0)}%` : "—"}
                  </td>
                  <td className="px-3 py-2.5 font-mono tabular-nums" style={{ color: t.stats.pnl >= 0 ? "var(--green)" : "var(--red)" }}>
                    {formatUsd(t.stats.pnl, { signed: true, compact: true })}
                  </td>
                  <td className="px-3 py-2.5 font-mono tabular-nums text-text-muted">{formatPercent(t.smart_score.winRate, 0)}</td>
                  <td className="px-3 py-2.5">
                    <VenueBadges venue={t.platform} />
                  </td>
                </tr>
                {isOpen && (
                  <tr className="border-b border-border-soft bg-bg">
                    <td colSpan={COLUMNS.length} className="p-0">
                      <div className="animate-fade-in-up flex items-center justify-between px-4 pt-3">
                        <div className="flex items-center gap-3">
                          <TierChip tier={t.smart_score.tier} />
                          <Sparkline data={t.equity_curve} width={120} height={32} />
                        </div>
                        <span className="font-mono text-[11px] text-text-faint">
                          Active sort: {activeSort.label} — {activeSort.format(t)}
                        </span>
                      </div>
                      <ScoreBreakdownPanel smartScore={t.smart_score} />
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
