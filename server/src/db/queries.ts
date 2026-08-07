import { sql } from "./client";
import { Trader, Venue } from "../../../lib/types";

/** `venue` doubles as a generic snapshot key — besides the real Venue values ("polymarket",
 *  "kalshi"), "polymarket_positions" reuses this same table for the positions feed rather than
 *  adding a parallel table, hence the plain-string signature instead of `Venue`. */
export async function insertSnapshot<T = Trader>(venue: Venue | string, payload: T[]) {
  if (!process.env.DATABASE_URL) return; // bypass if no DB

  await sql`
    INSERT INTO snapshots (venue, payload)
    VALUES (${venue}, ${sql.json(payload as unknown as import("postgres").JSONValue)})
  `;
}

export async function getLatestSnapshot<T = Trader>(venue: Venue | string): Promise<{ created_at: Date; payload: T[] } | null> {
  if (!process.env.DATABASE_URL) return null;

  const result = await sql`
    SELECT created_at, payload
    FROM snapshots
    WHERE venue = ${venue}
    ORDER BY created_at DESC
    LIMIT 1
  `;

  if (result.length === 0) return null;

  return {
    created_at: result[0].created_at,
    payload: result[0].payload as T[],
  };
}

export async function upsertTraders(venue: Venue, traders: Trader[]) {
  if (!process.env.DATABASE_URL || traders.length === 0) return;

  const rows = traders.map(t => ({
    venue,
    external_id: t.wallet || t.kalshi_username || t.name,
    name: t.name,
    wallet: t.wallet || null,
    x_username: t.twitter || null,
    pnl: t.stats.pnl,
    volume: t.stats.buys + t.stats.sells,
    // Trader no longer carries a `deposits` field (Efficiency is P&L÷Volume now, not P&L÷Deposits
    // — see lib/sorting.ts). This `traders` table is write-only (nothing reads it back; the
    // read path is entirely the `snapshots` JSONB payload), so a schema migration to drop the
    // column isn't worth doing just to stop writing a literal 0 into it.
    deposits: 0,
    smart_score: sql.json(t.smart_score),
    updated_at: new Date()
  }));

// Do batch upsert
  await sql`
    INSERT INTO traders ${ sql(rows) }
    ON CONFLICT (venue, external_id) DO UPDATE SET
      name = EXCLUDED.name,
      wallet = EXCLUDED.wallet,
      x_username = EXCLUDED.x_username,
      pnl = EXCLUDED.pnl,
      volume = EXCLUDED.volume,
      deposits = EXCLUDED.deposits,
      smart_score = EXCLUDED.smart_score,
      updated_at = EXCLUDED.updated_at
  `;
}

/** `traders` must already be sorted by score descending with `.rank` set accordingly
 *  (score_rank). pnl_rank is derived here from a separate raw-P&L sort so the two rankings
 *  don't collapse into the same number. */
export async function recordRankHistory(traders: Trader[]) {
  if (!process.env.DATABASE_URL || traders.length === 0) return;

  const idOf = (t: Trader) => t.wallet || t.kalshi_username || t.name;
  const pnlRankById = new Map<string, number>();
  [...traders]
    .sort((a, b) => b.stats.pnl - a.stats.pnl)
    .forEach((t, i) => pnlRankById.set(idOf(t), i + 1));

  const rows = traders.map(t => ({
    trader_id: idOf(t),
    score_rank: t.rank, // Assuming the array is sorted and rank is accurate at recording time
    pnl_rank: pnlRankById.get(idOf(t)) ?? t.rank,
    captured_at: new Date()
  }));

  await sql`INSERT INTO rank_history ${ sql(rows) }`;
}

export async function getPreviousRankHistory(traderIds: string[]): Promise<Record<string, number>> {
  if (!process.env.DATABASE_URL || traderIds.length === 0) return {};

  const history = await sql`
    SELECT DISTINCT ON (trader_id) trader_id, score_rank
    FROM rank_history
    WHERE trader_id IN ${ sql(traderIds) }
    ORDER BY trader_id, captured_at DESC
  `;

  const ranks: Record<string, number> = {};
  for (const row of history) {
    ranks[row.trader_id] = row.score_rank;
  }
  return ranks;
}

export async function runSchema() {
  if (!process.env.DATABASE_URL) return;
  
  await sql`
    CREATE TABLE IF NOT EXISTS snapshots (
      id SERIAL PRIMARY KEY,
      venue VARCHAR(50) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      payload JSONB NOT NULL
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_snapshots_venue_created_at ON snapshots(venue, created_at DESC)`;

  await sql`
    CREATE TABLE IF NOT EXISTS traders (
      venue VARCHAR(50) NOT NULL,
      external_id VARCHAR(255) NOT NULL,
      name VARCHAR(255) NOT NULL,
      wallet VARCHAR(255),
      x_username VARCHAR(255),
      pnl NUMERIC NOT NULL,
      volume NUMERIC NOT NULL,
      deposits NUMERIC NOT NULL,
      smart_score JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (venue, external_id)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS rank_history (
      trader_id VARCHAR(255) NOT NULL,
      score_rank INTEGER NOT NULL,
      pnl_rank INTEGER NOT NULL,
      captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_rank_history_trader_id_captured_at ON rank_history(trader_id, captured_at DESC)`;
}
