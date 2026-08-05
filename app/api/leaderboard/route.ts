import { NextResponse } from "next/server";
import { assignPercentiles } from "@/lib/metrics";

export async function GET() {
  try {
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";
    const res = await fetch(`${backendUrl}/api/leaderboard`, {
      next: { revalidate: 60 } // optional Next.js cache
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
