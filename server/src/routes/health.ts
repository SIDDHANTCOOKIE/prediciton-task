import { FastifyInstance } from "fastify";
import { sql } from "../db/client";

export default async function healthRoutes(fastify: FastifyInstance) {
  fastify.get("/health", async (request, reply) => {
    try {
      // Touch DB to confirm liveness
      await sql`SELECT 1`;
      return { status: "ok", db: "connected" };
    } catch (err) {
      reply.status(500);
      return { status: "error", db: "disconnected" };
    }
  });
}
