import type { Position, Trader } from "./types";

const TTL_MS = 5 * 60 * 1000; // 5 minutes — bounds how often we re-hit rate-limited third-party APIs

type Snapshot = {
  traders: Trader[];
  updatedAt: string;
  scoreRankByWallet: Map<string, number>;
};

// Single-process in-memory cache — deliberately not Redis. At ~40-100 rows this is a
// trivial amount of state; see the plan's Part 3D note on right-sizing.
let current: Snapshot | null = null;
let previous: Snapshot | null = null;
let inFlight: Promise<Trader[]> | null = null;

function scoreRankOf(traders: Trader[]): Map<string, number> {
  const sorted = [...traders].sort((a, b) => b.smart_score.score - a.smart_score.score);
  const map = new Map<string, number>();
  sorted.forEach((t, i) => map.set(t.wallet ?? t.name, i + 1));
  return map;
}

export function getCachedSnapshot(): Snapshot | null {
  if (!current) return null;
  const age = Date.now() - new Date(current.updatedAt).getTime();
  return age <= TTL_MS ? current : null;
}

/** Best-effort tier/score lookup from the most recent leaderboard snapshot, any age — used to
 *  label positions with their trader's tier without recomputing scores in the positions route. */
export function getLastKnownTraderMeta(wallet: string): { tier: Trader["smart_score"]["tier"]; score: number } | null {
  const t = (current ?? previous)?.traders.find((x) => x.wallet === wallet);
  return t ? { tier: t.smart_score.tier, score: t.smart_score.score } : null;
}

/** Returns fresh data if the cache is stale, deduping concurrent requests behind one in-flight fetch. */
export async function withLiveCache(fetcher: () => Promise<Trader[]>): Promise<{ traders: Trader[]; updatedAt: string; stale: boolean }> {
  const fresh = getCachedSnapshot();
  if (fresh) return { traders: fresh.traders, updatedAt: fresh.updatedAt, stale: false };

  if (!inFlight) {
    inFlight = fetcher().finally(() => {
      inFlight = null;
    });
  }

  try {
    const traders = await inFlight;
    const rankMap = scoreRankOf(traders);
    const withPrevRank = traders.map((t) => {
      const prevRank = previous?.scoreRankByWallet.get(t.wallet ?? t.name);
      return prevRank !== undefined ? { ...t, previousScoreRank: prevRank } : t;
    });
    previous = current;
    current = { traders: withPrevRank, updatedAt: new Date().toISOString(), scoreRankByWallet: rankMap };
    return { traders: withPrevRank, updatedAt: current.updatedAt, stale: false };
  } catch (err) {
    // Live fetch failed — serve the last good snapshot if we have one, however stale,
    // rather than a hard error. If we've never had one, the caller must handle the throw.
    if (current) return { traders: current.traders, updatedAt: current.updatedAt, stale: true };
    throw err;
  }
}

// Separate cache instance for the positions feed — same TTL/fallback shape as the
// leaderboard cache above, kept as its own pair of module-level variables rather than
// a generic factory since there are only two concrete uses.
let positionsCurrent: { positions: Position[]; updatedAt: string } | null = null;
let positionsInFlight: Promise<Position[]> | null = null;

export async function withPositionsCache(fetcher: () => Promise<Position[]>): Promise<{ positions: Position[]; updatedAt: string; stale: boolean }> {
  if (positionsCurrent && Date.now() - new Date(positionsCurrent.updatedAt).getTime() <= TTL_MS) {
    return { ...positionsCurrent, stale: false };
  }
  if (!positionsInFlight) {
    positionsInFlight = fetcher().finally(() => {
      positionsInFlight = null;
    });
  }
  try {
    const positions = await positionsInFlight;
    positionsCurrent = { positions, updatedAt: new Date().toISOString() };
    return { ...positionsCurrent, stale: false };
  } catch (err) {
    if (positionsCurrent) return { ...positionsCurrent, stale: true };
    throw err;
  }
}
