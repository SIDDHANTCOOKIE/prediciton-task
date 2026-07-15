import { NextResponse } from "next/server";
import { fetchLeaderboard, fetchPositions, PolymarketFetchError } from "@/lib/polymarket";
import { getLastKnownTraderMeta, withPositionsCache } from "@/lib/liveCache";
import type { Position } from "@/lib/types";

const WALLET_DEPTH = 40;
const CONCURRENCY = 5;

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

async function fetchLivePositions(): Promise<Position[]> {
  const entries = await fetchLeaderboard(WALLET_DEPTH);
  const perWallet = await mapWithConcurrency(entries, CONCURRENCY, async (entry) => {
    try {
      const raw = await fetchPositions(entry.wallet);
      const meta = getLastKnownTraderMeta(entry.wallet);
      return raw.map(
        (p): Position => ({
          trader: entry.userName,
          wallet: entry.wallet,
          venue: "polymarket",
          conditionId: p.conditionId,
          marketTitle: p.title,
          side: p.outcome.toUpperCase() === "NO" ? "NO" : "YES",
          size: p.size,
          avgPrice: p.avgPrice,
          curPrice: p.curPrice,
          currentValue: p.currentValue,
          unrealizedPnl: p.cashPnl,
          traderTier: meta?.tier,
          traderScore: meta?.score,
        })
      );
    } catch {
      return [] as Position[];
    }
  });
  return perWallet.flat();
}

export async function GET() {
  try {
    const { positions, updatedAt, stale } = await withPositionsCache(fetchLivePositions);
    return NextResponse.json({ updatedAt, stale, count: positions.length, positions });
  } catch (err) {
    const message = err instanceof PolymarketFetchError ? `Live data unavailable: ${err.message}` : "Live data unavailable: could not reach Polymarket.";
    return NextResponse.json({ error: message, updatedAt: null, count: 0, positions: [] }, { status: 502 });
  }
}
