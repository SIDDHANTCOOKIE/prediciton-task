import { Trader, Position, Period } from "../../../lib/types";
import { computeSmartScore } from "../../../lib/metrics";
import { dailyReturnsFromPnlCurve, PnlPoint } from "../score/reconstruct";
import { fetchJson, unwrapList, num, str } from "../util/http";
import { mapWithConcurrency } from "../util/concurrency";

const DATA_API = "https://data-api.polymarket.com";
// Confirmed live, undocumented but stable (same origin the site itself calls): real per-wallet
// cumulative daily P&L, dated. See server/src/score/reconstruct.ts's PnlPoint doc comment for the
// verification against the official all-time leaderboard figure.
const PNL_API = "https://user-pnl-api.polymarket.com";

// Confirmed live: data-api's /v1/leaderboard?timePeriod=DAY|WEEK|MONTH|ALL exactly matches
// polymarket.com/leaderboard/overall/{today|weekly|monthly|all}/profit — verified wallet-for-wallet
// and dollar-for-dollar against the live site. Caps at 50 rows regardless of `limit` (confirmed:
// limit=500 still returns 50) — LEADERBOARD_LIMIT no longer applies to Polymarket (Kalshi's own,
// differently-capped list endpoint still reads it).
const PERIOD_BOARD_LIMIT = 50;
const LEADERBOARD_PERIODS: { period: Period; timePeriod: string }[] = [
  { period: "1D", timePeriod: "DAY" },
  { period: "1W", timePeriod: "WEEK" },
  { period: "1M", timePeriod: "MONTH" },
  { period: "ALL", timePeriod: "ALL" },
];

const PERIOD_WINDOW_SECONDS: Record<Exclude<Period, "ALL">, number> = {
  "1D": 1 * 86400,
  "1W": 7 * 86400,
  "1M": 30 * 86400,
};

type BoardRow = { rank: number; name: string; wallet: string; xUsername: string; pfp: string; pnl: number; vol: number };

async function fetchPeriodBoard(timePeriod: string): Promise<BoardRow[]> {
  const url = `${DATA_API}/v1/leaderboard?category=OVERALL&timePeriod=${timePeriod}&orderBy=PNL&limit=${PERIOD_BOARD_LIMIT}`;
  const json = await fetchJson(url);
  return unwrapList(json)
    .map((row, i) => {
      const wallet = str(row.proxyWallet ?? row.wallet ?? row.address);
      return {
        rank: num(row.rank, i + 1),
        name: str(row.userName ?? row.name ?? row.username, wallet.slice(0, 8)),
        wallet,
        xUsername: str(row.xUsername ?? row.twitter),
        pfp: str(row.profileImage ?? row.pfp),
        pnl: num(row.pnl),
        vol: num(row.vol ?? row.volume),
      };
    })
    .filter((r) => r.wallet.length > 0);
}

async function fetchPnlSeries(wallet: string): Promise<PnlPoint[]> {
  try {
    const json = await fetchJson(`${PNL_API}/user-pnl?user_address=${wallet}&interval=all&fidelity=1d`);
    const rows = Array.isArray(json) ? json : [];
    return rows
      .map((r) => ({ t: num((r as { t?: unknown }).t), p: num((r as { p?: unknown }).p) }))
      .filter((pt) => Number.isFinite(pt.t) && Number.isFinite(pt.p));
  } catch {
    console.warn(`[Polymarket] Failed to fetch pnl series for ${wallet}`);
    return [];
  }
}

async function fetchPositionsFor(wallet: string): Promise<Record<string, unknown>[]> {
  try {
    const json = await fetchJson(`${DATA_API}/positions?user=${wallet}`);
    return unwrapList(json);
  } catch {
    return [];
  }
}

export async function ingestPolymarket(): Promise<{ byPeriod: Record<Period, Trader[]>; positions: Position[] }> {
  // 1. Fetch all four real period boards up front — these, not anything derived, are the source
  // of truth for who appears, and their pnl/vol.
  const boards = {} as Record<Period, BoardRow[]>;
  for (const { period, timePeriod } of LEADERBOARD_PERIODS) {
    boards[period] = await fetchPeriodBoard(timePeriod);
    console.log(`[Polymarket] ${period} board: ${boards[period].length} rows`);
  }

  // 2. Union of wallets across all four boards, keeping the first non-empty name/handle/image
  // seen for each (the leaderboard row's own fields are correct when present — confirmed live for
  // traders who've linked X — but usually empty; there's no per-wallet profile endpoint to fall
  // back to now that /activity's bio-scan is gone, so this is what's available).
  const meta = new Map<string, { name: string; xUsername: string; pfp: string }>();
  for (const period of Object.keys(boards) as Period[]) {
    for (const row of boards[period]) {
      const existing = meta.get(row.wallet);
      meta.set(row.wallet, {
        name: existing?.name || row.name,
        xUsername: existing?.xUsername || row.xUsername,
        pfp: existing?.pfp || row.pfp,
      });
    }
  }
  const wallets = [...meta.keys()];
  console.log(`[Polymarket] ${wallets.length} unique wallets across all periods.`);

  // 3. One pnl-series fetch + one positions fetch per wallet, memoized across all four periods —
  // cheaper than the old single-period /activity pagination (up to 11 pages per wallet) despite
  // now covering four boards instead of one.
  const CONCURRENCY = 5;
  const perWallet = await mapWithConcurrency(wallets, CONCURRENCY, async (wallet) => {
    const [series, positions] = await Promise.all([fetchPnlSeries(wallet), fetchPositionsFor(wallet)]);
    return { wallet, series, positions };
  });
  const byWallet = new Map(perWallet.map((r) => [r.wallet, r]));

  const nowSeconds = Math.floor(Date.now() / 1000);
  const calculatedAt = new Date().toISOString();
  const byPeriod = {} as Record<Period, Trader[]>;

  for (const period of Object.keys(boards) as Period[]) {
    const windowStart = period === "ALL" ? 0 : nowSeconds - PERIOD_WINDOW_SECONDS[period];
    byPeriod[period] = boards[period].map((row) => {
      const w = byWallet.get(row.wallet);
      const series = w ? dailyReturnsFromPnlCurve(w.series, windowStart, row.vol) : [];
      const smartScore = computeSmartScore(series, calculatedAt);

      const equityCurve: number[] = [];
      let cum = 0;
      for (const d of series) {
        cum += d.pnl;
        equityCurve.push(cum);
      }

      const m = meta.get(row.wallet);
      return {
        rank: row.rank,
        name: m?.name || row.name,
        wallet: row.wallet,
        additional_wallets: [],
        wallet_count: 1,
        twitter: m?.xUsername || "",
        pfp: m?.pfp || "",
        platform: "polymarket",
        polymarket_profile: row.wallet,
        kalshi_profile: "",
        kalshi_username: "",
        myriad_profile: "",
        opinion_wallet: null,
        opinion_profile: "",
        join_date: "",
        views: 0,
        largest_win: "0",
        affiliated: false,
        // vol is combined buy+sell dollar volume for the period, straight from the board row (not
        // split by side — Polymarket's period leaderboard doesn't expose that breakdown). Put
        // entirely on `buys` so buys+sells (lib/filtering.ts's minVolume/Efficiency denominator)
        // still equals the real total.
        stats: { pnl: row.pnl, buys: row.vol, sells: 0 },
        smart_score: smartScore,
        equity_curve: equityCurve,
        isConfident: true, // pnl/vol are the venue's own authoritative period figures, not reconstructed
      } satisfies Trader;
    });
  }

  // 4. Positions feed — every wallet appearing on the ALL board (the superset), built once rather
  // than once per period.
  const positions: Position[] = [];
  for (const row of boards.ALL) {
    const w = byWallet.get(row.wallet);
    if (!w) continue;
    const smartScore = byPeriod.ALL.find((t) => t.wallet === row.wallet)?.smart_score ?? null;
    for (const posRow of w.positions) {
      const size = num(posRow.size ?? posRow.shares, NaN);
      if (!Number.isFinite(size) || size === 0) continue;
      const avgPrice = num(posRow.avgPrice ?? posRow.averagePrice);
      const curPrice = num(posRow.curPrice ?? posRow.currentPrice ?? avgPrice);
      positions.push({
        trader: meta.get(row.wallet)?.name || row.name,
        wallet: row.wallet,
        venue: "polymarket",
        conditionId: str(posRow.conditionId ?? posRow.asset ?? posRow.market),
        marketTitle: str(posRow.title ?? posRow.question),
        side: str(posRow.outcome, "YES").toUpperCase() === "NO" ? "NO" : "YES",
        size,
        avgPrice,
        curPrice,
        currentValue: num(posRow.currentValue, size * curPrice),
        unrealizedPnl: num(posRow.cashPnl ?? posRow.pnl, size * (curPrice - avgPrice)),
        traderTier: smartScore?.tier,
        traderScore: smartScore?.score,
      });
    }
  }

  return { byPeriod, positions };
}
