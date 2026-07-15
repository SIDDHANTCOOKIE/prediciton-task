import clsx from "clsx";
import type { SmartScore } from "@/lib/metrics";

const TIER_STYLE: Record<SmartScore["tier"], { fg: string; bg: string }> = {
  Elite: { fg: "var(--green)", bg: "var(--green-soft)" },
  Great: { fg: "var(--green)", bg: "var(--green-soft)" },
  Good: { fg: "var(--green)", bg: "var(--green-soft)" },
  Average: { fg: "var(--orange)", bg: "var(--orange-soft)" },
  Risky: { fg: "var(--red)", bg: "var(--red-soft)" },
};

export function ScoreBadge({ score, tier, size = "md" }: { score: number; tier: SmartScore["tier"]; size?: "sm" | "md" }) {
  const style = TIER_STYLE[tier];
  return (
    <span
      className={clsx(
        "inline-flex items-center justify-center rounded-md font-mono font-semibold tabular-nums",
        size === "md" ? "px-2 py-1 text-sm" : "px-1.5 py-0.5 text-xs"
      )}
      style={{ color: style.fg, backgroundColor: style.bg }}
      title={tier}
    >
      {score.toFixed(1)}
    </span>
  );
}

export function TierChip({ tier }: { tier: SmartScore["tier"] }) {
  const style = TIER_STYLE[tier];
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
      style={{ color: style.fg, backgroundColor: style.bg }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: style.fg }} />
      {tier}
    </span>
  );
}
