import { FastifyInstance } from "fastify";
import { getLatestSnapshot, getPreviousRankHistory } from "../db/queries";
import { Trader } from "../../../lib/types";

const FRESHNESS_TTL_MS = 15 * 60 * 1000; // 15 minutes

export default async function leaderboardRoutes(fastify: FastifyInstance) {
  fastify.get("/api/leaderboard", async (request, reply) => {
    try {
      const polySnapshot = await getLatestSnapshot("polymarket");
      const kalshiSnapshot = await getLatestSnapshot("kalshi");

      let traders: Trader[] = [];
      let stale = false;
      let updatedAt = new Date().toISOString();

      if (polySnapshot) {
        traders.push(...polySnapshot.payload);
        if (Date.now() - polySnapshot.created_at.getTime() > FRESHNESS_TTL_MS) {
          stale = true;
        }
        updatedAt = polySnapshot.created_at.toISOString();
      }

      if (kalshiSnapshot && process.env.KALSHI_ENABLED === "true") {
        traders.push(...kalshiSnapshot.payload);
        if (Date.now() - kalshiSnapshot.created_at.getTime() > FRESHNESS_TTL_MS) {
          stale = true;
        }
        // Take the older updated at if both exist
        if (polySnapshot && kalshiSnapshot.created_at < polySnapshot.created_at) {
          updatedAt = kalshiSnapshot.created_at.toISOString();
        } else if (!polySnapshot) {
          updatedAt = kalshiSnapshot.created_at.toISOString();
        }
      }

      // Sort by score or PnL
      traders.sort((a, b) => {
        if (b.smart_score.score !== a.smart_score.score) {
          return b.smart_score.score - a.smart_score.score;
        }
        return b.stats.pnl - a.stats.pnl;
      });

      // Inject previous ranks
      if (traders.length > 0) {
        const previousRanks = await getPreviousRankHistory(traders.map(t => t.wallet || t.kalshi_username || t.name));
        for (const t of traders) {
          const id = t.wallet || t.kalshi_username || t.name;
          if (previousRanks[id] !== undefined) {
            t.previousScoreRank = previousRanks[id];
          }
        }
      }

      return {
        updatedAt,
        stale,
        count: traders.length,
        traders,
      };
    } catch (err) {
      console.error("Leaderboard route error", err);
      reply.status(500);
      return { error: "Failed to fetch leaderboard from database" };
    }
  });
}
