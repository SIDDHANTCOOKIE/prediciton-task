// Direct Polymarket integration — used only by the Positions page (app/api/positions),
// which has no equivalent on the predicting.top upstream (see lib/predictingTop.ts, the
// primary leaderboard data source). This module talks to Polymarket's public data-api
// directly, so it inherits that dependency's availability: it works wherever Polymarket
// itself is reachable, and fails honestly (PolymarketFetchError, no fabricated data) where
// it's blocked (e.g. ISP-level blocks in some jurisdictions).

const DATA_API = "https://data-api.polymarket.com";
const FETCH_TIMEOUT_MS = 10_000;

export class PolymarketFetchError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "PolymarketFetchError";
  }
}

async function fetchJson(url: string): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { accept: "application/json" } });
    if (!res.ok) {
      throw new PolymarketFetchError(`${url} -> HTTP ${res.status}`);
    }
    return await res.json();
  } catch (err) {
    if (err instanceof PolymarketFetchError) throw err;
    throw new PolymarketFetchError(`Failed to reach ${url}`, err);
  } finally {
    clearTimeout(timer);
  }
}

/** Unwraps common list-response envelopes: a raw array, or {data:[...]}/{results:[...]}/{leaderboard:[...]}. */
function unwrapList(json: unknown): Record<string, unknown>[] {
  if (Array.isArray(json)) return json as Record<string, unknown>[];
  if (json && typeof json === "object") {
    for (const key of ["data", "results", "leaderboard", "traders", "positions"]) {
      const v = (json as Record<string, unknown>)[key];
      if (Array.isArray(v)) return v as Record<string, unknown>[];
    }
  }
  return [];
}

function num(v: unknown, fallback = 0): number {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : fallback;
}

function str(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

export type LeaderboardEntry = {
  rank: number;
  wallet: string;
  userName: string;
  vol: number;
  pnl: number;
  profileImage: string;
  xUsername: string;
  verifiedBadge: boolean;
};

export async function fetchLeaderboard(limit: number): Promise<LeaderboardEntry[]> {
  const url = `${DATA_API}/v1/leaderboard?category=OVERALL&timePeriod=ALL&orderBy=PNL&limit=${limit}`;
  const json = await fetchJson(url);
  const rows = unwrapList(json);
  return rows
    .map((row, i) => ({
      rank: num(row.rank, i + 1),
      wallet: str(row.proxyWallet ?? row.wallet ?? row.address),
      userName: str(row.userName ?? row.name ?? row.username, str(row.proxyWallet).slice(0, 8)),
      vol: num(row.vol ?? row.volume),
      pnl: num(row.pnl),
      profileImage: str(row.profileImage ?? row.pfp),
      xUsername: str(row.xUsername ?? row.twitter),
      verifiedBadge: Boolean(row.verifiedBadge ?? row.verified),
    }))
    .filter((r) => r.wallet.length > 0);
}

export type RawPosition = {
  conditionId: string;
  title: string;
  outcome: string;
  size: number;
  avgPrice: number;
  curPrice: number;
  currentValue: number;
  cashPnl: number;
};

export async function fetchPositions(wallet: string): Promise<RawPosition[]> {
  const url = `${DATA_API}/positions?user=${wallet}`;
  const json = await fetchJson(url);
  const rows = unwrapList(json);
  return rows
    .map((row): RawPosition | null => {
      const size = num(row.size ?? row.shares, NaN);
      if (!Number.isFinite(size) || size === 0) return null;
      const avgPrice = num(row.avgPrice ?? row.averagePrice);
      const curPrice = num(row.curPrice ?? row.currentPrice ?? avgPrice);
      return {
        conditionId: str(row.conditionId ?? row.asset ?? row.market),
        title: str(row.title ?? row.question),
        outcome: str(row.outcome, "YES"),
        size,
        avgPrice,
        curPrice,
        currentValue: num(row.currentValue, size * curPrice),
        cashPnl: num(row.cashPnl ?? row.pnl, size * (curPrice - avgPrice)),
      };
    })
    .filter((p): p is RawPosition => p !== null);
}
