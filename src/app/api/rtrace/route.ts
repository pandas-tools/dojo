import { NextResponse } from "next/server";

// TEMPORARY diagnostic beacon sink for the reels reload investigation.
// The ReelsProbe overlay (activated by ?reeldebug) POSTs a captured Safari
// timeline here; GET returns everything collected. In-memory ring buffer —
// fine for a throwaway preview. REMOVE with the ReelsProbe instrumentation.
export const dynamic = "force-dynamic";

const buf: unknown[] = [];

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      ua?: string;
      w?: number;
      partial?: boolean;
      trace?: Array<Record<string, unknown>>;
      events?: unknown[];
    };
    const at = new Date().toISOString();
    buf.push({ at, ...body });
    while (buf.length > 50) buf.shift();

    // Durable capture: the in-memory ring buffer above dies with the process —
    // a preview OOM/restart already wiped a full round of real failing traces
    // once. stdout is persisted by Railway independently of process life, so
    // mirror every beacon to the log. Split across two tagged lines (cause
    // events vs the scroll timeline) so neither is lost to per-line truncation;
    // stitch them back together by `id`. REMOVE with the rest of the probe.
    const id = `${at}-w${body.w ?? "?"}${body.partial ? "-p" : ""}`;
    const st = (body.trace ?? []).map((r) => [
      r.t,
      r.st,
      r.centerIdx,
      r.activeIdx,
    ]);
    console.log(`RTRACE-EV ${id} ${JSON.stringify(body.events ?? [])}`);
    console.log(`RTRACE-ST ${id} ${JSON.stringify(st)}`);
  } catch {
    // ignore malformed beacons
  }
  return NextResponse.json({ ok: true });
}

export async function GET() {
  return NextResponse.json({ count: buf.length, traces: buf });
}
