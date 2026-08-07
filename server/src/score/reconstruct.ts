import { DailyReturn } from "../../../lib/metrics";

/** One point from Polymarket's real per-wallet cumulative P&L curve
 *  (user-pnl-api.polymarket.com/user-pnl?...&fidelity=1d): `t` is Unix seconds, `p` is cumulative
 *  dollar P&L as of that day — confirmed live against swisstony (364 dated points; final value
 *  $23,066,280 vs. the official all-time leaderboard's $23,070,266, a 0.017% gap). This replaced
 *  the previous /activity-based reconstruction entirely: that path dumped all unrealized P&L plus
 *  a reconciliation residual onto the last day (fabricating e.g. a $24.8M "today" for a trader
 *  whose real Polymarket Today P&L was nowhere close), and for high-volume traders /activity's
 *  5,000-event cap meant their history collapsed to a single point. This endpoint has neither
 *  problem — one request, no pagination, no cap encountered in testing. */
export type PnlPoint = { t: number; p: number };

/** Turns a wallet's real cumulative P&L curve into a per-day return series for the given window,
 *  for feeding into computeSmartScore (which does its own cumulation internally for
 *  Sharpe/Sortino/drawdown/R² and expects deltas, not a running total).
 *
 *  `windowStart` (Unix seconds) is inclusive; pass 0 for "since the beginning" (ALL). The point
 *  immediately before the window (if any) anchors the first in-window day's delta to where the
 *  curve actually was, rather than diffing against 0 and fabricating a spike on day one of a
 *  short window. For ALL (no earlier point exists), the curve's own first point necessarily *is*
 *  the account's first day, so diffing against 0 there is correct, not an approximation.
 *
 *  `periodVolume` — that period's own dollar volume, taken from the leaderboard row itself (never
 *  derived) — is the return-pct denominator; 0 volume yields 0 returnPct for every day rather
 *  than dividing by zero. */
export function dailyReturnsFromPnlCurve(points: PnlPoint[], windowStart: number, periodVolume: number): DailyReturn[] {
  const sorted = [...points].sort((a, b) => a.t - b.t);
  const before = [...sorted].reverse().find((p) => p.t < windowStart);
  const inWindow = sorted.filter((p) => p.t >= windowStart);

  const series: DailyReturn[] = [];
  let prevCumulative = before ? before.p : 0;
  for (const point of inWindow) {
    const dayPnl = point.p - prevCumulative;
    const date = new Date(point.t * 1000).toISOString().split("T")[0];
    series.push({ date, pnl: dayPnl, returnPct: periodVolume > 0 ? dayPnl / periodVolume : 0 });
    prevCumulative = point.p;
  }
  return series;
}
