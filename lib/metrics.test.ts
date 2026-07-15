import { describe, it, expect } from "vitest";
import { weightedScore, tierForScore, computeSmartScore, type DailyReturn } from "./metrics";

describe("weightedScore", () => {
  it("reproduces haon's real published score (66.9) from the live scoreBreakdown", () => {
    // Verbatim scoreBreakdown pulled from GET predicting.top/api/leaderboard for "haon" (rank 1).
    const haonBreakdown = {
      sortinoScore: 75.8,
      winRateScore: 63.8,
      rSquaredScore: 85.2,
      maxDrawdownScore: 43.1,
      profitFactorScore: 49.7,
    };
    expect(weightedScore(haonBreakdown)).toBeCloseTo(66.9, 1);
  });

  it("weights sum to 1.0 (a perfect 100 across all sub-scores yields 100)", () => {
    expect(
      weightedScore({
        sortinoScore: 100,
        winRateScore: 100,
        rSquaredScore: 100,
        maxDrawdownScore: 100,
        profitFactorScore: 100,
      })
    ).toBe(100);
  });
});

describe("tierForScore", () => {
  it("matches the live UI's color bands at known boundary points", () => {
    expect(tierForScore(66.9)).toBe("Good"); // haon, shown green
    expect(tierForScore(19.4)).toBe("Risky"); // CSP, shown red
    expect(tierForScore(46.5)).toBe("Average"); // sorcere, shown orange
    expect(tierForScore(84.1)).toBe("Great"); // Coby, shown green
  });
});

describe("computeSmartScore end-to-end", () => {
  function makeSeries(returns: number[]): DailyReturn[] {
    return returns.map((r, i) => ({
      date: `2026-01-${String(i + 1).padStart(2, "0")}`,
      pnl: r * 1000,
      returnPct: r,
    }));
  }

  it("a steadily-winning low-volatility trader scores much higher than an erratic one with equal total return", () => {
    const steady = makeSeries(Array.from({ length: 60 }, () => 0.01));
    const erratic = makeSeries(
      Array.from({ length: 60 }, (_, i) => (i % 2 === 0 ? 0.25 : -0.23))
    );
    const steadyScore = computeSmartScore(steady, "2026-07-14T00:00:00Z").score;
    const erraticScore = computeSmartScore(erratic, "2026-07-14T00:00:00Z").score;
    expect(steadyScore).toBeGreaterThan(erraticScore);
  });

  it("dataPoints reflects the series length (used for the sample-size guard rail)", () => {
    const series = makeSeries(Array.from({ length: 10 }, () => 0.01));
    expect(computeSmartScore(series, "2026-07-14T00:00:00Z").dataPoints).toBe(10);
  });

  it("handles an all-losing series without NaN/Infinity", () => {
    const series = makeSeries(Array.from({ length: 20 }, () => -0.02));
    const s = computeSmartScore(series, "2026-07-14T00:00:00Z");
    expect(Number.isFinite(s.score)).toBe(true);
    expect(Number.isFinite(s.sortinoRatio)).toBe(true);
    expect(s.winRate).toBe(0);
  });

  it("handles an empty series without throwing", () => {
    const s = computeSmartScore([], "2026-07-14T00:00:00Z");
    expect(s.dataPoints).toBe(0);
    expect(Number.isFinite(s.score)).toBe(true);
  });
});
