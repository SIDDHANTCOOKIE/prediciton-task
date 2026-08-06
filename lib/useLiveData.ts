"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const POLL_MS = 30_000;

/** Polls `url` for live data: fetches once on mount, then every 30s, plus immediately on tab
 *  focus and on regaining network (so a backgrounded tab is current the instant it's looked at
 *  again rather than waiting out the rest of the interval). `cache: "no-store"` — Next's fetch
 *  cache would otherwise freeze responses independently of how fresh the backend's own data is.
 *
 *  A failed poll sets `error` but deliberately does NOT clear `data` — the last good snapshot
 *  stays on screen with a soft error banner. The caller only needs to treat this as a hard
 *  failure (blank state) when `data` has never been populated. Shared by app/page.tsx and
 *  app/positions/page.tsx, which previously each fetched once in a `useEffect` with `[]` deps and
 *  then sat frozen for the lifetime of the tab. */
export function useLiveData<T extends { error?: string }>(url: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const inFlight = useRef(false);

  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setIsRefreshing(true);
    try {
      const res = await fetch(url, { cache: "no-store" });
      const json: T = await res.json();
      if (!res.ok || json.error) throw new Error(json.error ?? `Live data request failed (HTTP ${res.status})`);
      setData(json);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load live data");
    } finally {
      inFlight.current = false;
      setIsRefreshing(false);
    }
  }, [url]);

  useEffect(() => {
    // Deferred via queueMicrotask rather than called synchronously — react-hooks/set-state-in-effect
    // flags a direct setState-triggering call in the effect body as a cascading-render risk even
    // though `refresh` is itself async; queueing it steps outside the synchronous commit.
    queueMicrotask(refresh);
    const interval = setInterval(refresh, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    const onOnline = () => refresh();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onOnline);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
    };
  }, [refresh]);

  return { data, error, isRefreshing, refresh };
}
