// Best-effort Kalshi trader integration. Kalshi's documented public API
// (trade-api/v2) covers markets/orderbooks/trades only — there is no documented,
// stable per-trader P&L endpoint. Kalshi does run a public "social" profile page at
// kalshi.com/ideas/profiles/{username}, but its data contract isn't part of the
// stable API and this environment couldn't reach kalshi.com at all to inspect it
// (confirmed via DNS+TCP diagnostics, same as Polymarket).
//
// This module therefore only ever returns REAL parsed data or nothing — it does not
// guess/fabricate values. It looks for a strictly-typed embedded JSON payload (the
// common Next.js __NEXT_DATA__ pattern); if the expected fields aren't present with
// the right types, that trader is silently skipped rather than shown with wrong or
// invented numbers. Treat this as genuinely best-effort: it may return an empty list.

const FETCH_TIMEOUT_MS = 8_000;

// Publicly known Kalshi usernames (visible on predicting.top's own live board, which
// surfaces real Kalshi social profiles) — a seed list, since Kalshi has no discovery/
// leaderboard endpoint of its own to enumerate traders from.
export const KNOWN_KALSHI_USERNAMES = ["haon", "sorcere", "Coby", "goose"];

export type KalshiTraderSnapshot = {
  username: string;
  profileUrl: string;
  pnl: number;
  volume: number;
};

async function fetchHtml(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { accept: "text/html" } });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Extracts a strictly-typed trader snapshot from an embedded __NEXT_DATA__ blob, or null. */
function parseStrict(html: string, username: string, profileUrl: string): KalshiTraderSnapshot | null {
  const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (!match) return null;
  try {
    const root = JSON.parse(match[1]);
    // Walk a bounded set of plausible prop paths rather than a blind deep search —
    // we only accept a result if pnl/volume are both present as finite numbers.
    const candidates: unknown[] = [
      root?.props?.pageProps?.profile,
      root?.props?.pageProps?.trader,
      root?.props?.pageProps?.user,
      root?.props?.pageProps,
    ];
    for (const c of candidates) {
      if (!c || typeof c !== "object") continue;
      const obj = c as Record<string, unknown>;
      const pnl = obj.pnl ?? obj.totalPnl ?? obj.realizedPnl;
      const volume = obj.volume ?? obj.totalVolume ?? obj.vol;
      if (typeof pnl === "number" && Number.isFinite(pnl) && typeof volume === "number" && Number.isFinite(volume)) {
        return { username, profileUrl, pnl, volume };
      }
    }
    return null;
  } catch {
    return null;
  }
}

export async function fetchKnownKalshiTraders(usernames: string[] = KNOWN_KALSHI_USERNAMES): Promise<KalshiTraderSnapshot[]> {
  const results = await Promise.allSettled(
    usernames.map(async (username) => {
      const profileUrl = `https://kalshi.com/ideas/profiles/${username}`;
      const html = await fetchHtml(profileUrl);
      if (!html) return null;
      return parseStrict(html, username, profileUrl);
    })
  );
  return results
    .filter((r): r is PromiseFulfilledResult<KalshiTraderSnapshot | null> => r.status === "fulfilled")
    .map((r) => r.value)
    .filter((v): v is KalshiTraderSnapshot => v !== null);
}
