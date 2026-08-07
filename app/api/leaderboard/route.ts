import { NextResponse } from "next/server";
import { assignPercentiles } from "@/lib/metrics";

// This route exists to be polled (see lib/useLiveData.ts) — Next's fetch/route caching would
// otherwise freeze responses independently of how fresh the backend's own data is.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") || "ALL";
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";
    const res = await fetch(`${backendUrl}/api/leaderboard?period=${encodeURIComponent(period)}`, {
      cache: "no-store",
    });

    if (!res.ok) {
      throw new Error(`Backend returned ${res.status}`);
    }

    const data = await res.json();
    return NextResponse.json({
      updatedAt: data.updatedAt,
      stale: data.stale,
      count: data.count,
      traders: assignPercentiles(data.traders || []),
    });
  } catch (err) {
    const message = err instanceof Error ? `Live data unavailable: ${err.message}` : "Live data unavailable: could not reach the backend.";
    return NextResponse.json({ error: message, updatedAt: null, count: 0, traders: [] }, { status: 502 });
  }
}
