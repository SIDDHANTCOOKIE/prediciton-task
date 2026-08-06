import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import cron from "node-cron";

import { runSchema, getLatestSnapshot } from "./db/queries";
import { runIngest } from "./ingest/runIngest";
import healthRoutes from "./routes/health";
import ingestRoutes from "./routes/ingest";
import leaderboardRoutes from "./routes/leaderboard";
import positionsRoutes from "./routes/positions";

const fastify = Fastify({ logger: true });

// Same threshold the read routes use to flag a served snapshot `stale` — see
// server/src/routes/leaderboard.ts and server/src/routes/positions.ts.
const FRESHNESS_TTL_MS = 15 * 60 * 1000;

async function build() {
  await fastify.register(cors, {
    origin: process.env.FRONTEND_ORIGIN || "*",
  });

  fastify.register(healthRoutes);
  fastify.register(ingestRoutes);
  fastify.register(leaderboardRoutes);
  fastify.register(positionsRoutes);

  // Secondary awake-time refresher (every 10 minutes) — calls runIngest() directly rather than
  // looping back through HTTP: a self-fetch to localhost added a wrong-PORT failure mode and a
  // pointless token round-trip for zero benefit, and runIngest() is already single-flighted so
  // this can't stack with a concurrent /ingest call.
  cron.schedule("*/10 * * * *", async () => {
    console.log("[cron] Triggering internal ingest schedule");
    try {
      await runIngest();
    } catch (e) {
      console.error("[cron] Ingest run failed", e);
    }
  });

  return fastify;
}

/** Render's free tier sleeps after ~15 min idle, and the in-process cron above only fires while
 *  awake — so a cold-started instance would otherwise keep serving whatever snapshot happened to
 *  be in Postgres from before it slept, forever. This makes a fresh boot self-heal: if the newest
 *  snapshot is already stale, kick off a background ingest without blocking startup (a full
 *  ingest takes minutes; the health check and read routes must come up immediately regardless).
 */
async function maybeBootIngest() {
  try {
    const latest = await getLatestSnapshot("polymarket");
    const age = latest ? Date.now() - latest.created_at.getTime() : Infinity;
    if (age > FRESHNESS_TTL_MS) {
      console.log("[boot] Latest snapshot is stale or missing — triggering background ingest");
      runIngest().catch((e) => console.error("[boot] Ingest run failed", e));
    } else {
      console.log("[boot] Latest snapshot is fresh — skipping boot ingest");
    }
  } catch (e) {
    console.error("[boot] Freshness check failed", e);
  }
}

async function start() {
  const app = await build();
  try {
    console.log("Initializing database schema...");
    await runSchema();

    const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 8080;
    await app.listen({ port, host: "0.0.0.0" });
    console.log(`Server listening on port ${port}`);

    void maybeBootIngest();
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
