// Upstream data source: predicting.top's own public leaderboard API. Verified live and
// reachable (2026-07-16) — this replaces the earlier from-scratch Polymarket/Kalshi trade
// reconstruction (lib/polymarket.ts's dailySeriesFromTrades), which had a structural bug:
// buy-and-hold-to-resolution winners (redemption is an on-chain event, never a CLOB trade)
// looked like pure losses to that proxy. predicting.top already computes correct win rates,
// scores, and deposits server-side, and is reachable from networks where Polymarket/Kalshi
// are ISP-blocked. Parsing is still defensive (tolerant field access, skip malformed rows)
// because this is an unofficial, undocumented endpoint that could change shape without notice.

import type { SmartScore } from "./metrics";
import type { Trader, Venue } from "./types";

const UPSTREAM_URL = "https://predicting.top/api/leaderboard";
const FETCH_TIMEOUT_MS = 10_000;

export class UpstreamFetchError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "UpstreamFetchError";
  }
}

function num(v: unknown, fallback = 0): number {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : fallback;
}

function str(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

function nullableStr(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}

const KNOWN_VENUES: Venue[] = ["polymarket", "kalshi", "myriad", "opinion"];

function parseVenue(row: Record<string, unknown>): Venue {
  const hasPoly = str(row.polymarket_profile).length > 0;
  const hasKalshi = str(row.kalshi_profile).length > 0;
  if (hasPoly && hasKalshi) return "both";
  const raw = str(row.platform).toLowerCase();
  return (KNOWN_VENUES as string[]).includes(raw) ? (raw as Venue) : hasKalshi ? "kalshi" : "polymarket";
}

function parseScoreBreakdown(raw: unknown): SmartScore["scoreBreakdown"] {
  const b = (raw ?? {}) as Record<string, unknown>;
  return {
    sortinoScore: num(b.sortinoScore),
    winRateScore: num(b.winRateScore),
    rSquaredScore: num(b.rSquaredScore),
    maxDrawdownScore: num(b.maxDrawdownScore),
    profitFactorScore: num(b.profitFactorScore),
  };
}

const VALID_TIERS: SmartScore["tier"][] = ["Elite", "Great", "Good", "Average", "Risky"];

function parseSmartScore(raw: unknown): SmartScore {
  const s = (raw ?? {}) as Record<string, unknown>;
  const tier = VALID_TIERS.includes(str(s.tier) as SmartScore["tier"]) ? (str(s.tier) as SmartScore["tier"]) : "Risky";
  return {
    tier,
    score: num(s.score),
    percentile: num(s.percentile),
    winRate: num(s.winRate),
    profitFactor: num(s.profitFactor),
    sharpeRatio: num(s.sharpeRatio),
    sortinoRatio: num(s.sortinoRatio),
    calmarRatio: num(s.calmarRatio),
    rSquared: num(s.rSquared),
    trendSlope: num(s.trendSlope),
    maxDrawdown: num(s.maxDrawdown),
    maxDrawdownPercent: num(s.maxDrawdownPercent),
    currentDrawdown: num(s.currentDrawdown),
    stdDeviation: num(s.stdDeviation),
    downsideDeviation: num(s.downsideDeviation),
    avgDailyReturn: num(s.avgDailyReturn),
    medianDailyReturn: num(s.medianDailyReturn),
    totalReturn: num(s.totalReturn),
    bestDay: num(s.bestDay),
    worstDay: num(s.worstDay),
    longestWinStreak: num(s.longestWinStreak),
    longestLoseStreak: num(s.longestLoseStreak),
    winCount: num(s.winCount),
    lossCount: num(s.lossCount),
    dataPoints: num(s.dataPoints),
    firstDate: str(s.firstDate),
    lastDate: str(s.lastDate),
    calculatedAt: str(s.calculatedAt, new Date().toISOString()),
    scoreBreakdown: parseScoreBreakdown(s.scoreBreakdown),
  };
}

function parseTrader(row: Record<string, unknown>, index: number): Trader | null {
  const name = str(row.name);
  if (!name) return null;
  const stats = (row.stats ?? {}) as Record<string, unknown>;
  const transfers = (row.transfers ?? {}) as Record<string, unknown>;
  const deposits = num(transfers.deposits);

  return {
    rank: num(row.rank, index + 1),
    name,
    wallet: nullableStr(row.wallet),
    additional_wallets: Array.isArray(row.additional_wallets) ? (row.additional_wallets as string[]) : [],
    wallet_count: num(row.wallet_count),
    twitter: str(row.twitter),
    pfp: str(row.pfp),
    platform: parseVenue(row),
    polymarket_profile: str(row.polymarket_profile),
    kalshi_profile: str(row.kalshi_profile),
    kalshi_username: str(row.kalshi_username),
    myriad_profile: str(row.myriad_profile),
    opinion_wallet: nullableStr(row.opinion_wallet),
    opinion_profile: str(row.opinion_profile),
    join_date: str(row.join_date),
    views: num(row.views),
    largest_win: str(row.largest_win, "0"),
    affiliated: Boolean(row.affiliated),
    stats: {
      pnl: num(stats.pnl),
      buys: num(stats.buys),
      sells: num(stats.sells),
    },
    // Real deposited capital, when the upstream can resolve it — the capital-efficiency
    // denominator. See lib/sorting.ts's returnOnCapital / lib/sorting.ts's hasUsableDeposits.
    deposits,
    smart_score: parseSmartScore(row.smart_score),
    // No daily/positional history is exposed by this upstream, so there is no real
    // equity curve to show — leave empty rather than fabricate a sparkline shape.
    equity_curve: [],
  };
}

export async function fetchUpstreamLeaderboard(): Promise<Trader[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let json: unknown;
  try {
    const res = await fetch(UPSTREAM_URL, { signal: controller.signal, headers: { accept: "application/json" } });
    if (!res.ok) throw new UpstreamFetchError(`${UPSTREAM_URL} -> HTTP ${res.status}`);
    json = await res.json();
  } catch (err) {
    if (err instanceof UpstreamFetchError) throw err;
    throw new UpstreamFetchError(`Failed to reach ${UPSTREAM_URL}`, err);
  } finally {
    clearTimeout(timer);
  }

  const rows = Array.isArray(json)
    ? json
    : Array.isArray((json as Record<string, unknown>)?.traders)
      ? ((json as Record<string, unknown>).traders as unknown[])
      : [];

  return rows
    .map((row, i) => (row && typeof row === "object" ? parseTrader(row as Record<string, unknown>, i) : null))
    .filter((t): t is Trader => t !== null);
}
