import { FastifyInstance } from "fastify";
import { runIngest } from "../ingest/runIngest";

export default async function ingestRoutes(fastify: FastifyInstance) {
  fastify.post("/ingest", async (request, reply) => {
    const { token, wait } = request.query as { token?: string; wait?: string };

    if (process.env.INGEST_TOKEN && token !== process.env.INGEST_TOKEN) {
      reply.status(401);
      return { error: "Unauthorized" };
    }

    // A full ingest (40+ wallets, several activity pages each) takes minutes — well past
    // Render's proxy timeout. Default to fire-and-forget so a keep-alive pinger sees a fast 202
    // instead of a timeout-triggered retry stampede (which the single-flight guard in runIngest
    // would otherwise just be absorbing pointlessly). `?wait=1` keeps the old synchronous
    // behavior for local testing / the verification steps in the deploy plan.
    if (wait === "1") {
      try {
        const result = await runIngest();
        return result;
      } catch (err) {
        console.error("Ingest error", err);
        reply.status(500);
        return { error: "Ingestion failed" };
      }
    }

    runIngest().catch((err) => console.error("Ingest error (background)", err));
    reply.status(202);
    return { status: "started" };
  });
}
