import { Trader, Position } from "../../../lib/types";
import { computeSmartScore } from "../../../lib/metrics";
import { reconstructEquityCurve, computePeriodPnl } from "../score/reconstruct";
import { fetchJson, unwrapList, num, str, extractXHandle } from "../util/http";
import { mapWithConcurrency } from "../util/concurrency";

const DATA_API = "https://data-api.polymarket.com";

// Confirmed live: /activity defaults to only 100 events with no params, and silently caps at 500
// even when a higher limit is requested — there is no way to get "everything" in one call, so we
// paginate with offset. But there's a second, harder limit: the API itself rejects any offset
// beyond 5000 with {"error":"max historical activity offset of 5000 exceeded"} — confirmed live
// against a $22M-PnL wallet, whose full 5500-event history covered only ~3.5 weeks. This is a
// genuine platform ceiling, not something more pagination can work around: for a
// high-frequency/veteran trader, their full lifetime history is simply not retrievable through
// this public endpoint. MAX_ACTIVITY_PAGES stops one page short of that wall so we never issue
// the guaranteed-400 request (which would otherwise burn fetchJson's full retry/backoff budget
// for nothing). Early-exits once the accumulated history already reconciles with the
// leaderboard's authoritative PnL, which is the common case for less active traders.
const ACTIVITY_PAGE_SIZE = 500;
const MAX_HISTORICAL_OFFSET = 5000; // confirmed hard ceiling — do not raise without re-verifying
const MAX_ACTIVITY_PAGES = MAX_HISTORICAL_OFFSET / ACTIVITY_PAGE_SIZE + 1; // offsets 0..5000 inclusive

async function fetchAllActivity(
  wallet: string,
  positions: any[],
  leaderboardPnl: number
): Promise<{ activities: any[]; historyTruncated: boolean }> {
  const all: any[] = [];
  for (let page = 0; page < MAX_ACTIVITY_PAGES; page++) {
    const offset = page * ACTIVITY_PAGE_SIZE;
    let batch: any[];
    try {
      const json = await fetchJson(`${DATA_API}/activity?user=${wallet}&limit=${ACTIVITY_PAGE_SIZE}&offset=${offset}`);
      batch = unwrapList(json);
    } catch {
      // Keep whatever's accumulated so far rather than failing the whole wallet. Reaching here
      // before the page cap (rather than via the cap itself) means a transient failure, not the
      // confirmed offset ceiling — still surfaced as truncated since we don't have full history.
      return { activities: all, historyTruncated: true };
    }
    all.push(...batch);

    // Early exit: once the accumulated history already reconciles with the venue's authoritative
    // PnL, more pages can't improve accuracy — stop rather than keep paginating unnecessarily.
    if (reconstructEquityCurve(all, positions, leaderboardPnl).isConfident) {
      return { activities: all, historyTruncated: false };
    }

    if (batch.length < ACTIVITY_PAGE_SIZE) {
      return { activities: all, historyTruncated: false }; // fewer than a full page = true end of history
    }
  }
  // Hit the page cap without reconciling — this trader's full lifetime history exceeds what
  // Polymarket's public API exposes (see header comment). Not a bug; a disclosed data limitation.
  return { activities: all, historyTruncated: true };
}

export async function ingestPolymarket(): Promise<{ traders: Trader[]; positions: Position[] }> {
  const limit = process.env.LEADERBOARD_LIMIT ? parseInt(process.env.LEADERBOARD_LIMIT, 10) : 100;
  const url = `${DATA_API}/v1/leaderboard?category=OVERALL&timePeriod=ALL&orderBy=PNL&limit=${limit}`;

  console.log(`[Polymarket] Fetching leaderboard from ${url}`);
  const json = await fetchJson(url);
  const rows = unwrapList(json);

  const baseTraders = rows
    .map((row, i) => {
      const pnl = num(row.pnl);
      const wallet = str(row.proxyWallet ?? row.wallet ?? row.address);
      return {
        rank: num(row.rank, i + 1),
        name: str(row.userName ?? row.name ?? row.username, wallet.slice(0, 8)),
        wallet,
        xUsername: str(row.xUsername ?? row.twitter),
        pfp: str(row.profileImage ?? row.pfp),
        pnl,
        vol: num(row.vol ?? row.volume),
      };
    })
    .filter((t) => t.wallet && t.wallet.length > 0);

  console.log(`[Polymarket] Fetched ${baseTraders.length} base traders. Enhancing with history...`);

  const CONCURRENCY = 5;
  const perTrader = await mapWithConcurrency(baseTraders, CONCURRENCY, async (base) => {
    // 1. Fetch positions first — needed up front so activity pagination can check reconciliation
    // (which requires unrealized P&L from positions) after every page, not just at the end.
    // Also reused below (step 5) to build the Positions-page feed, so we don't re-fetch per venue.
    let positions: any[] = [];
    try {
      const posJson = await fetchJson(`${DATA_API}/positions?user=${base.wallet}`);
      positions = unwrapList(posJson);
    } catch (e) {
      console.warn(`[Polymarket] Failed to fetch positions for ${base.wallet}`);
    }

    // 2. Fetch activity, paginating until it reconciles with the leaderboard's PnL or the page
    // cap is hit — see fetchAllActivity's header comment for why this replaced a single call.
    const { activities, historyTruncated } = await fetchAllActivity(base.wallet, positions, base.pnl);

    // The leaderboard row's own xUsername/profileImage are correct when present (confirmed live:
    // populated for traders who've actually linked X), but empty for most traders who haven't.
    // Neither Polymarket nor Kalshi has a dedicated handle field otherwise — traders paste an
    // x.com URL into a freeform bio instead, which /activity rows carry per-event. Fall back to
    // scanning already-fetched activity for one, rather than a second request.
    let twitter = base.xUsername;
    let pfp = base.pfp;
    if (!twitter || !pfp) {
      for (const act of activities) {
        if (!twitter) {
          const found = extractXHandle(str(act.bio));
          if (found) twitter = found;
        }
        if (!pfp) {
          const img = str(act.profileImage ?? act.profileImageOptimized);
          if (img) pfp = img;
        }
        if (twitter && pfp) break;
      }
    }

    // 3. Reconstruct
    const { series, equityCurve, deposits, buyVolume, sellVolume, isConfident } = reconstructEquityCurve(
      activities,
      positions,
      base.pnl
    );

    // 4. Compute Smart Score
    const smartScore = computeSmartScore(series, new Date().toISOString());

    // 5. Period P&L (1D/1W/1M/YTD), for the leaderboard's Period filter — see
    // server/src/score/reconstruct.ts's computePeriodPnl for why this is real, not fabricated.
    const periodPnl = computePeriodPnl(series);

    const t: Trader = {
      rank: base.rank,
      name: base.name,
      wallet: base.wallet,
      additional_wallets: [],
      wallet_count: 1,
      twitter,
      pfp,
      platform: "polymarket",
      polymarket_profile: base.wallet,
      kalshi_profile: "",
      kalshi_username: "",
      myriad_profile: "",
      opinion_wallet: null,
      opinion_profile: "",
      join_date: "",
      views: 0,
      largest_win: "0",
      affiliated: false,
      stats: {
        pnl: base.pnl,
        // Dollar volume by side (not trade counts) — matches how lib/filtering.ts's
        // minVolume filter treats buys+sells as total traded volume.
        buys: buyVolume,
        sells: sellVolume,
      },
      deposits,
      smart_score: smartScore,
      equity_curve: equityCurve,
      isConfident,
      // Only meaningful when isConfident is false — see the Trader type's doc comment.
      historyTruncated: !isConfident && historyTruncated,
      periodPnl,
    };

    // 6. Map this wallet's raw positions into the Positions-page shape (matches the mapping
    // app/api/positions/route.ts used to do client-request-time; done here instead so the
    // positions feed is served from the same DB snapshot as the leaderboard rather than a
    // separate live Vercel-side fetch). Skips zero-size rows the same way lib/polymarket.ts did.
    const tradedPositions: Position[] = positions
      .map((row: any): Position | null => {
        const size = num(row.size ?? row.shares, NaN);
        if (!Number.isFinite(size) || size === 0) return null;
        const avgPrice = num(row.avgPrice ?? row.averagePrice);
        const curPrice = num(row.curPrice ?? row.currentPrice ?? avgPrice);
        return {
          trader: base.name,
          wallet: base.wallet,
          venue: "polymarket",
          conditionId: str(row.conditionId ?? row.asset ?? row.market),
          marketTitle: str(row.title ?? row.question),
          side: str(row.outcome, "YES").toUpperCase() === "NO" ? "NO" : "YES",
          size,
          avgPrice,
          curPrice,
          currentValue: num(row.currentValue, size * curPrice),
          unrealizedPnl: num(row.cashPnl ?? row.pnl, size * (curPrice - avgPrice)),
          traderTier: smartScore.tier,
          traderScore: smartScore.score,
        };
      })
      .filter((p: Position | null): p is Position => p !== null);

    return { trader: t, positions: tradedPositions };
  });

  return {
    traders: perTrader.map((r) => r.trader),
    positions: perTrader.flatMap((r) => r.positions),
  };
}
