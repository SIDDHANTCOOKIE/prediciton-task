import clsx from "clsx";
import type { Venue } from "@/lib/types";
import { PolymarketIcon, KalshiIcon } from "@/components/icons/VenueIcons";

// Real brand colors: Kalshi's confirmed from their own logo SVG fill (#21c891); Polymarket's
// confirmed from polymarket.com/brand's own page CSS (#1652f0). Myriad/Opinion have no ingester
// yet (see lib/types.ts's Venue union) so keep a plain initial — nothing to source a real mark
// for until those venues are actually wired up.
const VENUE_META: Record<Exclude<Venue, "both">, { label: string; abbr: string; color: string; Icon?: (p: { className?: string; size?: number }) => React.ReactElement }> = {
  polymarket: { label: "Polymarket", abbr: "P", color: "#1652f0", Icon: PolymarketIcon },
  kalshi: { label: "Kalshi", abbr: "K", color: "#21c891", Icon: KalshiIcon },
  myriad: { label: "Myriad", abbr: "M", color: "#f97316" },
  opinion: { label: "Opinion", abbr: "O", color: "#ec4899" },
};

function Dot({ v, size = "sm" }: { v: Exclude<Venue, "both">; size?: "sm" | "xs" }) {
  const m = VENUE_META[v];
  const iconSize = size === "sm" ? 11 : 9;
  return (
    <span
      title={m.label}
      className={clsx(
        "inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white",
        size === "sm" ? "h-5 w-5 text-[10px]" : "h-4 w-4 text-[9px]"
      )}
      style={{ backgroundColor: m.color }}
    >
      {m.Icon ? <m.Icon size={iconSize} /> : m.abbr}
    </span>
  );
}

export function VenueBadges({ venue, size = "sm" }: { venue: Venue; size?: "sm" | "xs" }) {
  if (venue === "both") {
    return (
      <span className="inline-flex items-center -space-x-1.5">
        <Dot v="polymarket" size={size} />
        <Dot v="kalshi" size={size} />
      </span>
    );
  }
  return <Dot v={venue} size={size} />;
}

export const VENUE_OPTIONS: { value: Venue | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "polymarket", label: "Polymarket" },
  { value: "kalshi", label: "Kalshi" },
  { value: "myriad", label: "Myriad" },
  { value: "opinion", label: "Opinion" },
  { value: "both", label: "Multi-venue" },
];
