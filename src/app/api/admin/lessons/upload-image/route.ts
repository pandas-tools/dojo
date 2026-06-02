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

  try {
    const result = await uploadLessonImage({
      buffer,
      mimeType: file.type || "application/octet-stream",
      filename: file.name || "image",
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "upload failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
