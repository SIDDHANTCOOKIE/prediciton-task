import { FastifyInstance } from "fastify";
import { ingestPolymarket } from "../ingest/polymarket";
import { ingestKalshi } from "../ingest/kalshi";
import { insertSnapshot, upsertTraders, recordRankHistory } from "../db/queries";

export default async function ingestRoutes(fastify: FastifyInstance) {
  fastify.post("/ingest", async (request, reply) => {
    const { token } = request.query as { token?: string };
    
    if (process.env.INGEST_TOKEN && token !== process.env.INGEST_TOKEN) {
      reply.status(401);
      return { error: "Unauthorized" };
    }

    try {
      console.log("Starting ingestion...");
      
      const results = await Promise.allSettled([
        ingestPolymarket(),
        ingestKalshi()
      ]);

      const polyResult = results[0];
      const kalshiResult = results[1];
      
      let polyCount = 0;
      let kalshiCount = 0;

      if (polyResult.status === "fulfilled") {
        polyCount = polyResult.value.length;
        await insertSnapshot("polymarket", polyResult.value);
        await upsertTraders("polymarket", polyResult.value);
      } else {
        console.error("Polymarket ingest failed:", polyResult.reason);
      }

      if (kalshiResult.status === "fulfilled") {
        kalshiCount = kalshiResult.value.length;
        await insertSnapshot("kalshi", kalshiResult.value);
        await upsertTraders("kalshi", kalshiResult.value);
      } else {
        console.error("Kalshi ingest failed:", kalshiResult.reason);
      }

      // We need to re-sort the combined result before recording rank history
      const allTraders = [
        ...(polyResult.status === "fulfilled" ? polyResult.value : []),
        ...(kalshiResult.status === "fulfilled" ? kalshiResult.value : [])
      ];

      allTraders.sort((a, b) => {
        if (b.smart_score.score !== a.smart_score.score) {
          return b.smart_score.score - a.smart_score.score;
        }
        return b.stats.pnl - a.stats.pnl;
      });

      allTraders.forEach((t, i) => { t.rank = i + 1; });

      await recordRankHistory(allTraders);

      return { 
        status: "ok", 
        results: {
          polymarket: polyResult.status === "fulfilled" ? "success" : "failed",
          polymarket_count: polyCount,
          kalshi: kalshiResult.status === "fulfilled" ? "success" : "failed",
          kalshi_count: kalshiCount
        }
      };
    } catch (err) {
      console.error("Ingest error", err);
      reply.status(500);
      return { error: "Ingestion failed" };
    }
  });
}
