import { Trader } from "../../../lib/types";
import { fetchJson, unwrapList, num, str, dig, extractXHandle } from "../util/http";
import { mapWithConcurrency } from "../util/concurrency";

// Confirmed real (captured from kalshi.com/social/leaderboard's own network traffic):
//   GET https://api.elections.kalshi.com/v1/social/profile?nickname=<nickname>
//   GET https://api.elections.kalshi.com/v1/social/metrics?nickname=<nickname>
//   GET https://api.elections.kalshi.com/v1/social/leaderboard?metric_name=<metric>&limit=<n>&time_period=<period>
//     -> { "rank_list": [ { nickname, social_id, profile_image_path, value, rank, is_anonymous } ] }
// Confirmed working metric_name values (captured from the site's own tabs): "projected_pnl",
// "volume", "num_markets_traded". "projected_pnl" is the closest to a profit ranking, so that's
// the default. Only "weekly" has been confirmed for time_period — an all-time equivalent may
// exist (check the site for a period selector) but hasn't been captured, so we default to the
// value known to actually work rather than guess at "all_time" and risk an empty/error response.
// limit=20 was the only value observed; whether pagination beyond 20 is possible (an
// offset/cursor param) is unconfirmed.
const SOCIAL_BASE = "https://api.elections.kalshi.com/v1/social";

function buildLeaderboardListUrl(): string {
  const params = new URLSearchParams({
    metric_name: process.env.KALSHI_METRIC_NAME || "projected_pnl",
    time_period: process.env.KALSHI_TIME_PERIOD || "weekly",
    limit: String(Math.min(process.env.LEADERBOARD_LIMIT ? parseInt(process.env.LEADERBOARD_LIMIT, 10) : 20, 20)),
  });
  return `${SOCIAL_BASE}/leaderboard?${params.toString()}`;
}

// KALSHI_LIST_URL, if set, overrides the constructed URL entirely — use it to paste in an
// exact confirmed URL (e.g. copied straight from the site's Profit tab) without a code change.
const LIST_ENDPOINT_CANDIDATES = [process.env.KALSHI_LIST_URL, buildLeaderboardListUrl()].filter(
  (u): u is string => !!u
);

type NicknameEntry = { nickname: string; rank: number; listValue: number };

async function fetchRankedNicknames(): Promise<NicknameEntry[]> {
  for (const url of LIST_ENDPOINT_CANDIDATES) {
    try {
      console.log(`[Kalshi] Trying list endpoint ${url}`);
      const json = await fetchJson(url);
      const rows = unwrapList(json);
      if (rows.length === 0) {
        console.warn(`[Kalshi] ${url} -> 200 but no array-shaped leaderboard field found`);
        continue;
      }
      const entries = rows
        .filter((row) => row.is_anonymous !== true)
        .map((row, i) => ({
          nickname: str(dig(row, ["nickname", "username", "name", "handle"])),
          rank: num(row.rank, i + 1),
          // "value" is confirmed to be a plain decimal dollar amount under metric_name=projected_pnl
          // (live sample: 364987.72), not integer cents — no /100 needed. Its meaning tracks
          // metric_name (it was a plain trade count under num_markets_traded), so this is only a
          // dollar figure under projected_pnl. Used only as a fallback if the per-trader /metrics
          // call below fails; /metrics's own pnl is preferred when available.
          listValue: num(row.value),
        }))
        .filter((e) => e.nickname.length > 0);
      if (entries.length === 0) continue;
      console.log(`[Kalshi] ${url} -> ${entries.length} ranked nicknames`);
      return entries;
    } catch (err) {
      console.warn(`[Kalshi] ${url} -> request failed`, err);
    }
  }
  return [];
}

/** Confirmed live shape: GET /v1/social/profile?nickname=X returns
 *  { social_profile: { nickname, description, profile_image_path, ... }, inner_circle: {...} } —
 *  everything is nested under `social_profile`, not top-level (the earlier guessed field names
 *  were looking at the wrong nesting level entirely). There's no dedicated "twitter" field —
 *  traders paste an x.com URL into `description` (their bio), same pattern as Polymarket's `bio`.
 *  `profile_image_path` is a bare filename/path fragment (e.g. "RNOne-2026-07-14 09:31:33"), not
 *  a resolvable URL — no known CDN base to construct a real image from, so left unused rather
 *  than passing a broken src (falls back to the initial-letter Avatar instead). */
function parseProfile(json: Record<string, unknown>) {
  const row = (json.social_profile ?? json) as Record<string, unknown>;
  const description = str(dig(row, ["description", "bio"]));
  return {
    displayName: str(dig(row, ["display_name", "displayName", "name", "nickname"])),
    twitter: extractXHandle(description),
  };
}

function parseMetrics(row: Record<string, unknown>) {
  const winRateRaw = num(dig(row, ["win_rate", "winRate"]) ?? 0);
  return {
    pnl: num(dig(row, ["pnl", "total_pnl", "totalPnl", "profit"])),
    volume: num(dig(row, ["volume", "total_volume", "totalVolume"])),
    numTrades: num(dig(row, ["num_markets_traded", "marketsTraded", "trades", "trade_count"])),
    // Tolerate either a 0-1 fraction or a 0-100 percent from an unconfirmed API shape.
    winRate: winRateRaw > 1 ? winRateRaw / 100 : winRateRaw,
  };
}

export async function ingestKalshi(): Promise<Trader[]> {
  if (process.env.KALSHI_ENABLED !== "true") {
    console.log("[Kalshi] Ingestion disabled via feature flag.");
    return [];
  }

  const entries = await fetchRankedNicknames();
  if (entries.length === 0) {
    console.warn("[Kalshi] No ranked list found from any candidate endpoint — returning empty slice. See server/README.md.");
    return [];
  }

  const limit = process.env.LEADERBOARD_LIMIT ? parseInt(process.env.LEADERBOARD_LIMIT, 10) : 100;
  const capped = entries.slice(0, limit);

  const CONCURRENCY = 5;
  const traders = await mapWithConcurrency(capped, CONCURRENCY, async (entry): Promise<Trader | null> => {
    // Profile and metrics are independent per-trader calls — a failure in one shouldn't drop
    // the trader if the other succeeds; the list's own `value` covers pnl if /metrics is down.
    const [profileResult, metricsResult] = await Promise.allSettled([
      fetchJson(`${SOCIAL_BASE}/profile?nickname=${encodeURIComponent(entry.nickname)}`),
      fetchJson(`${SOCIAL_BASE}/metrics?nickname=${encodeURIComponent(entry.nickname)}`),
    ]);

    if (profileResult.status === "rejected") {
      console.warn(`[Kalshi] profile fetch failed for ${entry.nickname}`, profileResult.reason);
    }
    if (metricsResult.status === "rejected") {
      console.warn(`[Kalshi] metrics fetch failed for ${entry.nickname}`, metricsResult.reason);
    }

    try {
      const profile = parseProfile((profileResult.status === "fulfilled" ? profileResult.value ?? {} : {}) as Record<string, unknown>);
      const metrics = parseMetrics((metricsResult.status === "fulfilled" ? metricsResult.value ?? {} : {}) as Record<string, unknown>);
      const name = profile.displayName || entry.nickname;
      const pnl = metricsResult.status === "fulfilled" ? metrics.pnl : entry.listValue;

      return {
        rank: entry.rank,
        name,
        wallet: null, // Kalshi doesn't expose proxy wallets — deposits stays 0, excluded from ratio sorts
        additional_wallets: [],
        wallet_count: 1,
        twitter: profile.twitter,
        pfp: "", // no resolvable image URL from Kalshi's profile response — see parseProfile
        platform: "kalshi",
        polymarket_profile: "",
        kalshi_profile: entry.nickname,
        kalshi_username: entry.nickname,
        myriad_profile: "",
        opinion_wallet: null,
        opinion_profile: "",
        join_date: "",
        views: 0,
        largest_win: "0",
        affiliated: false,
        stats: {
          pnl,
          buys: metrics.volume, // dollar volume proxy, matches lib/filtering.ts's minVolume treating buys+sells as volume
          sells: 0,
        },
        deposits: 0,
        smart_score: {
          tier: "Average",
          score: 0,
          percentile: 0,
          winRate: metrics.winRate,
          profitFactor: 1,
          sharpeRatio: 0,
          sortinoRatio: 0,
          calmarRatio: 0,
          rSquared: 0,
          trendSlope: 0,
          maxDrawdown: 0,
          maxDrawdownPercent: 0,
          currentDrawdown: 0,
          stdDeviation: 0,
          downsideDeviation: 0,
          avgDailyReturn: 0,
          medianDailyReturn: 0,
          totalReturn: pnl,
          bestDay: 0,
          worstDay: 0,
          longestWinStreak: 0,
          longestLoseStreak: 0,
          winCount: 0,
          lossCount: 0,
          dataPoints: 0, // Kalshi's social API doesn't expose a daily history — thin-sample by design
          firstDate: "",
          lastDate: "",
          calculatedAt: new Date().toISOString(),
          scoreBreakdown: {
            sortinoScore: 0,
            winRateScore: 0,
            rSquaredScore: 0,
            maxDrawdownScore: 0,
            profitFactorScore: 0,
          },
        },
        equity_curve: [],
      };
    } catch (err) {
      console.warn(`[Kalshi] Failed to fetch profile/metrics for ${entry.nickname}`, err);
      return null;
    }
  });

  const ok = traders.filter((t): t is Trader => t !== null);
  console.log(`[Kalshi] Fetched ${ok.length}/${capped.length} traders.`);
  return ok;
}
