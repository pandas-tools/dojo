// Public-ish proxy that streams lesson media from the private Railway Bucket
// back to the browser. The bucket itself has no public URL — every fetch
// goes through this route. Cache headers are long+immutable because keys
// embed a uuid (objects are never overwritten in place).
//
// No auth gate today: training media is non-sensitive and keys are
// UUID-opaque. If we ever need to restrict by client, this is the seam.

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getLessonImage, isValidLessonMediaKey } from "@/lib/media-storage";

export const runtime = "nodejs";

const IMMUTABLE = "public, max-age=31536000, immutable";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  const key = path.join("/");
  if (!isValidLessonMediaKey(key)) {
    return new NextResponse("Not found", { status: 404 });
  }

  const obj = await getLessonImage(key);
  if (!obj) {
    return new NextResponse("Not found", { status: 404 });
  }

  if (obj.etag && req.headers.get("if-none-match") === obj.etag) {
    return new NextResponse(null, {
      status: 304,
      headers: { ETag: obj.etag, "Cache-Control": IMMUTABLE },
    });
  }

  const headers: Record<string, string> = {
    "Content-Type": obj.contentType,
    "Cache-Control": IMMUTABLE,
  };
  if (obj.etag) headers.ETag = obj.etag;
  if (obj.contentLength !== undefined) {
    headers["Content-Length"] = String(obj.contentLength);
  }

  return new NextResponse(obj.body as unknown as ReadableStream, {
    status: 200,
    headers,
  });
}
