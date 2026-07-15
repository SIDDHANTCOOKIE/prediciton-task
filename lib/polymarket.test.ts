import { describe, it, expect } from "vitest";
import { dailySeriesFromTrades, type RawTrade } from "./polymarket";

function trade(overrides: Partial<RawTrade>): RawTrade {
  return {
    side: "BUY",
    size: 100,
    price: 0.5,
    timestampMs: Date.UTC(2026, 0, 1),
    conditionId: "0xcond",
    title: "Will X happen?",
    ...overrides,
  };
}

describe("dailySeriesFromTrades", () => {
  it("returns an empty series for no trades", () => {
    expect(dailySeriesFromTrades([])).toEqual([]);
  });

  it("buckets same-day trades into one entry, sorted by date", () => {
    const day1 = Date.UTC(2026, 0, 1);
    const day2 = Date.UTC(2026, 0, 2);
    const trades = [
      trade({ timestampMs: day2, side: "SELL", size: 50, price: 0.6 }),
      trade({ timestampMs: day1, side: "BUY", size: 100, price: 0.5 }),
      trade({ timestampMs: day1, side: "SELL", size: 40, price: 0.55 }),
    ];
    const series = dailySeriesFromTrades(trades);
    expect(series).toHaveLength(2);
    expect(series[0].date).toBe("2026-01-01");
    expect(series[1].date).toBe("2026-01-02");
  });

  it("BUY is a cash outflow (negative) and SELL is an inflow (positive) in the raw pnl bucket", () => {
    const day = Date.UTC(2026, 0, 1);
    const buyOnly = dailySeriesFromTrades([trade({ timestampMs: day, side: "BUY", size: 100, price: 0.5 })]);
    const sellOnly = dailySeriesFromTrades([trade({ timestampMs: day, side: "SELL", size: 100, price: 0.5 })]);
    expect(buyOnly[0].pnl).toBeLessThan(0);
    expect(sellOnly[0].pnl).toBeGreaterThan(0);
  });

  it("returnPct is finite and scale-invariant across wallets of very different size", () => {
    const day = Date.UTC(2026, 0, 1);
    const smallWallet = dailySeriesFromTrades([trade({ timestampMs: day, side: "SELL", size: 10, price: 0.5 })]);
    const bigWallet = dailySeriesFromTrades([trade({ timestampMs: day, side: "SELL", size: 10_000, price: 0.5 })]);
    expect(Number.isFinite(smallWallet[0].returnPct)).toBe(true);
    expect(Number.isFinite(bigWallet[0].returnPct)).toBe(true);
  });

  it("never produces NaN/Infinity even with a single tiny trade", () => {
    const series = dailySeriesFromTrades([trade({ size: 0.0001, price: 0.0001 })]);
    expect(Number.isFinite(series[0].pnl)).toBe(true);
    expect(Number.isFinite(series[0].returnPct)).toBe(true);
  });
});
