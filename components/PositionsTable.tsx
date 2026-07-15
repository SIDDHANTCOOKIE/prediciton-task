import clsx from "clsx";
import type { Position } from "@/lib/types";
import { TierChip } from "@/components/ScoreBadge";
import { VenueBadges } from "@/components/VenueBadge";
import { formatUsd } from "@/lib/format";

export function PositionsTable({ positions }: { positions: Position[] }) {
  if (positions.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 px-6 py-20 text-center">
        <span className="text-sm font-medium text-text">No open positions match these filters</span>
        <span className="text-xs text-text-faint">Try widening the min-size filter or clearing the side/tier filters.</span>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border-soft text-left text-xs text-text-faint">
            <th className="px-3 py-2.5 font-medium">Trader</th>
            <th className="min-w-[240px] px-3 py-2.5 font-medium">Market</th>
            <th className="px-3 py-2.5 font-medium">Side</th>
            <th className="px-3 py-2.5 font-medium">Size</th>
            <th className="px-3 py-2.5 font-medium">Avg / Cur</th>
            <th className="px-3 py-2.5 font-medium">Unrealized P&L</th>
            <th className="px-3 py-2.5 font-medium">Venue</th>
          </tr>
        </thead>
        <tbody>
          {positions.map((p, i) => (
            <tr key={`${p.wallet}-${p.conditionId}-${i}`} className="border-b border-border-soft transition-colors hover:bg-row-hover">
              <td className="px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-text">{p.trader}</span>
                  {p.traderTier && <TierChip tier={p.traderTier} />}
                </div>
              </td>
              <td className="max-w-[320px] truncate px-3 py-2.5 text-text-muted" title={p.marketTitle}>
                {p.marketTitle || "—"}
              </td>
              <td className="px-3 py-2.5">
                <span
                  className={clsx("rounded px-1.5 py-0.5 text-xs font-semibold")}
                  style={{
                    color: p.side === "YES" ? "var(--green)" : "var(--red)",
                    backgroundColor: p.side === "YES" ? "var(--green-soft)" : "var(--red-soft)",
                  }}
                >
                  {p.side}
                </span>
              </td>
              <td className="px-3 py-2.5 font-mono tabular-nums text-text">{p.size.toLocaleString()}</td>
              <td className="px-3 py-2.5 font-mono tabular-nums text-text-muted">
                {p.avgPrice.toFixed(2)} / {p.curPrice.toFixed(2)}
              </td>
              <td className="px-3 py-2.5 font-mono tabular-nums" style={{ color: p.unrealizedPnl >= 0 ? "var(--green)" : "var(--red)" }}>
                {formatUsd(p.unrealizedPnl, { signed: true, compact: true })}
              </td>
              <td className="px-3 py-2.5">
                <VenueBadges venue={p.venue} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
