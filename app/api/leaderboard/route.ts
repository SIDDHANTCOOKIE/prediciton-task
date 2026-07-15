import { NextResponse } from "next/server";
import { computeSmartScore, assignPercentiles } from "@/lib/metrics";
import {
  fetchLeaderboard,
  fetchTrades,
  dailySeriesFromTrades,
  resolveDominantCategory,
  PolymarketFetchError,
} from "@/lib/polymarket";
import { fetchKnownKalshiTraders } from "@/lib/kalshi";
import { withLiveCache } from "@/lib/liveCache";
import type { Trader } from "@/lib/types";

const WALLET_DEPTH = 40;
const CONCURRENCY = 5;

/** Runs `fn` over `items` with at most `limit` in flight at once. */
async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const i = cursor++;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

async function buildPolymarketTraders(): Promise<Trader[]> {
  const entries = await fetchLeaderboard(WALLET_DEPTH);
  const calculatedAt = new Date().toISOString();

  const traders = await mapWithConcurrency(entries, CONCURRENCY, async (entry): Promise<Trader> => {
    let smartScore = computeSmartScore([], calculatedAt);
    let equityCurve: number[] = [];
    let dominantCategory: string | undefined;

    try {
      const trades = await fetchTrades(entry.wallet);
      const series = dailySeriesFromTrades(trades);
      smartScore = computeSmartScore(series, calculatedAt);
      let cum = 0;
      equityCurve = series.slice(-60).map((d) => (cum += d.pnl));
      dominantCategory = await resolveDominantCategory(trades);
    } catch {
      // This wallet's trade history couldn't be hydrated — it still appears with its
      // real rank/pnl/vol from the official leaderboard, just with an empty score
      // (dataPoints: 0), which the existing sample-size guard rail excludes from
      // ratio-based sorts by default. No fabricated numbers.
    }

    return {
      rank: entry.rank,
      name: entry.userName,
      wallet: entry.wallet,
      additional_wallets: [],
      wallet_count: 1,
      twitter: entry.xUsername ? `https://x.com/${entry.xUsername}` : "",
      pfp: entry.profileImage,
      platform: "polymarket",
      polymarket_profile: `https://polymarket.com/@${entry.userName}`,
      kalshi_profile: "",
      kalshi_username: "",
      myriad_profile: "",
      opinion_wallet: null,
      opinion_profile: "",
      join_date: "",
      views: 0,
      largest_win: "",
      affiliated: entry.verifiedBadge,
      stats: { pnl: entry.pnl, vol: entry.vol, buys: 0, sells: 0 },
      smart_score: smartScore,
      equity_curve: equityCurve,
      dominantCategory,
    };
  });

  return traders;
}

async function buildKalshiTraders(): Promise<Trader[]> {
  const snapshots = await fetchKnownKalshiTraders();
  const calculatedAt = new Date().toISOString();
  return snapshots.map((s) => ({
    rank: 0,
    name: s.username,
    wallet: null,
    additional_wallets: [],
    wallet_count: 1,
    twitter: "",
    pfp: "",
    platform: "kalshi",
    polymarket_profile: "",
    kalshi_profile: s.profileUrl,
    kalshi_username: s.username,
    myriad_profile: "",
    opinion_wallet: null,
    opinion_profile: "",
    join_date: "",
    views: 0,
    largest_win: "",
    affiliated: false,
    stats: { pnl: s.pnl, vol: s.volume, buys: 0, sells: 0 },
    // No real trade-level history is available from Kalshi's public surface, so this
    // is honestly an empty-series score (dataPoints: 0) — real identity/pnl, but the
    // guard rail correctly excludes it from ratio sorts until real granularity exists.
    smart_score: computeSmartScore([], calculatedAt),
    equity_curve: [],
  }));
}

async function fetchLiveTraders(): Promise<Trader[]> {
  const [polymarket, kalshi] = await Promise.all([
    buildPolymarketTraders(),
    buildKalshiTraders().catch(() => [] as Trader[]),
  ]);
  const merged = [...polymarket, ...kalshi].sort((a, b) => b.stats.pnl - a.stats.pnl);
  merged.forEach((t, i) => {
    t.rank = i + 1;
  });
  return merged;
}

export async function GET() {
  try {
    const { traders, updatedAt, stale } = await withLiveCache(fetchLiveTraders);
    return NextResponse.json({
      updatedAt,
      stale,
      count: traders.length,
      traders: assignPercentiles(traders),
    });
  } catch (err) {
    const message =
      err instanceof PolymarketFetchError
        ? `Live data unavailable: ${err.message}`
        : "Live data unavailable: could not reach Polymarket.";
    return NextResponse.json({ error: message, updatedAt: null, count: 0, traders: [] }, { status: 502 });
  }
}
