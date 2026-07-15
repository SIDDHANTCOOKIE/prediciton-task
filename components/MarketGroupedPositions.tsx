import type { Position } from "@/lib/types";
import { TierChip } from "@/components/ScoreBadge";

function SideColumn({ positions, side }: { positions: Position[]; side: "YES" | "NO" }) {
  const rows = positions
    .filter((p) => p.side === side)
    .sort((a, b) => (b.traderScore ?? 0) - (a.traderScore ?? 0));
  const totalSize = rows.reduce((sum, p) => sum + p.size, 0);
  const color = side === "YES" ? "var(--green)" : "var(--red)";

  return (
    <div className="flex-1">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold" style={{ color }}>
          {side} · {rows.length} trader{rows.length === 1 ? "" : "s"}
        </span>
        <span className="font-mono text-xs text-text-faint">{totalSize.toLocaleString()} shares</span>
      </div>
      <div className="flex flex-col gap-1.5">
        {rows.length === 0 && <span className="text-xs text-text-faint">No positions</span>}
        {rows.map((p, i) => (
          <div key={`${p.wallet}-${i}`} className="flex items-center justify-between rounded-lg border border-border-soft px-2.5 py-1.5">
            <span className="flex items-center gap-1.5 text-sm text-text">
              {p.trader}
              {p.traderTier && <TierChip tier={p.traderTier} />}
            </span>
            <span className="font-mono text-xs text-text-muted">{p.size.toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function MarketGroupedPositions({ positions }: { positions: Position[] }) {
  const groups = new Map<string, Position[]>();
  for (const p of positions) {
    const key = p.conditionId || p.marketTitle;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(p);
  }
  const sortedGroups = [...groups.entries()].sort(
    (a, b) => b[1].reduce((s, p) => s + p.size, 0) - a[1].reduce((s, p) => s + p.size, 0)
  );

  if (sortedGroups.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 px-6 py-20 text-center">
        <span className="text-sm font-medium text-text">No open positions match these filters</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col divide-y divide-border-soft">
      {sortedGroups.map(([key, group]) => (
        <div key={key} className="p-4">
          <div className="mb-3 text-sm font-medium text-text">{group[0].marketTitle || "Untitled market"}</div>
          <div className="flex flex-col gap-4 sm:flex-row sm:gap-6">
            <SideColumn positions={group} side="YES" />
            <SideColumn positions={group} side="NO" />
          </div>
        </div>
      ))}
    </div>
  );
}
