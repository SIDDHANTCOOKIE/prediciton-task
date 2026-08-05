import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import cron from "node-cron";

import { runSchema } from "./db/queries";
import healthRoutes from "./routes/health";
import ingestRoutes from "./routes/ingest";
import leaderboardRoutes from "./routes/leaderboard";

const fastify = Fastify({ logger: true });

async function build() {
  await fastify.register(cors, {
    origin: process.env.FRONTEND_ORIGIN || "*", 
  });

  fastify.register(healthRoutes);
  fastify.register(ingestRoutes);
  fastify.register(leaderboardRoutes);

  // Secondary awake-time refresher (every 10 minutes)
  cron.schedule("*/10 * * * *", async () => {
    console.log("[cron] Triggering internal ingest schedule");
    try {
      await fetch(`http://localhost:${process.env.PORT || 8080}/ingest?token=${process.env.INGEST_TOKEN || ""}`, { method: 'POST' });
    } catch (e) {
      console.error("[cron] Ingest trigger failed", e);
    }
  });

  return fastify;
}

async function start() {
  const app = await build();
  try {
    console.log("Initializing database schema...");
    await runSchema();
    
    const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 8080;
    await app.listen({ port, host: "0.0.0.0" });
    console.log(`Server listening on port ${port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
