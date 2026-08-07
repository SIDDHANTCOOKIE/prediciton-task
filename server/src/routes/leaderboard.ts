import { FastifyInstance } from "fastify";
import { getLatestSnapshot, getPreviousRankHistory } from "../db/queries";
import { Trader, Period } from "../../../lib/types";

const FRESHNESS_TTL_MS = 15 * 60 * 1000; // 15 minutes
const VALID_PERIODS: Period[] = ["1D", "1W", "1M", "ALL"];

function score(t: Trader): number {
  return t.smart_score?.score ?? -Infinity;
}

export default async function leaderboardRoutes(fastify: FastifyInstance) {
  fastify.get("/api/leaderboard", async (request, reply) => {
    try {
      const { period: rawPeriod } = request.query as { period?: string };
      const period: Period = VALID_PERIODS.includes(rawPeriod as Period) ? (rawPeriod as Period) : "ALL";

      const polySnapshot = await getLatestSnapshot(`polymarket:${period}`);
      // Kalshi has no dated daily series (its ingester has no per-period history to slice — see
      // server/src/ingest/kalshi.ts) and its own board is weekly-only, so it's included under ALL
      // only rather than shown under 1D/1W/1M with a stale or made-up figure.
      const kalshiSnapshot = period === "ALL" && process.env.KALSHI_ENABLED === "true" ? await getLatestSnapshot("kalshi") : null;

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

      if (kalshiSnapshot) {
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

      // Sort by score (null sorts last) or PnL
      traders.sort((a, b) => {
        const diff = score(b) - score(a);
        return diff !== 0 ? diff : b.stats.pnl - a.stats.pnl;
      });

      // Inject previous ranks
      if (traders.length > 0) {
        const previousRanks = await getPreviousRankHistory(traders.map((t) => t.wallet || t.kalshi_username || t.name));
        for (const t of traders) {
          const id = t.wallet || t.kalshi_username || t.name;
          if (previousRanks[id] !== undefined) {
            t.previousScoreRank = previousRanks[id];
          }
        }
      }

      return {
        period,
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
