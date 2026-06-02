// Thin wrapper around the ImageKit Node SDK. Used to upload image lesson
// media (single-image lessons + carousel slides) into the shared Pandas
// ImageKit account under a /dojo/lessons/<lesson-id-or-temp>/ prefix.
//
// Uploads go through this server-side helper, NOT direct-to-CDN from the
// browser, so the private key never leaves the host. The admin UI POSTs a
// multipart file to /api/admin/lessons/upload-image; the route hands the
// bytes here, gets back a URL + fileId, and stores the URL on the lesson
// translation row.

import ImageKit from "imagekit";
import { env } from "./env";

let cached: ImageKit | null = null;

export function imagekitConfigured(): boolean {
  const e = env();
  return (
    !!e.IMAGEKIT_PUBLIC_KEY &&
    !!e.IMAGEKIT_PRIVATE_KEY &&
    !!e.IMAGEKIT_URL_ENDPOINT
  );
}

function client(): ImageKit {
  if (cached) return cached;
  const e = env();
  if (
    !e.IMAGEKIT_PUBLIC_KEY ||
    !e.IMAGEKIT_PRIVATE_KEY ||
    !e.IMAGEKIT_URL_ENDPOINT
  ) {
    throw new Error(
      "ImageKit not configured. Set IMAGEKIT_PUBLIC_KEY, IMAGEKIT_PRIVATE_KEY, IMAGEKIT_URL_ENDPOINT on Railway.",
    );
  }
  cached = new ImageKit({
    publicKey: e.IMAGEKIT_PUBLIC_KEY,
    privateKey: e.IMAGEKIT_PRIVATE_KEY,
    urlEndpoint: e.IMAGEKIT_URL_ENDPOINT,
  });
  return cached;
}

export type UploadedImage = {
  url: string;
  fileId: string;
  width: number | null;
  height: number | null;
};

const FOLDER_PREFIX = "/dojo/lessons";

const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB per slide. Generous for designed PNG cards.

export async function uploadLessonImage(input: {
  // Raw bytes from the multipart upload.
  buffer: Buffer;
  // MIME from the client; we re-check here.
  mimeType: string;
  // Original filename; ImageKit uses it as a hint for extension + admin
  // listing. Stripped to safe chars.
  filename: string;
  // Optional folder suffix — e.g. lessonId or "temp/<uuid>" while still
  // pre-create.
  folder?: string;
}): Promise<UploadedImage> {
  if (!ALLOWED_MIME.has(input.mimeType.toLowerCase())) {
    throw new Error(
      `Unsupported image type ${input.mimeType}. Allowed: ${[...ALLOWED_MIME].join(", ")}`,
    );
  }
  if (input.buffer.byteLength > MAX_BYTES) {
    throw new Error(
      `Image is ${(input.buffer.byteLength / 1024 / 1024).toFixed(2)}MB, exceeds ${MAX_BYTES / 1024 / 1024}MB cap`,
    );
  }

  const safeName = input.filename
    .replace(/[^\w.-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80) || "image";

  const folder = input.folder
    ? `${FOLDER_PREFIX}/${input.folder.replace(/[^\w./-]+/g, "_")}`
    : `${FOLDER_PREFIX}/uncategorised`;

  const res = await client().upload({
    file: input.buffer,
    fileName: safeName,
    folder,
    useUniqueFileName: true,
  });

  return {
    url: res.url,
    fileId: res.fileId,
    width: typeof res.width === "number" ? res.width : null,
    height: typeof res.height === "number" ? res.height : null,
  };
}

// Best-effort delete. Called when an admin removes an image lesson or a
// carousel slide. Swallows errors so admin write paths don't fail on a
// dangling-orphan upload.
export async function deleteLessonImage(fileId: string): Promise<void> {
  try {
    await client().deleteFile(fileId);
  } catch (err) {
    console.warn(
      "imagekit deleteFile failed (orphaned asset may remain):",
      err instanceof Error ? err.message : String(err),
    );
  }
}
