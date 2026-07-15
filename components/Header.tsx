"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { formatUsd, timeAgo } from "@/lib/format";

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

export function Header({
  updatedAt,
  todayPnl,
  hasError = false,
}: {
  updatedAt: string | null;
  todayPnl: number | null;
  hasError?: boolean;
}) {
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
      <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2">
        <div>
          <div className="text-xs text-text-faint">Today</div>
          <div
            className="font-mono text-lg font-semibold tabular-nums"
            style={todayPnl !== null ? { color: todayPnl >= 0 ? "var(--green)" : "var(--red)" } : { color: "var(--text-faint)" }}
          >
            {todayPnl !== null ? formatUsd(todayPnl, { signed: true, compact: true }) : "—"}
          </div>
        </div>
        <div className="h-8 w-px bg-border-soft" />
        <div className="text-xs text-text-faint">
          {updatedAt ? `P&L updated ${timeAgo(updatedAt)}` : hasError ? "Unavailable" : "Loading…"}
        </div>
      </div>
    </header>
  );
}
