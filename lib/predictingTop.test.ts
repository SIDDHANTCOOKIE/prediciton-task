import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchUpstreamLeaderboard, UpstreamFetchError } from "./predictingTop";

// Canned fixture shaped exactly like a verified real response from
// GET https://predicting.top/api/leaderboard (captured 2026-07-16).
const REAL_SHAPE_FIXTURE = {
  traders: [
    {
      rank: 1,
      name: "BallerinaCapuccina",
      wallet: null,
      additional_wallets: [],
      wallet_count: 0,
      twitter: "",
      pfp: "",
      polymarket_profile: "",
      platform: "kalshi",
      kalshi_profile: "https://kalshi.com/ideas/profiles/BallerinaCapuccina",
      kalshi_username: "BallerinaCapuccina",
      myriad_profile: "",
      opinion_wallet: null,
      opinion_profile: "",
      stats: { pnl: 189291.9956, buys: 0, sells: 0 },
      transfers: { deposits: 0, withdrawals: 0 },
      views: 0,
      largest_win: "0.000000",
      join_date: null,
      smart_score: {
        tier: "Great",
        score: 76.3,
        bestDay: 0.2536,
        winRate: 0.457,
        lastDate: "2026-07-15",
        rSquared: 0.8963,
        winCount: 113,
        worstDay: -0.1029,
        firstDate: "2026-01-12",
        lossCount: 70,
        dataPoints: 248,
        percentile: 49,
        trendSlope: 10201.21,
        calmarRatio: 14.24,
        maxDrawdown: 534977,
        sharpeRatio: 2.77,
        totalReturn: 2448365,
        calculatedAt: "2026-07-15T05:52:45.249Z",
        profitFactor: 2.02,
        sortinoRatio: 3.91,
        stdDeviation: 0.0196,
        avgDailyReturn: 0.002,
        scoreBreakdown: { sortinoScore: 100, winRateScore: 39.4, rSquaredScore: 89.6, maxDrawdownScore: 79.4, profitFactorScore: 60.8 },
        currentDrawdown: 0,
        longestWinStreak: 9,
        downsideDeviation: 0.0139,
        longestLoseStreak: 8,
        medianDailyReturn: 0,
        maxDrawdownPercent: 0.103,
      },
      affiliated: false,
    },
    {
      rank: 2,
      name: "Noose",
      wallet: "0xf68a281980f8c13828e84e147e3822381d6e5b1b",
      additional_wallets: [],
      wallet_count: 1,
      twitter: "https://x.com/Nooserac",
      pfp: "https://pbs.twimg.com/profile_images/1756760272642215936/4ntZE-MP_400x400.jpg",
      polymarket_profile: "https://polymarket.com/@0xf68a281980f8c13828e84e147e3822381d6e5b1b",
      platform: "polymarket",
      kalshi_profile: "",
      kalshi_username: null,
      myriad_profile: "",
      opinion_wallet: null,
      opinion_profile: "",
      stats: { pnl: 96097.15, buys: 8, sells: 0 },
      transfers: { deposits: 123248.804246, withdrawals: 0 },
      views: 8741,
      largest_win: "39903.670528",
      join_date: "2025-02-04T03:37:07.429835Z",
      smart_score: {
        tier: "Good",
        score: 67.6,
        bestDay: 122.2169,
        winRate: 0.518,
        lastDate: "2026-07-15",
        rSquared: 0.6692,
        winCount: 270,
        worstDay: -1.4452,
        firstDate: "2025-02-10",
        lossCount: 238,
        dataPoints: 522,
        percentile: 59,
        trendSlope: 1405.76,
        calmarRatio: 104.74,
        maxDrawdown: 351,
        sharpeRatio: 1.02,
        totalReturn: 421431,
        calculatedAt: "2026-07-15T05:22:45.015Z",
        profitFactor: 6.31,
        sortinoRatio: 31.54,
        stdDeviation: 5.3651,
        avgDailyReturn: 0.287,
        scoreBreakdown: { sortinoScore: 100, winRateScore: 54.6, rSquaredScore: 66.9, maxDrawdownScore: 0, profitFactorScore: 100 },
        currentDrawdown: 0.543,
        longestWinStreak: 9,
        downsideDeviation: 0.1738,
        longestLoseStreak: 8,
        medianDailyReturn: 0.0014,
        maxDrawdownPercent: 1,
      },
      affiliated: false,
    },
  ],
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchUpstreamLeaderboard", () => {
  it("parses a real-shaped response into sane Trader objects (regression test for the redemption-blindness bug)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => REAL_SHAPE_FIXTURE })
    );
    const traders = await fetchUpstreamLeaderboard();
    expect(traders).toHaveLength(2);

    const ballerina = traders.find((t) => t.name === "BallerinaCapuccina")!;
    expect(ballerina.wallet).toBeNull();
    expect(ballerina.platform).toBe("kalshi");
    expect(ballerina.smart_score.winRate).toBeCloseTo(0.457);
    // This is the regression check: real win rates must survive intact, not collapse
    // toward 0 the way the old trade-cash-flow-sign proxy did for buy-and-hold winners.
    expect(ballerina.smart_score.winRate).toBeGreaterThan(0.3);
    expect(ballerina.smart_score.score).toBeCloseTo(76.3);
    expect(ballerina.deposits).toBe(0);
    expect(ballerina.join_date).toBe(""); // null upstream -> empty string, never crashes

    const noose = traders.find((t) => t.name === "Noose")!;
    expect(noose.wallet).toBe("0xf68a281980f8c13828e84e147e3822381d6e5b1b");
    expect(noose.platform).toBe("polymarket");
    expect(noose.deposits).toBeCloseTo(123248.8, 0);
    expect(noose.smart_score.dataPoints).toBe(522);
  });

  it("does not tie every trader to the same score (the actual bug this replaces)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => REAL_SHAPE_FIXTURE })
    );
    const traders = await fetchUpstreamLeaderboard();
    const scores = new Set(traders.map((t) => t.smart_score.score));
    expect(scores.size).toBeGreaterThan(1);
  });

  it("skips malformed rows (missing name) instead of crashing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ traders: [{ rank: 1 }, REAL_SHAPE_FIXTURE.traders[0]] }) })
    );
    const traders = await fetchUpstreamLeaderboard();
    expect(traders).toHaveLength(1);
  });

  it("throws UpstreamFetchError on a non-OK response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 502 }));
    await expect(fetchUpstreamLeaderboard()).rejects.toBeInstanceOf(UpstreamFetchError);
  });

  it("throws UpstreamFetchError when the fetch itself rejects (network failure)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    await expect(fetchUpstreamLeaderboard()).rejects.toBeInstanceOf(UpstreamFetchError);
  });
});
