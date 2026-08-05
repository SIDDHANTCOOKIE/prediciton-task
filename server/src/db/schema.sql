CREATE TABLE IF NOT EXISTS snapshots (
  id SERIAL PRIMARY KEY,
  venue VARCHAR(50) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  payload JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_snapshots_venue_created_at ON snapshots(venue, created_at DESC);

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
);

CREATE TABLE IF NOT EXISTS rank_history (
  trader_id VARCHAR(255) NOT NULL, -- corresponds to traders.external_id
  score_rank INTEGER NOT NULL,
  pnl_rank INTEGER NOT NULL,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rank_history_trader_id_captured_at ON rank_history(trader_id, captured_at DESC);
