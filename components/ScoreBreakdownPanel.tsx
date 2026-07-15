import type { SmartScore } from "@/lib/metrics";
import { formatPercent, formatRatio } from "@/lib/format";

const ROWS: Array<{ key: keyof SmartScore["scoreBreakdown"]; label: string; weight: string; detail: (s: SmartScore) => string }> = [
  { key: "rSquaredScore", label: "Consistency", weight: "25%", detail: (s) => `R² ${formatRatio(s.rSquared, 3)}` },
  { key: "sortinoScore", label: "Returns", weight: "25%", detail: (s) => `Sortino ${formatRatio(s.sortinoRatio)}` },
  { key: "winRateScore", label: "Win rate", weight: "20%", detail: (s) => formatPercent(s.winRate) },
  { key: "maxDrawdownScore", label: "Max loss", weight: "15%", detail: (s) => `-${formatPercent(s.maxDrawdownPercent)} DD` },
  { key: "profitFactorScore", label: "Profit factor", weight: "15%", detail: (s) => formatRatio(s.profitFactor) },
];

export function ScoreBreakdownPanel({ smartScore }: { smartScore: SmartScore }) {
  return (
    <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 lg:grid-cols-5">
      {ROWS.map((row) => {
        const value = smartScore.scoreBreakdown[row.key];
        return (
          <div key={row.key} className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between">
              <span className="text-xs font-medium text-text-muted">
                {row.label} <span className="text-text-faint">· {row.weight}</span>
              </span>
              <span className="font-mono text-xs tabular-nums text-text">{value.toFixed(1)}</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-border-soft">
              <div
                className="h-full rounded-full transition-[width]"
                style={{
                  width: `${Math.max(2, Math.min(100, value))}%`,
                  backgroundColor: value >= 55 ? "var(--green)" : value >= 35 ? "var(--orange)" : "var(--red)",
                }}
              />
            </div>
            <span className="font-mono text-[11px] text-text-faint">{row.detail(smartScore)}</span>
          </div>
        );
      })}
      <div className="col-span-full flex flex-wrap gap-x-6 gap-y-1 border-t border-border-soft pt-3 text-[11px] text-text-faint">
        <span>Sharpe {formatRatio(smartScore.sharpeRatio)}</span>
        <span>Calmar {formatRatio(smartScore.calmarRatio)}</span>
        <span>Best day {formatPercent(smartScore.bestDay)}</span>
        <span>Worst day {formatPercent(smartScore.worstDay)}</span>
        <span>Win streak {smartScore.longestWinStreak}</span>
        <span>Lose streak {smartScore.longestLoseStreak}</span>
        <span>{smartScore.dataPoints} days tracked</span>
      </div>
    </div>
  );
}
