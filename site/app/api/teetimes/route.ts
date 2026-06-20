import { NextRequest, NextResponse } from "next/server";
import { fetchAllTeetimes } from "@/lib/kenna";

// Use Node.js runtime — OpenNext for Cloudflare bundles edge-runtime routes
// into a separate Worker, which complicates the build. The Kenna API fetch
// works identically on Node runtime.
export const runtime = "nodejs";
// Cache at the edge for 60s, allow stale-while-revalidate for 5min.
export const revalidate = 60;

export async function GET(req: NextRequest) {
  const days = Number(req.nextUrl.searchParams.get("days") ?? "3");
  const course = req.nextUrl.searchParams.get("course") ?? "all";
  const maxFee = req.nextUrl.searchParams.get("maxFee"); // dollars
  const timeOfDay = req.nextUrl.searchParams.get("timeOfDay"); // morning|afternoon|evening
  const openOnly = req.nextUrl.searchParams.get("openOnly") === "1";

  try {
    const result = await fetchAllTeetimes({ days });
    let items = result.teetimes;

    if (course !== "all") {
      items = items.filter((t) => t.courseId === course);
    }
    if (maxFee) {
      const maxCents = Number(maxFee) * 100;
      items = items.filter((t) => t.feeCents == null || t.feeCents <= maxCents);
    }
    if (timeOfDay) {
      items = items.filter((t) => {
        // Extract hour from isoLocal like "2026-06-21 06:47"
        const m = t.startLocal.match(/(\d{2}):(\d{2})/);
        if (!m) return false;
        const hour = Number(m[1]);
        if (timeOfDay === "morning") return hour >= 5 && hour < 12;
        if (timeOfDay === "afternoon") return hour >= 12 && hour < 17;
        if (timeOfDay === "evening") return hour >= 17 && hour <= 23;
        return true;
      });
    }
    if (openOnly) {
      items = items.filter((t) => t.isOpen);
    }

    return NextResponse.json(
      {
        ok: true,
        fetchedAt: result.fetchedAt,
        daysRequested: result.daysRequested,
        count: items.length,
        items,
        fetchErrors: result.fetchErrors,
      },
      { headers: { "cache-control": "public, max-age=30, s-maxage=60, stale-while-revalidate=300" } }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}