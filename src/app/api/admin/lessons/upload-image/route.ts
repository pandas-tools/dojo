// Multipart image upload for lesson media (image lessons + carousel slides).
// Admin-gated. Streams the bytes through this server into the Railway Bucket
// — the browser never gets bucket credentials, the URL is generated
// server-side, and the response carries just the proxy URL + key so the
// caller can save the URL on a lesson translation row.
//
// Sized for the New Lesson dialog's drag-drop / picker UX on the admin side.
// One file per request keeps the form-data parsing simple; a carousel of 10
// slides = 10 sequential POSTs, which is fine at admin scale.

import { NextResponse } from "next/server";
import { imageSize } from "image-size";
import { auth } from "@/lib/auth";
import { uploadLessonImage } from "@/lib/media-storage";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "Body must be multipart/form-data with a `file` part." },
      { status: 400 },
    );
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "Missing `file` part." },
      { status: 400 },
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  // Read dimensions from the image header. Used by the lesson-creation
  // actions to populate aspectRatio on the translation row — the Reels +
  // Library viewers lean on it to flex their containers without a probe
  // at view time. Best-effort: if the header isn't parseable (rare for
  // standard JPEG/PNG/WebP/GIF/AVIF) we ship without dims; callers must
  // tolerate the missing values.
  let width: number | null = null;
  let height: number | null = null;
  try {
    const dim = imageSize(buffer);
    if (typeof dim.width === "number" && typeof dim.height === "number") {
      width = dim.width;
      height = dim.height;
    }
  } catch {
    // swallow — dims are optional metadata
  }

  try {
    const result = await uploadLessonImage({
      buffer,
      mimeType: file.type || "application/octet-stream",
      filename: file.name || "image",
    });
    return NextResponse.json({
      ok: true,
      ...result,
      width,
      height,
      aspectRatio: width && height ? width / height : null,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "upload failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
