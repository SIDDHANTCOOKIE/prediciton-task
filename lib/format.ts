export function formatUsd(n: number, opts: { signed?: boolean; compact?: boolean } = {}): string {
  const { signed = false, compact = false } = opts;
  const abs = Math.abs(n);
  const formatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: compact ? 1 : 0,
    notation: compact && abs >= 1000 ? "compact" : "standard",
  });
  const sign = signed ? (n > 0 ? "+" : n < 0 ? "-" : "") : n < 0 ? "-" : "";
  return `${sign}${formatter.format(abs)}`;
}

export function formatPercent(fraction: number, digits = 1): string {
  return `${(fraction * 100).toFixed(digits)}%`;
}

export function formatSignedPercent(fraction: number, digits = 1): string {
  const sign = fraction > 0 ? "+" : "";
  return `${sign}${(fraction * 100).toFixed(digits)}%`;
}

export function formatCompactNumber(n: number): string {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

export function formatRatio(n: number, digits = 2): string {
  return n.toFixed(digits);
}

export function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function shortAddress(addr: string): string {
  if (addr.length < 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

/** External profile URL on the trader's origin platform, when resolvable — used to make trader
 *  rows clickable through to their real Polymarket/Kalshi profile.
 *  Polymarket's `polymarket.com/profile/{wallet}` scheme is well-established/public.
 *  Kalshi has no documented public profile page (same "no official API" situation as its
 *  leaderboard — see server/README.md); `/social/profile/{nickname}` mirrors the ingester's own
 *  API path (server/src/ingest/kalshi.ts's `/v1/social/profile?nickname=`) as the closest
 *  reasonable guess at the real page, not a confirmed URL — verify before treating it as certain. */
export function traderProfileUrl(t: { wallet?: string | null; kalshi_username?: string | null }): string | null {
  if (t.wallet) return `https://polymarket.com/profile/${t.wallet}`;
  if (t.kalshi_username) return `https://kalshi.com/social/profile/${t.kalshi_username}`;
  return null;
}
