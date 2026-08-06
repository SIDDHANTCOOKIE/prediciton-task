import { FastifyInstance } from "fastify";
import { getLatestSnapshot } from "../db/queries";
import { Position } from "../../../lib/types";

const FRESHNESS_TTL_MS = 15 * 60 * 1000; // 15 minutes — mirrors leaderboard.ts's threshold

export default async function positionsRoutes(fastify: FastifyInstance) {
  fastify.get("/api/positions", async (request, reply) => {
    try {
      const snapshot = await getLatestSnapshot<Position>("polymarket_positions");

      if (!snapshot) {
        return { updatedAt: null, stale: false, count: 0, positions: [] as Position[] };
      }

      const stale = Date.now() - snapshot.created_at.getTime() > FRESHNESS_TTL_MS;

      return {
        updatedAt: snapshot.created_at.toISOString(),
        stale,
        count: snapshot.payload.length,
        positions: snapshot.payload,
      };
    } catch (err) {
      console.error("Positions route error", err);
      reply.status(500);
      return { error: "Failed to fetch positions from database" };
    }
  });
}
