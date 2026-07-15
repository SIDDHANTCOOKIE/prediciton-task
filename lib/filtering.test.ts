import { describe, it, expect } from "vitest";
import { applyFilters, applySort, applyFiltersAndSort } from "./filtering";
import { DEFAULT_FILTERS, type Trader } from "./types";
import type { SmartScore } from "./metrics";

function makeTrader(overrides: Partial<Trader> & { name: string }): Trader {
  const smartScore: SmartScore = {
    tier: "Good",
    score: 50,
    percentile: 50,
    winRate: 0.5,
    profitFactor: 1.5,
    sharpeRatio: 1,
    sortinoRatio: 1,
    calmarRatio: 1,
    rSquared: 0.5,
    trendSlope: 1,
    maxDrawdown: 100,
    maxDrawdownPercent: 0.1,
    currentDrawdown: 0.01,
    stdDeviation: 0.02,
    downsideDeviation: 0.02,
    avgDailyReturn: 0.01,
    medianDailyReturn: 0.01,
    totalReturn: 1000,
    bestDay: 0.1,
    worstDay: -0.1,
    longestWinStreak: 5,
    longestLoseStreak: 3,
    winCount: 50,
    lossCount: 50,
    dataPoints: 100,
    firstDate: "2026-01-01",
    lastDate: "2026-07-14",
    calculatedAt: "2026-07-14T00:00:00Z",
    scoreBreakdown: { sortinoScore: 50, winRateScore: 50, rSquaredScore: 50, maxDrawdownScore: 50, profitFactorScore: 50 },
    ...overrides.smart_score,
  };
  return {
    rank: 1,
    wallet: "0xabc",
    additional_wallets: [],
    wallet_count: 1,
    twitter: "https://x.com/test",
    pfp: "",
    platform: "kalshi",
    polymarket_profile: "",
    kalshi_profile: "",
    kalshi_username: "",
    myriad_profile: "",
    opinion_wallet: null,
    opinion_profile: "",
    join_date: "Jan 2026",
    views: 0,
    largest_win: "0",
    affiliated: false,
    stats: { pnl: 1000, buys: 10, sells: 10 },
    deposits: 5000,
    equity_curve: [0, 100, 1000],
    ...overrides,
    smart_score: smartScore,
  };
}

describe("applyFilters", () => {
  it("filters by search substring (case-insensitive)", () => {
    const traders = [makeTrader({ name: "haon" }), makeTrader({ name: "Coby" })];
    const result = applyFilters(traders, { ...DEFAULT_FILTERS, search: "HA" });
    expect(result.map((t) => t.name)).toEqual(["haon"]);
  });

  it("hideThinSamples excludes traders below the guard-rail data point threshold", () => {
    const thin = makeTrader({ name: "thin", smart_score: { dataPoints: 5 } as SmartScore });
    const thick = makeTrader({ name: "thick", smart_score: { dataPoints: 200 } as SmartScore });
    const result = applyFilters([thin, thick], { ...DEFAULT_FILTERS, hideThinSamples: true });
    expect(result.map((t) => t.name)).toEqual(["thick"]);
  });

  it("hideThinSamples=false keeps everyone", () => {
    const thin = makeTrader({ name: "thin", smart_score: { dataPoints: 5 } as SmartScore });
    const result = applyFilters([thin], { ...DEFAULT_FILTERS, hideThinSamples: false });
    expect(result).toHaveLength(1);
  });

  it("filters by venue", () => {
    const pm = makeTrader({ name: "pm-trader", platform: "polymarket" });
    const kalshi = makeTrader({ name: "kalshi-trader", platform: "kalshi" });
    const result = applyFilters([pm, kalshi], { ...DEFAULT_FILTERS, venue: "polymarket" });
    expect(result.map((t) => t.name)).toEqual(["pm-trader"]);
  });

  it("excludes traders with no resolvable deposits from the Efficiency sort, but not from other sorts", () => {
    const noDeposits = makeTrader({ name: "kalshi-no-wallet", deposits: 0 });
    const hasDeposits = makeTrader({ name: "polymarket-wallet", deposits: 5000 });

    const onEfficiency = applyFilters([noDeposits, hasDeposits], { ...DEFAULT_FILTERS, sortKey: "returnOnCapital" });
    expect(onEfficiency.map((t) => t.name)).toEqual(["polymarket-wallet"]);

    const onScore = applyFilters([noDeposits, hasDeposits], { ...DEFAULT_FILTERS, sortKey: "score" });
    expect(onScore.map((t) => t.name).sort()).toEqual(["kalshi-no-wallet", "polymarket-wallet"]);
  });
});

describe("applySort", () => {
  it("sorts by score descending by default (efficiency-first)", () => {
    const low = makeTrader({ name: "low", smart_score: { score: 20 } as SmartScore });
    const high = makeTrader({ name: "high", smart_score: { score: 90 } as SmartScore });
    const mid = makeTrader({ name: "mid", smart_score: { score: 50 } as SmartScore });
    const result = applySort([low, high, mid], { ...DEFAULT_FILTERS, sortKey: "score", sortDir: "desc" });
    expect(result.map((t) => t.name)).toEqual(["high", "mid", "low"]);
  });

  it("sorts by raw pnl when sortKey is pnl, independent of score", () => {
    const highScoreLowPnl = makeTrader({ name: "efficient", stats: { pnl: 100, buys: 1, sells: 1 }, deposits: 500, smart_score: { score: 90 } as SmartScore });
    const lowScoreHighPnl = makeTrader({ name: "whale", stats: { pnl: 100000, buys: 1, sells: 1 }, deposits: 500000, smart_score: { score: 20 } as SmartScore });
    const result = applySort([highScoreLowPnl, lowScoreHighPnl], { ...DEFAULT_FILTERS, sortKey: "pnl", sortDir: "desc" });
    expect(result.map((t) => t.name)).toEqual(["whale", "efficient"]);
  });
});

describe("applyFiltersAndSort — the product thesis", () => {
  it("inverts the P&L ordering when sorted by efficiency: a smaller-P&L high-score trader outranks a bigger-P&L low-score whale", () => {
    const whale = makeTrader({ name: "whale", stats: { pnl: 154510, buys: 1, sells: 1 }, deposits: 900000, smart_score: { score: 66.9, dataPoints: 855 } as SmartScore });
    const sharp = makeTrader({ name: "sharp", stats: { pnl: 44751, buys: 1, sells: 1 }, deposits: 200000, smart_score: { score: 81.6, dataPoints: 220 } as SmartScore });

    const byPnl = applyFiltersAndSort([whale, sharp], { ...DEFAULT_FILTERS, sortKey: "pnl" });
    expect(byPnl[0].name).toBe("whale");

    const byScore = applyFiltersAndSort([whale, sharp], { ...DEFAULT_FILTERS, sortKey: "score" });
    expect(byScore[0].name).toBe("sharp");
  });
});
