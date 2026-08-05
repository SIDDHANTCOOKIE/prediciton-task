import { Agent, fetch as undiciFetch } from "undici";
import { dohLookup } from "./dns";

const FETCH_TIMEOUT_MS = 15_000;

export class ApiFetchError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "ApiFetchError";
  }
}

// One undici Agent per hostname, each using the DoH-backed lookup (server/src/util/dns.ts) so
// connections resolve around a poisoned system resolver. Cached rather than built per-request so
// connections get reused (pooled/keep-alive) instead of a fresh handshake every call — this also
// matters in practice: a fresh connection's first request was the flaky one in testing, so
// reusing pooled connections across calls avoids re-paying that cost repeatedly.
const agentByHost = new Map<string, Agent>();
function getAgent(hostname: string): Agent {
  let agent = agentByHost.get(hostname);
  if (!agent) {
    agent = new Agent({ connect: { lookup: dohLookup } });
    agentByHost.set(hostname, agent);
  }
  return agent;
}

/** Retrying JSON fetch with a browser User-Agent (Cloudflare mitigation — both Polymarket and
 *  Kalshi sit behind Cloudflare, which is more likely to block a bare Node fetch UA), a
 *  DoH-backed dispatcher (bypasses DNS poisoning), and exponential backoff on 403/429/network
 *  failure — the retries are also what ride out the intermittent reset Polymarket showed even
 *  after DNS was fixed (measured: 30/30 real requests succeeded within this retry budget at
 *  production-like concurrency). Shared by both venue ingesters. */
export async function fetchJson(url: string, retries = 3): Promise<unknown> {
  const dispatcher = getAgent(new URL(url).hostname);
  let lastErr: unknown;
  for (let i = 0; i <= retries; i++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await undiciFetch(url, {
        signal: controller.signal,
        dispatcher,
        headers: {
          accept: "application/json",
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
      });
      if (res.status === 429 || res.status === 403) {
        throw new ApiFetchError(`HTTP ${res.status}`);
      }
      if (!res.ok) {
        throw new ApiFetchError(`${url} -> HTTP ${res.status}`);
      }
      return await res.json();
    } catch (err) {
      lastErr = err;
      if (i < retries) await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, i)));
    } finally {
      clearTimeout(timer);
    }
  }
  throw new ApiFetchError(`Failed to reach ${url}`, lastErr);
}

/** Unwraps common list-response envelopes: a raw array, or {data|results|leaderboard|traders|positions:[...]}. */
export function unwrapList(json: unknown): Record<string, unknown>[] {
  if (Array.isArray(json)) return json as Record<string, unknown>[];
  if (json && typeof json === "object") {
    for (const key of ["data", "results", "leaderboard", "traders", "positions", "rankings", "users", "rank_list"]) {
      const v = (json as Record<string, unknown>)[key];
      if (Array.isArray(v)) return v as Record<string, unknown>[];
    }
  }
  return [];
}

export function num(v: unknown, fallback = 0): number {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : fallback;
}

export function str(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

const X_URL_PATTERN = /(?:https?:\/\/)?(?:www\.)?(?:x|twitter)\.com\/@?([A-Za-z0-9_]{1,15})(?:[/?#]|$)/i;

/** Neither Polymarket nor Kalshi has a dedicated "twitter handle" field — confirmed live: traders
 *  link their X account by putting an x.com/twitter.com URL in a freeform bio/description field
 *  (Kalshi: `social_profile.description`; Polymarket: `bio` on /activity rows). Extracts just the
 *  handle from that URL, or "" if the text isn't an X link. */
export function extractXHandle(text: string): string {
  return X_URL_PATTERN.exec(text)?.[1] ?? "";
}

/** Digs a value out of a possibly-nested object by trying each dotted path in order — used
 *  for fields we're not 100% sure of the shape of from an unconfirmed/undocumented API
 *  (e.g. Kalshi's social profile response), where the real field might be top-level or
 *  nested under a sub-object depending on the actual (unverified) response shape. */
export function dig(obj: unknown, paths: string[]): unknown {
  for (const path of paths) {
    let cur: unknown = obj;
    for (const key of path.split(".")) {
      if (cur && typeof cur === "object" && key in (cur as Record<string, unknown>)) {
        cur = (cur as Record<string, unknown>)[key];
      } else {
        cur = undefined;
        break;
      }
    }
    if (cur !== undefined && cur !== null && cur !== "") return cur;
  }
  return undefined;
}
