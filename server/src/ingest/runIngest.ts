import { ingestPolymarket } from "./polymarket";
import { ingestKalshi } from "./kalshi";
import { insertSnapshot, upsertTraders, recordRankHistory } from "../db/queries";
import { Trader, Position } from "../../../lib/types";

export type IngestResult = {
  status: "ok";
  results: {
    polymarket: "success" | "failed";
    polymarket_count: number;
    kalshi: "success" | "failed";
    kalshi_count: number;
  };
};

// Single-flighted: the internal cron, an external keep-alive pinger, a boot-time refresh, and a
// manual POST /ingest can all land within the same window. Without this they'd stack concurrent
// 40+-wallet ingests on Render free's 0.1 CPU / 512 MB, which is exactly what starves the box out
// from under itself. Every caller in this window shares one in-flight run instead.
let inFlight: Promise<IngestResult> | null = null;

export function runIngest(): Promise<IngestResult> {
  if (!inFlight) {
    inFlight = doIngest().finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}

async function doIngest(): Promise<IngestResult> {
  console.log("Starting ingestion...");

  const results = await Promise.allSettled([ingestPolymarket(), ingestKalshi()]);

  const polyResult = results[0];
  const kalshiResult = results[1];

  let polyCount = 0;
  let kalshiCount = 0;
  let polyTraders: Trader[] = [];
  let kalshiTraders: Trader[] = [];

  if (polyResult.status === "fulfilled") {
    polyTraders = polyResult.value.traders;
    polyCount = polyTraders.length;
    await insertSnapshot("polymarket", polyTraders);
    await upsertTraders("polymarket", polyTraders);
    // Positions feed for app/api/positions — reuses the snapshots table under a distinct key
    // rather than a live per-request fetch from Vercel (see server/src/db/queries.ts).
    await insertSnapshot<Position>("polymarket_positions", polyResult.value.positions);
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

  // Re-sort the combined result before recording rank history.
  const allTraders = [...polyTraders, ...kalshiTraders];

  allTraders.sort((a, b) => {
    if (b.smart_score.score !== a.smart_score.score) {
      return b.smart_score.score - a.smart_score.score;
    }
    return b.stats.pnl - a.stats.pnl;
  });

  allTraders.forEach((t, i) => {
    t.rank = i + 1;
  });

  await recordRankHistory(allTraders);

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
