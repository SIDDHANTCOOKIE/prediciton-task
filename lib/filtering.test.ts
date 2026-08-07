import { describe, it, expect } from "vitest";
import { applyFilters, applySort, applyFiltersAndSort } from "./filtering";
import { DEFAULT_FILTERS, type Trader } from "./types";
import type { SmartScore } from "./metrics";

function makeTrader(overrides: Partial<Trader> & { name: string }): Trader {
  const smartScoreOverride = overrides.smart_score;
  const smartScore: SmartScore | null =
    smartScoreOverride === null
      ? null
      : {
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
          ...smartScoreOverride,
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

  it("excludes traders with no recorded volume from the Efficiency sort, but not from other sorts", () => {
    const noVolume = makeTrader({ name: "no-volume", stats: { pnl: 1000, buys: 0, sells: 0 } });
    const hasVolume = makeTrader({ name: "has-volume", stats: { pnl: 1000, buys: 10, sells: 10 } });

    const onEfficiency = applyFilters([noVolume, hasVolume], { ...DEFAULT_FILTERS, sortKey: "returnOnCapital" });
    expect(onEfficiency.map((t) => t.name)).toEqual(["has-volume"]);

    const onScore = applyFilters([noVolume, hasVolume], { ...DEFAULT_FILTERS, sortKey: "score" });
    expect(onScore.map((t) => t.name).sort()).toEqual(["has-volume", "no-volume"]);
  });

  it("a null score (too little history in the selected period) isn't excluded by default score/ratio filters", () => {
    const unscored = makeTrader({ name: "unscored", smart_score: null });
    const result = applyFilters([unscored], DEFAULT_FILTERS);
    expect(result.map((t) => t.name)).toEqual(["unscored"]);
  });

  it("a null score IS excluded once the user actively raises minScore, since it can't prove it clears the bar", () => {
    const unscored = makeTrader({ name: "unscored", smart_score: null });
    const scored = makeTrader({ name: "scored", smart_score: { score: 80 } as SmartScore });
    const result = applyFilters([unscored, scored], { ...DEFAULT_FILTERS, minScore: 50 });
    expect(result.map((t) => t.name)).toEqual(["scored"]);
  });

  it("a null score is excluded by an explicit tier filter (it has no tier to match)", () => {
    const unscored = makeTrader({ name: "unscored", smart_score: null });
    const result = applyFilters([unscored], { ...DEFAULT_FILTERS, tiers: ["Elite"] });
    expect(result).toHaveLength(0);
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

  it("sorts a null score last, regardless of direction", () => {
    const unscored = makeTrader({ name: "unscored", smart_score: null });
    const scored = makeTrader({ name: "scored", smart_score: { score: 10 } as SmartScore });
    const desc = applySort([unscored, scored], { ...DEFAULT_FILTERS, sortKey: "score", sortDir: "desc" });
    expect(desc.map((t) => t.name)).toEqual(["scored", "unscored"]);
    const asc = applySort([unscored, scored], { ...DEFAULT_FILTERS, sortKey: "score", sortDir: "asc" });
    expect(asc.map((t) => t.name)).toEqual(["unscored", "scored"]);
  });

  it("sorts by raw pnl when sortKey is pnl, independent of score", () => {
    const highScoreLowPnl = makeTrader({ name: "efficient", stats: { pnl: 100, buys: 1, sells: 1 }, smart_score: { score: 90 } as SmartScore });
    const lowScoreHighPnl = makeTrader({ name: "whale", stats: { pnl: 100000, buys: 1, sells: 1 }, smart_score: { score: 20 } as SmartScore });
    const result = applySort([highScoreLowPnl, lowScoreHighPnl], { ...DEFAULT_FILTERS, sortKey: "pnl", sortDir: "desc" });
    expect(result.map((t) => t.name)).toEqual(["whale", "efficient"]);
  });

  it("pnl sort works even for an unscored trader — P&L is always real, independent of score", () => {
    const unscored = makeTrader({ name: "unscored", stats: { pnl: 500000, buys: 1, sells: 1 }, smart_score: null });
    const scored = makeTrader({ name: "scored", stats: { pnl: 100, buys: 1, sells: 1 }, smart_score: { score: 90 } as SmartScore });
    const result = applySort([scored, unscored], { ...DEFAULT_FILTERS, sortKey: "pnl", sortDir: "desc" });
    expect(result.map((t) => t.name)).toEqual(["unscored", "scored"]);
  });
});

describe("applyFiltersAndSort — the product thesis", () => {
  it("inverts the P&L ordering when sorted by efficiency: a smaller-P&L high-score trader outranks a bigger-P&L low-score whale", () => {
    const whale = makeTrader({ name: "whale", stats: { pnl: 154510, buys: 900000, sells: 0 }, smart_score: { score: 66.9, dataPoints: 855 } as SmartScore });
    const sharp = makeTrader({ name: "sharp", stats: { pnl: 44751, buys: 200000, sells: 0 }, smart_score: { score: 81.6, dataPoints: 220 } as SmartScore });

    const byPnl = applyFiltersAndSort([whale, sharp], { ...DEFAULT_FILTERS, sortKey: "pnl" });
    expect(byPnl[0].name).toBe("whale");

    const byScore = applyFiltersAndSort([whale, sharp], { ...DEFAULT_FILTERS, sortKey: "score" });
    expect(byScore[0].name).toBe("sharp");
  });
});
