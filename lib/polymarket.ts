// Live Polymarket integration. This module was written and network-tested against
// documented schemas from prior research, but this dev environment could not reach
// data-api.polymarket.com at all (confirmed via DNS+TCP diagnostics — every Polymarket
// and Kalshi host times out from this sandbox while control hosts succeed). Field access
// below is defensive/tolerant on purpose: real API responses are read with fallback key
// names and Number.isFinite guards so a minor schema drift skips a bad record instead of
// crashing the whole ingest. Verify the exact shape against the live endpoint the first
// time this runs somewhere with real network access, and tighten the parsing then.

import type { DailyReturn } from "./metrics";

const DATA_API = "https://data-api.polymarket.com";
const GAMMA_API = "https://gamma-api.polymarket.com";
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
    for (const key of ["data", "results", "leaderboard", "traders", "trades", "positions"]) {
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

export type RawTrade = {
  side: "BUY" | "SELL" | "UNKNOWN";
  size: number;
  price: number;
  timestampMs: number;
  conditionId: string;
  title: string;
};

export async function fetchTrades(wallet: string, limit = 500): Promise<RawTrade[]> {
  const url = `${DATA_API}/trades?user=${wallet}&limit=${limit}`;
  const json = await fetchJson(url);
  const rows = unwrapList(json);
  return rows
    .map((row): RawTrade | null => {
      const size = num(row.size ?? row.amount ?? row.shares, NaN);
      const price = num(row.price ?? row.avgPrice, NaN);
      const tsRaw = row.timestamp ?? row.time ?? row.date ?? row.createdAt;
      const tsNum = typeof tsRaw === "string" ? Date.parse(tsRaw) : num(tsRaw, NaN);
      // Polymarket timestamps are commonly unix seconds; promote to ms if they look like seconds.
      const timestampMs = Number.isFinite(tsNum) ? (tsNum < 2_000_000_000 ? tsNum * 1000 : tsNum) : NaN;
      if (!Number.isFinite(size) || !Number.isFinite(price) || !Number.isFinite(timestampMs)) return null;
      const sideRaw = str(row.side).toUpperCase();
      return {
        side: sideRaw === "BUY" || sideRaw === "SELL" ? (sideRaw as "BUY" | "SELL") : "UNKNOWN",
        size,
        price,
        timestampMs,
        conditionId: str(row.conditionId ?? row.market ?? row.asset),
        title: str(row.title ?? row.question),
      };
    })
    .filter((t): t is RawTrade => t !== null);
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

/**
 * Buckets real trades into a daily net-cash-flow series and scales it into a fractional
 * "return" series suitable for lib/metrics.ts. This is a deliberate approximation, not
 * exact realized-P&L accounting (that would require replicating Polymarket's own FIFO
 * cost-basis engine per market) — see file header / plan Part 5 for the reasoning. The
 * authoritative pnl/vol numbers shown to users always come straight from the official
 * leaderboard, never from this derived series.
 */
export function dailySeriesFromTrades(trades: RawTrade[]): DailyReturn[] {
  if (trades.length === 0) return [];
  const byDay = new Map<string, number>();
  let totalVolume = 0;
  for (const t of trades) {
    const date = new Date(t.timestampMs).toISOString().slice(0, 10);
    const notional = t.size * t.price;
    const signed = t.side === "SELL" ? notional : t.side === "BUY" ? -notional : 0;
    byDay.set(date, (byDay.get(date) ?? 0) + signed);
    totalVolume += notional;
  }
  const days = [...byDay.keys()].sort();
  const spanDays = Math.max(1, days.length);
  const avgDailyVolume = Math.max(totalVolume / spanDays, 1);

  return days.map((date) => {
    const pnl = byDay.get(date)!;
    return { date, pnl, returnPct: pnl / avgDailyVolume };
  });
}

/** Dominant market category for a wallet by traded volume, via gamma-api condition metadata. Best-effort. */
export async function resolveDominantCategory(trades: RawTrade[]): Promise<string | undefined> {
  const uniqueConditionIds = [...new Set(trades.map((t) => t.conditionId).filter(Boolean))].slice(0, 20);
  if (uniqueConditionIds.length === 0) return undefined;
  try {
    const volumeByCategory = new Map<string, number>();
    const notionalByCondition = new Map<string, number>();
    for (const t of trades) {
      notionalByCondition.set(t.conditionId, (notionalByCondition.get(t.conditionId) ?? 0) + t.size * t.price);
    }
    const results = await Promise.allSettled(
      uniqueConditionIds.map((id) => fetchJson(`${GAMMA_API}/markets?condition_ids=${id}`))
    );
    results.forEach((r, i) => {
      if (r.status !== "fulfilled") return;
      const rows = unwrapList(r.value);
      const category = str(rows[0]?.category ?? rows[0]?.tag);
      if (!category) return;
      const conditionId = uniqueConditionIds[i];
      const vol = notionalByCondition.get(conditionId) ?? 0;
      volumeByCategory.set(category, (volumeByCategory.get(category) ?? 0) + vol);
    });
    let best: string | undefined;
    let bestVol = -1;
    for (const [cat, vol] of volumeByCategory) {
      if (vol > bestVol) {
        best = cat;
        bestVol = vol;
      }
    }
    return best;
  } catch {
    return undefined;
  }
}
