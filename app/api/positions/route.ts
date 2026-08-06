import { NextResponse } from "next/server";

// See app/api/leaderboard/route.ts — same reasoning, this route is polled by lib/useLiveData.ts.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";
    const res = await fetch(`${backendUrl}/api/positions`, {
      cache: "no-store", // always hit the backend fresh — see app/api/leaderboard/route.ts
    });

    if (!res.ok) {
      throw new Error(`Backend returned ${res.status}`);
    }

    const data = await res.json();
    return NextResponse.json({
      updatedAt: data.updatedAt,
      stale: data.stale,
      count: data.count,
      positions: data.positions || [],
    });
  } catch (err) {
    const message = err instanceof Error ? `Live data unavailable: ${err.message}` : "Live data unavailable: could not reach the backend.";
    return NextResponse.json({ error: message, updatedAt: null, count: 0, positions: [] }, { status: 502 });
  }
}
