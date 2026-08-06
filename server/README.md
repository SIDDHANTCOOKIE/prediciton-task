# Leaderboard backend

Always-on ingestion + read API for the Polymarket/Kalshi leaderboard. Fetches upstreams,
reconstructs risk-adjusted scores, and persists snapshots to Postgres. The Next.js frontend
never talks to Polymarket/Kalshi directly — it only reads `GET /api/leaderboard` from this
service, which is what keeps the site working regardless of what network the *viewer* is on.

## Local dev

```
cp .env.example .env   # fill in DATABASE_URL at minimum
npm install
npm run dev
```

## Network resilience: DNS poisoning + intermittent resets

On some networks (confirmed on the one this was developed on), the system DNS resolver returns
a wrong, dead-end IP for `data-api.polymarket.com` and `api.elections.kalshi.com` — DNS
poisoning, not a firewall block. `server/src/util/dns.ts` resolves around this via Cloudflare's
DNS-over-HTTPS instead of trusting the local resolver, falling back to Node's normal DNS if DoH
itself is unreachable. `server/src/util/http.ts` wires this into a per-hostname `undici.Agent`
used by `fetchJson`, the single fetch chokepoint both ingesters share.

Separately, even once DNS resolves correctly, Polymarket's Cloudflare edge occasionally resets a
connection for no confirmed reason (measured: intermittent, not consistent — no confirmed
mechanism). `fetchJson`'s retry/backoff (3 attempts) reliably rides this out — measured at 30/30
successful wallet fetches across 3 full batches at the ingester's real concurrency (5).

An earlier version of this doc claimed a deterministic SNI-based block for Polymarket, requiring
a separate egress relay. Re-testing that specific claim did not reproduce it — plain `curl` to
the correctly-resolved IP succeeded immediately. That relay was removed; it was solving a problem
that measurement showed didn't require it. Both fixes above are no-ops on a network without these
issues (same correct IP either way), so there's no behavior difference in a clean environment —
only in a poisoned/flaky one.

## Polymarket's activity history ceiling (confirmed, not fixable by us)

`server/src/ingest/polymarket.ts`'s `fetchAllActivity` paginates `/activity` (which defaults to
only 100 events and silently caps at 500 per request even with a higher `limit`) via `offset`.
Confirmed live: the API hard-rejects any `offset` past 5000 —
`{"error":"max historical activity offset of 5000 exceeded"}` — tested against a $22M-PnL wallet
whose full 5,500-event history covered only ~3.5 weeks. This is a genuine platform ceiling: a
long-tenured or high-frequency trader's full lifetime history is **not retrievable** through this
public endpoint at any pagination depth, so their reconstructed PnL can legitimately never
reconcile with the venue's own lifetime total.

`fetchAllActivity` stops one page short of that wall (never issues the guaranteed-400 request,
which would otherwise burn `fetchJson`'s full retry budget for nothing) and early-exits as soon
as the accumulated history already reconciles — most traders settle in 1-3 pages. When a trader
hits the cap without reconciling, `Trader.historyTruncated` is set `true` so the UI can show a
calm, explanatory info icon instead of the orange low-confidence warning — this is a disclosed
upstream limit, not a computation bug, and should never be presented as one.

## Deploying (Render free tier)

`render.yaml` at the repo root defines the service (region pinned to `oregon`, a reasonable
default for latency to US-hosted upstreams — not required by the DNS/reset issue above, which
the fixes above handle regardless of region).

Set these env vars in the Render dashboard (`sync: false` in render.yaml means Render won't
auto-fill them — you must set them manually):

- `DATABASE_URL` — a Postgres connection string (e.g. Neon free tier).
- `INGEST_TOKEN` — any random secret string; guards `POST /ingest` from being triggered by
  randoms on the internet.

## The free-tier keep-alive loophole (important — read this)

Render's free web services **sleep after ~15 minutes idle**, and a sleeping process cannot
run its own internal cron — so the `node-cron` job in `src/index.ts` is a *secondary*
refresher only; it does nothing while the instance is asleep. **The real scheduler has to be
an external pinger that wakes the service from outside:**

1. Sign up for [UptimeRobot](https://uptimerobot.com) (free) or [cron-job.org](https://cron-job.org) (free).
2. Add a monitor/job hitting `GET https://<your-service>.onrender.com/health` every 5 minutes
   — this is what keeps the instance warm (Render counts it as traffic).
3. Add a second monitor/job hitting `POST https://<your-service>.onrender.com/ingest?token=<INGEST_TOKEN>`
   every 10–15 minutes — this is what actually drives ingestion. `/ingest` is idempotent and
   token-guarded, so it's safe for an external pinger to call directly.

Without step 3, `/health` pings alone keep the process awake but never refresh the data —
the leaderboard would go stale forever on a live-looking, but sleeping-and-never-ingesting,
service.

One always-pinged free instance runs ~730 hrs/month, under Render's 750-hr free cap.

`POST /ingest` returns `202 {"status":"started"}` immediately and runs the actual ingest (which
can take minutes for 40+ wallets) in the background — this keeps a pinger's request from timing
out and retrying into overlapping runs. All ingest triggers (the pinger, the internal 10-minute
cron, and a boot-time check) share one in-flight run (`server/src/ingest/runIngest.ts`), so
overlapping calls are safe. On top of the pinger, the server also self-heals on a cold boot: if
the newest snapshot is already older than 15 minutes when the process starts, it kicks off a
background ingest immediately rather than waiting for the next cron tick or pinger hit. Pass
`?wait=1` to `POST /ingest` to get the old synchronous behavior back for local testing.

## Kalshi ingestion status

Confirmed real, from inspecting `kalshi.com/social/leaderboard`'s own network traffic:

```
GET https://api.elections.kalshi.com/v1/social/profile?nickname=<nickname>
GET https://api.elections.kalshi.com/v1/social/metrics?nickname=<nickname>
GET https://api.elections.kalshi.com/v1/social/leaderboard?metric_name=<metric>&limit=<n>&time_period=<period>
  -> { "rank_list": [ { nickname, social_id, profile_image_path, value, rank, is_anonymous } ] }
```

The list endpoint's **path, shape, and working param values are confirmed**:

- `metric_name`: confirmed working values are `projected_pnl`, `volume`, `num_markets_traded`.
  Default is `projected_pnl` — the closest available metric to "profit" (there's no plain `pnl`
  option confirmed; `projected_pnl` is what Kalshi's own Profit-ish tab actually sends).
- `time_period`: only `weekly` has been confirmed to work. An all-time equivalent may exist
  (check the site for a period toggle — daily/monthly/all could plausibly be sibling values) but
  hasn't been captured. Defaulting to the value known to actually return data, rather than
  guessing at an unconfirmed one and getting an empty/error response.
- `limit=20` was the only value observed — whether pagination beyond 20 is possible (an
  `offset`/`cursor` param) is unconfirmed; check the same request for such a param if the full
  Kalshi leaderboard needs more than 20 rows.

To try other values, set `KALSHI_METRIC_NAME`/`KALSHI_TIME_PERIOD`, or paste a full URL into
`KALSHI_LIST_URL` to override both at once — see `.env.example`.

Field names in `profile`/`metrics` (display name, X/Twitter handle, avatar, PnL, volume, win
rate) are still unconfirmed — only the `rank_list` response body has been observed, and it
doesn't carry those (notably `social_id` was empty on every sampled row, so X/Twitter linking
has to come from `profile`, not the list). `parseProfile`/`parseMetrics` in
`src/ingest/kalshi.ts` try several likely field names via a `dig()` helper; paste a real
`profile`/`metrics` response JSON in to tighten these once available.

If the list call fails outright, this ingester degrades to an empty, clearly-logged Kalshi slice
(`KALSHI_ENABLED=false` disables it entirely) rather than guessing at fabricated data.
