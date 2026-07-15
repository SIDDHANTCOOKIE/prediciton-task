"use client";

import { useEffect } from "react";
import type { Trader } from "@/lib/types";
import { ScoreBadge, TierChip } from "@/components/ScoreBadge";
import { ScoreBreakdownPanel } from "@/components/ScoreBreakdownPanel";
import { Sparkline } from "@/components/Sparkline";
import { formatUsd, formatPercent } from "@/lib/format";

export function CompareDrawer({ traders, onClose }: { traders: Trader[]; onClose: () => void }) {
  useEffect(() => {
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onEsc);
    return () => document.removeEventListener("keydown", onEsc);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="animate-fade-in-up flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-border bg-bg-elevated shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border-soft px-5 py-4">
          <h2 className="text-lg font-semibold text-text">Compare traders</h2>
          <button onClick={onClose} className="text-text-faint transition-colors hover:text-text">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="grid flex-1 grid-cols-1 gap-0 divide-y divide-border-soft overflow-y-auto sm:grid-cols-[repeat(auto-fit,minmax(280px,1fr))] sm:divide-x sm:divide-y-0">
          {traders.map((t) => (
            <div key={t.name} className="flex flex-col gap-3 p-4">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-text">{t.name}</span>
                <ScoreBadge score={t.smart_score.score} tier={t.smart_score.tier} />
              </div>
              <TierChip tier={t.smart_score.tier} />
              <Sparkline data={t.equity_curve} width={220} height={40} />
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <div className="text-text-faint">P&L</div>
                  <div className="font-mono font-medium text-text">{formatUsd(t.stats.pnl, { signed: true, compact: true })}</div>
                </div>
                <div>
                  <div className="text-text-faint">Win rate</div>
                  <div className="font-mono font-medium text-text">{formatPercent(t.smart_score.winRate, 0)}</div>
                </div>
              </div>
              <ScoreBreakdownPanel smartScore={t.smart_score} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
