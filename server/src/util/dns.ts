// DNS-over-HTTPS resolver, used to route around DNS poisoning/hijacking on networks where the
// system resolver returns a sinkhole IP for Polymarket/Kalshi (observed: both resolved to the
// same 49.44.79.236 via the system resolver here, while Cloudflare DoH returned their real IPs).
// This is a no-op in production — it just resolves to the SAME correct IP a clean network's
// resolver would give, so there's no behavior difference except on a poisoned network.
//
// Note: `dns.setServers()` does NOT fix this — that only affects `dns.resolve*()`, not the
// `dns.lookup()`/getaddrinfo path that `fetch`/undici actually use during connect. A custom
// `lookup` passed into an undici Agent's `connect` options is what's actually needed (verified
// in this session: setServers alone still timed out; a custom lookup succeeded).

import dns from "node:dns";

const DOH_ENDPOINT = "https://cloudflare-dns.com/dns-query";
const DOH_TIMEOUT_MS = 5_000;
const DEFAULT_TTL_MS = 60_000; // fallback cache time if DoH doesn't return a usable TTL

type CacheEntry = { address: string; expiresAt: number };
const cache = new Map<string, CacheEntry>();

async function resolveViaDoH(hostname: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DOH_TIMEOUT_MS);
  try {
    const res = await fetch(`${DOH_ENDPOINT}?name=${encodeURIComponent(hostname)}&type=A`, {
      headers: { accept: "application/dns-json" },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { Answer?: { type: number; data: string; TTL?: number }[] };
    const answer = json.Answer?.find((a) => a.type === 1); // type 1 = A record
    if (!answer) return null;
    cache.set(hostname, { address: answer.data, expiresAt: Date.now() + (answer.TTL ?? 60) * 1000 });
    return answer.data;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function resolveViaNodeDns(hostname: string): Promise<string | null> {
  try {
    const { address } = await dns.promises.lookup(hostname, { family: 4 });
    return address;
  } catch {
    return null;
  }
}

/** Resolves a hostname to an IPv4 address, preferring DoH (bypasses a poisoned system resolver)
 *  and falling back to Node's normal resolution if DoH itself is unreachable — so a DoH outage
 *  can't harden into a total outage. Cached in-memory per hostname honoring the DoH TTL. */
export async function resolveAddress(hostname: string): Promise<string> {
  const cached = cache.get(hostname);
  if (cached && cached.expiresAt > Date.now()) return cached.address;

  const viaDoH = await resolveViaDoH(hostname);
  if (viaDoH) return viaDoH;

  const viaNode = await resolveViaNodeDns(hostname);
  if (viaNode) {
    cache.set(hostname, { address: viaNode, expiresAt: Date.now() + DEFAULT_TTL_MS });
    return viaNode;
  }

  throw new Error(`Could not resolve ${hostname} via DoH or the system resolver`);
}

/** Node/undici dns.lookup-compatible callback, backed by resolveAddress. Handles both call
 *  shapes undici's connector uses: opts.all -> array of {address, family}; otherwise ->
 *  single (err, address, family). Getting this wrong produces a cryptic
 *  "Invalid IP address: undefined" rather than a clear error (hit this while testing). */
export function dohLookup(hostname: string, opts: { all?: boolean } | undefined, cb: (...args: any[]) => void): void {
  resolveAddress(hostname)
    .then((address) => {
      if (opts?.all) cb(null, [{ address, family: 4 }]);
      else cb(null, address, 4);
    })
    .catch((err) => cb(err));
}
