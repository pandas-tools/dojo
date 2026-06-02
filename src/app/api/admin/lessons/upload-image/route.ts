// Multipart image upload for lesson media (image lessons + carousel slides).
// Admin-gated. Streams the bytes through this server straight into ImageKit
// — the browser never gets ImageKit credentials, the URL is generated
// server-side, and the response carries just the public URL + fileId so the
// caller can save them on a lesson translation row.
//
// Sized for the New Lesson dialog's drag-drop / picker UX on the admin side.
// One file per request keeps the form-data parsing simple; a carousel of 10
// slides = 10 sequential POSTs, which is fine at admin scale.

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { uploadLessonImage, imagekitConfigured } from "@/lib/imagekit";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  if (!imagekitConfigured()) {
    return NextResponse.json(
      {
        error:
          "Image upload is disabled — ImageKit credentials are not set on this deployment. Ask the operator to set IMAGEKIT_PUBLIC_KEY, IMAGEKIT_PRIVATE_KEY, and IMAGEKIT_URL_ENDPOINT on Railway. Video lessons are unaffected.",
      },
      { status: 503 },
    );
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

  const folder = form.get("folder");
  const folderStr = typeof folder === "string" ? folder : undefined;

  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    const result = await uploadLessonImage({
      buffer,
      mimeType: file.type || "application/octet-stream",
      filename: file.name || "image",
      folder: folderStr,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "upload failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
