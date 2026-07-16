"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { formatUsd, timeAgo } from "@/lib/format";
import type { Venue } from "@/lib/types";

const ThemeToggle = dynamic(() => import("@/components/ThemeToggle"), {
  ssr: false,
  loading: () => <div className="h-8 w-8 shrink-0" />,
});

function NavTabs() {
  const pathname = usePathname();
  const tabs = [
    { href: "/", label: "Leaderboard" },
    { href: "/positions", label: "Positions" },
  ];
  return (
    <nav className="flex gap-1 rounded-lg border border-border p-0.5">
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          className={clsx(
            "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            pathname === tab.href ? "bg-text text-bg" : "text-text-muted hover:text-text"
          )}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}

const VENUE_LABELS: Record<string, string> = {
  polymarket: "Polymarket",
  kalshi: "Kalshi",
  myriad: "Myriad",
  opinion: "Opinion",
  both: "Multi-venue",
};

export function Header({
  updatedAt,
  totalPnl,
  pnlByVenue,
  activeVenue,
  onVenueSelect,
  hasError = false,
}: {
  updatedAt: string | null;
  totalPnl: number | null;
  pnlByVenue?: Map<string, number> | null;
  activeVenue?: Venue | "all";
  onVenueSelect?: (v: Venue | "all") => void;
  hasError?: boolean;
}) {
  const totalLabel = activeVenue && activeVenue !== "all" ? `Total P&L (${VENUE_LABELS[activeVenue] ?? activeVenue})` : "Total P&L (all platforms)";

  return (
    <header className="border-b border-border-soft px-4 pb-5 pt-6 sm:px-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-text sm:text-[28px]">Efficiency Leaderboard</h1>
          <p className="mt-1 text-sm text-text-muted">Ranked by risk-adjusted skill, not just bankroll size.</p>
        </div>
        <div className="flex items-center gap-3">
          <NavTabs />
          <ThemeToggle />
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3">
        <div>
          <div className="text-xs text-text-faint">{totalLabel}</div>
          <div
            className="font-mono text-lg font-semibold tabular-nums"
            style={totalPnl !== null ? { color: totalPnl >= 0 ? "var(--green)" : "var(--red)" } : { color: "var(--text-faint)" }}
          >
            {totalPnl !== null ? formatUsd(totalPnl, { signed: true, compact: true }) : "—"}
          </div>
        </div>
        <div className="h-8 w-px bg-border-soft" />
        <div className="text-xs text-text-faint">
          {updatedAt ? `Updated ${timeAgo(updatedAt)}` : hasError ? "Unavailable" : "Loading…"}
        </div>

        {pnlByVenue && pnlByVenue.size > 0 && (
          <>
            <div className="hidden h-8 w-px bg-border-soft sm:block" />
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                onClick={() => onVenueSelect?.("all")}
                className={clsx(
                  "rounded-md px-2 py-1 text-xs font-mono tabular-nums transition-colors",
                  (!activeVenue || activeVenue === "all") ? "bg-row-hover text-text" : "text-text-faint hover:text-text"
                )}
                title="Show all platforms"
              >
                All {formatUsd([...pnlByVenue.values()].reduce((a, b) => a + b, 0), { signed: true, compact: true })}
              </button>
              {[...pnlByVenue.entries()].map(([venue, pnl]) => (
                <button
                  key={venue}
                  onClick={() => onVenueSelect?.(venue as Venue)}
                  className={clsx(
                    "rounded-md px-2 py-1 text-xs font-mono tabular-nums transition-colors",
                    activeVenue === venue ? "bg-row-hover text-text" : "text-text-faint hover:text-text"
                  )}
                  title={`Filter to ${VENUE_LABELS[venue] ?? venue}`}
                >
                  {VENUE_LABELS[venue] ?? venue} {formatUsd(pnl, { signed: true, compact: true })}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </header>
  );
}
