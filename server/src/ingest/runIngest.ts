import { ingestPolymarket } from "./polymarket";
import { ingestKalshi } from "./kalshi";
import { insertSnapshot, upsertTraders, recordRankHistory } from "../db/queries";
import { Trader, Position, Period } from "../../../lib/types";

const PERIODS: Period[] = ["1D", "1W", "1M", "ALL"];

export type IngestResult = {
  status: "ok";
  results: {
    polymarket: "success" | "failed";
    polymarket_count: number; // ALL-period count
    kalshi: "success" | "failed";
    kalshi_count: number;
  };
};

// Single-flighted: the internal cron, an external keep-alive pinger, a boot-time refresh, and a
// manual POST /ingest can all land within the same window. Without this they'd stack concurrent
// ingests on Render free's 0.1 CPU / 512 MB, which is exactly what starves the box out from under
// itself. Every caller in this window shares one in-flight run instead.
let inFlight: Promise<IngestResult> | null = null;

export function runIngest(): Promise<IngestResult> {
  if (!inFlight) {
    inFlight = doIngest().finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}

function score(t: Trader): number {
  return t.smart_score?.score ?? -Infinity;
}

async function doIngest(): Promise<IngestResult> {
  console.log("Starting ingestion...");

  const results = await Promise.allSettled([ingestPolymarket(), ingestKalshi()]);

  const polyResult = results[0];
  const kalshiResult = results[1];

  let polyCount = 0;
  let kalshiCount = 0;
  let kalshiTraders: Trader[] = [];

  if (polyResult.status === "fulfilled") {
    const { byPeriod, positions } = polyResult.value;
    // One snapshot per period (server/src/routes/leaderboard.ts reads `polymarket:<period>`),
    // rather than the single "polymarket" key from before — that's what makes the Period pills
    // switch to a genuinely different, correct dataset instead of client-side-filtering one
    // fixed all-time fetch.
    for (const period of PERIODS) {
      await insertSnapshot(`polymarket:${period}`, byPeriod[period] ?? []);
    }
    polyCount = byPeriod.ALL.length;
    await upsertTraders("polymarket", byPeriod.ALL);
    // Positions feed for app/api/positions — reuses the snapshots table under a distinct key
    // rather than a live per-request fetch from Vercel (see server/src/db/queries.ts).
    await insertSnapshot<Position>("polymarket_positions", positions);
  } else {
    console.error("Polymarket ingest failed:", polyResult.reason);
  }

  if (kalshiResult.status === "fulfilled") {
    kalshiTraders = kalshiResult.value;
    kalshiCount = kalshiTraders.length;
    await insertSnapshot("kalshi", kalshiTraders);
    await upsertTraders("kalshi", kalshiTraders);
  } else {
    console.error("Kalshi ingest failed:", kalshiResult.reason);
  }

  // Rank history is recorded against the ALL period only — the one view that combines both
  // venues and the one server/src/routes/leaderboard.ts's previousScoreRank compares against for
  // every period (a 1D-specific rank-delta isn't meaningful across snapshots the way ALL's is).
  if (polyResult.status === "fulfilled") {
    const allTraders = [...polyResult.value.byPeriod.ALL, ...kalshiTraders];
    allTraders.sort((a, b) => {
      const diff = score(b) - score(a);
      return diff !== 0 ? diff : b.stats.pnl - a.stats.pnl;
    });
    allTraders.forEach((t, i) => {
      t.rank = i + 1;
    });
    await recordRankHistory(allTraders);
  }

  return {
    status: "ok",
    results: {
      polymarket: polyResult.status === "fulfilled" ? "success" : "failed",
      polymarket_count: polyCount,
      kalshi: kalshiResult.status === "fulfilled" ? "success" : "failed",
      kalshi_count: kalshiCount,
    },
  };
}
