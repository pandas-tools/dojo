import { NextResponse } from "next/server";

// TEMPORARY diagnostic beacon sink for the reels reload investigation.
// The ReelsProbe overlay (activated by ?reeldebug) POSTs a captured Safari
// timeline here; GET returns everything collected. In-memory ring buffer —
// fine for a throwaway preview. REMOVE with the ReelsProbe instrumentation.
export const dynamic = "force-dynamic";

const buf: unknown[] = [];

export async function POST(req: Request) {
  try {
    const body = await req.json();
    buf.push({ at: new Date().toISOString(), ...body });
    while (buf.length > 50) buf.shift();
  } catch {
    // ignore malformed beacons
  }
  return NextResponse.json({ ok: true });
}

export async function GET() {
  return NextResponse.json({ count: buf.length, traces: buf });
}
