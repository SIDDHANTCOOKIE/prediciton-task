import { NextResponse } from "next/server";
import { assignPercentiles } from "@/lib/metrics";
import { fetchUpstreamLeaderboard, UpstreamFetchError } from "@/lib/predictingTop";
import { withLiveCache } from "@/lib/liveCache";

export async function GET() {
  try {
    const { traders, updatedAt, stale } = await withLiveCache(fetchUpstreamLeaderboard);
    return NextResponse.json({
      updatedAt,
      stale,
      count: traders.length,
      traders: assignPercentiles(traders),
    });
  } catch (err) {
    const message =
      err instanceof UpstreamFetchError ? `Live data unavailable: ${err.message}` : "Live data unavailable: could not reach the leaderboard source.";
    return NextResponse.json({ error: message, updatedAt: null, count: 0, traders: [] }, { status: 502 });
  }
}
