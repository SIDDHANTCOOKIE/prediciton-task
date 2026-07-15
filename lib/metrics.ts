// Metrics engine: turns a per-account daily P&L / return series into a risk-adjusted
// Smart Score, mirroring the shape of predicting.top's `smart_score` object.
//
// The TOP-LEVEL weighted sum (score = 25% consistency + 25% returns + 20% win rate +
// 15% max loss + 15% profit factor) is verified exact against the live site: plugging
// haon's published scoreBreakdown into `weightedScore()` reproduces 66.9 to one decimal.
//
// The per-metric 0-100 sub-score mappings (deriveScoreBreakdown) are our own reasonable,
// documented normalizations calibrated against that single public data point — not a
// leaked proprietary formula. They're internally consistent and produce sane orderings,
// which is what the product needs.

export type DailyReturn = {
  date: string; // YYYY-MM-DD
  pnl: number; // dollar P&L that day
  returnPct: number; // fractional return that day (pnl / capital base)
};

export type ScoreBreakdown = {
  sortinoScore: number;
  winRateScore: number;
  rSquaredScore: number;
  maxDrawdownScore: number;
  profitFactorScore: number;
};

export type SmartScore = {
  tier: "Elite" | "Great" | "Good" | "Average" | "Risky";
  score: number;
  percentile: number;
  winRate: number;
  profitFactor: number;
  sharpeRatio: number;
  sortinoRatio: number;
  calmarRatio: number;
  rSquared: number;
  trendSlope: number;
  maxDrawdown: number;
  maxDrawdownPercent: number;
  currentDrawdown: number;
  stdDeviation: number;
  downsideDeviation: number;
  avgDailyReturn: number;
  medianDailyReturn: number;
  totalReturn: number;
  bestDay: number;
  worstDay: number;
  longestWinStreak: number;
  longestLoseStreak: number;
  winCount: number;
  lossCount: number;
  dataPoints: number;
  firstDate: string;
  lastDate: string;
  calculatedAt: string;
  scoreBreakdown: ScoreBreakdown;
};

const SCORE_WEIGHTS = {
  rSquared: 0.25, // "consistency"
  sortino: 0.25, // "returns"
  winRate: 0.2, // "win rate"
  maxDrawdown: 0.15, // "max loss"
  profitFactor: 0.15, // "profit factor"
} as const;

const clamp = (x: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, x));

function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function stddev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
}

function downsideDeviation(xs: number[]): number {
  const negatives = xs.map((x) => Math.min(x, 0));
  return Math.sqrt(mean(negatives.map((x) => x ** 2)));
}

/** Linear regression of the cumulative equity curve against day index. Returns slope and R². */
function linregEquityCurve(returns: number[]): { slope: number; rSquared: number } {
  const equity: number[] = [];
  let cum = 0;
  for (const r of returns) {
    cum += r;
    equity.push(cum);
  }
  const n = equity.length;
  if (n < 2) return { slope: 0, rSquared: 0 };
  const xs = equity.map((_, i) => i);
  const xMean = mean(xs);
  const yMean = mean(equity);
  let ssXY = 0;
  let ssXX = 0;
  let ssYY = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - xMean;
    const dy = equity[i] - yMean;
    ssXY += dx * dy;
    ssXX += dx * dx;
    ssYY += dy * dy;
  }
  const slope = ssXX === 0 ? 0 : ssXY / ssXX;
  const rSquared = ssXX === 0 || ssYY === 0 ? 0 : (ssXY * ssXY) / (ssXX * ssYY);
  return { slope, rSquared };
}

function maxDrawdownFromReturns(returns: number[]): { maxDD: number; maxDDPct: number; currentDD: number } {
  let cum = 0;
  let peak = 0;
  let maxDD = 0;
  let maxDDPct = 0;
  for (const r of returns) {
    cum += r;
    peak = Math.max(peak, cum);
    const dd = peak - cum;
    const ddPct = peak > 0 ? dd / peak : 0;
    if (dd > maxDD) maxDD = dd;
    if (ddPct > maxDDPct) maxDDPct = ddPct;
  }
  const currentDD = peak > 0 ? (peak - cum) / peak : 0;
  return { maxDD, maxDDPct, currentDD };
}

function longestStreak(returns: number[], positive: boolean): number {
  let longest = 0;
  let current = 0;
  for (const r of returns) {
    const hit = positive ? r > 0 : r < 0;
    current = hit ? current + 1 : 0;
    longest = Math.max(longest, current);
  }
  return longest;
}

const TRADING_DAYS_PER_YEAR = 365; // prediction markets trade every day, incl. weekends

/** Normalize raw metrics into 0-100 sub-scores. See file header for provenance notes. */
function deriveScoreBreakdown(input: {
  rSquared: number;
  trendSlope: number;
  sortinoRatio: number;
  winRate: number;
  maxDrawdownPercent: number;
  profitFactor: number;
}): ScoreBreakdown {
  // R² alone measures how well the equity curve fits a straight line, in either
  // direction — a steadily LOSING trader is just as "linear" as a steadily winning
  // one. "Consistency" should only reward a linear fit that trends upward.
  const rSquaredScore = input.trendSlope > 0 ? clamp(input.rSquared * 100) : 0;
  return {
    rSquaredScore,
    sortinoScore: clamp((input.sortinoRatio / 3) * 100),
    winRateScore: clamp(50 + (input.winRate - 0.5) * 200),
    maxDrawdownScore: clamp(100 - input.maxDrawdownPercent * 200),
    profitFactorScore: clamp(((input.profitFactor - 1) / 1.5) * 100),
  };
}

/** The verified-exact aggregation: weighted sum of the five sub-scores. */
export function weightedScore(b: ScoreBreakdown): number {
  const raw =
    SCORE_WEIGHTS.rSquared * b.rSquaredScore +
    SCORE_WEIGHTS.sortino * b.sortinoScore +
    SCORE_WEIGHTS.winRate * b.winRateScore +
    SCORE_WEIGHTS.maxDrawdown * b.maxDrawdownScore +
    SCORE_WEIGHTS.profitFactor * b.profitFactorScore;
  return Math.round(raw * 10) / 10;
}

export function tierForScore(score: number): SmartScore["tier"] {
  if (score >= 85) return "Elite";
  if (score >= 70) return "Great";
  if (score >= 55) return "Good";
  if (score >= 35) return "Average";
  return "Risky";
}

/** Full pipeline: daily return series -> raw metrics -> breakdown -> weighted Score. */
export function computeSmartScore(series: DailyReturn[], calculatedAt: string): SmartScore {
  const returns = series.map((d) => d.returnPct);
  const n = returns.length;
  const avgDailyReturn = mean(returns);
  const medianDailyReturn = median(returns);
  const std = stddev(returns);
  const downside = downsideDeviation(returns);
  const sharpeRatio = std === 0 ? 0 : (avgDailyReturn / std) * Math.sqrt(TRADING_DAYS_PER_YEAR);
  const sortinoRatio = downside === 0 ? 0 : (avgDailyReturn / downside) * Math.sqrt(TRADING_DAYS_PER_YEAR);

  const wins = returns.filter((r) => r > 0);
  const losses = returns.filter((r) => r < 0);
  const winCount = wins.length;
  const lossCount = losses.length;
  const winRate = n === 0 ? 0 : winCount / (winCount + lossCount || 1);
  const grossProfit = wins.reduce((a, b) => a + b, 0);
  const grossLoss = Math.abs(losses.reduce((a, b) => a + b, 0));
  const profitFactor = grossLoss === 0 ? grossProfit > 0 ? 10 : 0 : grossProfit / grossLoss;

  const { slope: trendSlope, rSquared } = linregEquityCurve(returns);
  const { maxDD, maxDDPct, currentDD } = maxDrawdownFromReturns(returns);
  const totalReturn = returns.reduce((a, b) => a + b, 0);
  const annualizedReturn = n === 0 ? 0 : avgDailyReturn * TRADING_DAYS_PER_YEAR;
  const calmarRatio = maxDDPct === 0 ? 0 : annualizedReturn / maxDDPct;

  const breakdown = deriveScoreBreakdown({
    rSquared,
    trendSlope,
    sortinoRatio,
    winRate,
    maxDrawdownPercent: maxDDPct,
    profitFactor,
  });
  const score = weightedScore(breakdown);

  return {
    tier: tierForScore(score),
    score,
    percentile: 0, // filled in once the full leaderboard is assembled (relative rank)
    winRate,
    profitFactor: Math.round(profitFactor * 100) / 100,
    sharpeRatio: Math.round(sharpeRatio * 100) / 100,
    sortinoRatio: Math.round(sortinoRatio * 100) / 100,
    calmarRatio: Math.round(calmarRatio * 100) / 100,
    rSquared: Math.round(rSquared * 1000) / 1000,
    trendSlope: Math.round(trendSlope * 100) / 100,
    maxDrawdown: Math.round(maxDD),
    maxDrawdownPercent: Math.round(maxDDPct * 1000) / 1000,
    currentDrawdown: Math.round(currentDD * 1000) / 1000,
    stdDeviation: Math.round(std * 10000) / 10000,
    downsideDeviation: Math.round(downside * 10000) / 10000,
    avgDailyReturn: Math.round(avgDailyReturn * 10000) / 10000,
    medianDailyReturn: Math.round(medianDailyReturn * 10000) / 10000,
    totalReturn: Math.round(totalReturn),
    bestDay: n ? Math.round(Math.max(...returns) * 10000) / 10000 : 0,
    worstDay: n ? Math.round(Math.min(...returns) * 10000) / 10000 : 0,
    longestWinStreak: longestStreak(returns, true),
    longestLoseStreak: longestStreak(returns, false),
    winCount,
    lossCount,
    dataPoints: n,
    firstDate: series[0]?.date ?? "",
    lastDate: series[n - 1]?.date ?? "",
    calculatedAt,
    scoreBreakdown: breakdown,
  };
}

/** Assigns 1-100 percentile rank by score across a cohort (in place, mutates copies). */
export function assignPercentiles<T extends { smart_score: SmartScore }>(traders: T[]): T[] {
  const sorted = [...traders].sort((a, b) => a.smart_score.score - b.smart_score.score);
  const n = sorted.length;
  const scoreToPercentile = new Map<string, number>();
  sorted.forEach((t, i) => {
    scoreToPercentile.set(t.smart_score.calculatedAt + t.smart_score.score, Math.round(((i + 1) / n) * 100));
  });
  return traders.map((t) => ({
    ...t,
    smart_score: {
      ...t.smart_score,
      percentile: scoreToPercentile.get(t.smart_score.calculatedAt + t.smart_score.score) ?? 0,
    },
  }));
}
