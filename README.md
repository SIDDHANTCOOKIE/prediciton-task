# Elcara Predictor

A leaderboard for Polymarket and Kalshi traders, ranked by **risk-adjusted efficiency**
(Sharpe, Sortino, drawdown, win rate, profit factor) instead of raw P&L — so a $10→$10,010
trader can outrank a lucky $1M→$1.01M one. See [`/docs`](app/docs/page.tsx) in the running app
for a full methodology overview.

## Why this exists

Raw P&L leaderboards reward bankroll size, not skill. This project re-derives each trader's
day-by-day trading history from public on-chain activity and computes the same risk metrics
hedge funds use, so ranking reflects *how* someone trades, not just how much they had to bet.

## Architecture

```
Browser  →  Frontend (Next.js, Vercel)  →  Backend (Fastify, Render, always-on)  →  Postgres
                                                    ↓
                                        Polymarket + Kalshi (public APIs)
```

The browser and frontend **never** call Polymarket/Kalshi directly — only the backend does.
That's deliberate: some networks poison DNS for these hosts (the resolver hands back a wrong,
dead-end IP instead of the real one) and Cloudflare/CloudFront occasionally reset a request for
no confirmed reason, so a single backend does all the fetching — resolving around bad DNS via
DNS-over-HTTPS and riding out resets via retries (`server/src/util/dns.ts`, `server/src/util/http.ts`)
— persists to Postgres, and serves everyone from that store. A venue outage degrades freshness
(served snapshot marked `stale`), never availability.

Full detail — including the exact scoring pipeline and the free-tier keep-alive setup — lives
in [`app/docs/page.tsx`](app/docs/page.tsx) (rendered at `/docs`) and [`server/README.md`](server/README.md).

## Repo layout

- `app/`, `components/`, `lib/` — the Next.js frontend (leaderboard, positions page, docs page,
  filtering/sorting/scoring logic shared with the backend).
- `server/` — the standalone backend service: ingestion (`src/ingest/`), score reconstruction
  (`src/score/`), Postgres access (`src/db/`), and the read/ingest API (`src/routes/`).
- `render.yaml` — backend deploy config for Render.

## Running locally

**Backend** (needs a Postgres connection string, e.g. from Neon's free tier):

```bash
cd server
cp .env.example .env   # fill in DATABASE_URL, INGEST_TOKEN
npm install
npm run dev            # listens on :8080
```

**Frontend** (in a second terminal, from the repo root):

```bash
cp .env.example .env.local   # NEXT_PUBLIC_BACKEND_URL defaults to http://localhost:8080
npm install
npm run dev                  # http://localhost:3000
```

Trigger a first data pull once the backend is up:

```bash
curl -X POST "http://localhost:8080/ingest?token=<INGEST_TOKEN>"
```

## Deploying

- **Backend → Render**: see [`server/README.md`](server/README.md) for the full guide, including
  the free-tier keep-alive setup (an external pinger, not internal cron, is what actually keeps
  data refreshing — read that section before deploying).
- **Frontend → Vercel**: set `NEXT_PUBLIC_BACKEND_URL` to the deployed Render URL.
- **Database**: Neon (free Postgres) or Render Postgres.

## Data sources & honesty guarantees

- **Polymarket**: official public Data API (`/v1/leaderboard`, `/activity`, `/positions`).
- **Kalshi**: no documented public leaderboard API exists — reverse-engineered from
  `kalshi.com/social/leaderboard`'s own network traffic (`/v1/social/leaderboard`, `/profile`,
  `/metrics`). Ranks by `projected_pnl` over a confirmed `weekly` window by default (the
  closest real option to "profit"; a true all-time metric hasn't been confirmed yet). Degrades
  to an empty slice if the endpoint breaks rather than fabricating data. See `server/README.md`.
- **No demo/fallback data, ever.** If live data can't be fetched and there's no prior good
  snapshot, the UI shows an explicit error, never invented numbers.
- Reconstructed per-trader scores are validated against each venue's own official P&L; a
  mismatch beyond tolerance flags that row `isConfident: false` rather than silently trusting a
  possibly-wrong curve. Confirmed live: Polymarket's activity API hard-caps history retrieval at
  5,000 events per wallet (`"max historical activity offset of 5000 exceeded"`), so a
  long-tenured/high-frequency trader's full lifetime record often isn't retrievable at all — that
  specific, disclosed case (`historyTruncated: true`) gets a calmer info icon in the UI rather
  than the orange low-confidence warning, since it's an upstream platform ceiling, not a
  computation error.
