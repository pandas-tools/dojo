// Railway Bucket (S3-compatible, Tigris-backed) client + helpers for lesson
// media. Single-image lessons and carousel slides land here as private
// objects under `lessons/<uuid>.<ext>`; video stays on Mux. The bucket has
// no public URL — the browser reaches an object through GET /api/media/...
// which proxy-streams the bytes through Next. See docs/architecture.md.
//
// Creds come from the bucket's Railway Variable References, wired onto the
// web service env as ASSET_BUCKET_*. URL style is read explicitly because
// Tigris returns "virtual-host" today — but the env knob keeps us portable.

import { randomUUID } from "node:crypto";
import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import type { Readable } from "node:stream";

export interface BucketConfig {
  endpoint: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  forcePathStyle: boolean;
}

export function readBucketConfig(env: NodeJS.ProcessEnv = process.env): BucketConfig {
  const endpoint = env.ASSET_BUCKET_ENDPOINT;
  const bucket = env.ASSET_BUCKET_NAME;
  const accessKeyId = env.ASSET_BUCKET_ACCESS_KEY_ID;
  const secretAccessKey = env.ASSET_BUCKET_SECRET_ACCESS_KEY;
  const region = env.ASSET_BUCKET_REGION || "auto";
  const urlStyle = (env.ASSET_BUCKET_URL_STYLE || "virtual-host").toLowerCase();

  const missing = [
    ["ASSET_BUCKET_ENDPOINT", endpoint],
    ["ASSET_BUCKET_NAME", bucket],
    ["ASSET_BUCKET_ACCESS_KEY_ID", accessKeyId],
    ["ASSET_BUCKET_SECRET_ACCESS_KEY", secretAccessKey],
  ]
    .filter(([, v]) => !v)
    .map(([k]) => k);
  if (missing.length) {
    throw new Error(
      `Railway Bucket is not configured — missing env var(s): ${missing.join(", ")}.`,
    );
  }
  if (urlStyle !== "virtual-host" && urlStyle !== "path-style") {
    throw new Error(
      `ASSET_BUCKET_URL_STYLE must be "virtual-host" or "path-style", got "${urlStyle}".`,
    );
  }

  return {
    endpoint: endpoint!,
    bucket: bucket!,
    accessKeyId: accessKeyId!,
    secretAccessKey: secretAccessKey!,
    region,
    forcePathStyle: urlStyle === "path-style",
  };
}

let _config: BucketConfig | null = null;
let _client: S3Client | null = null;

export function bucketConfig(): BucketConfig {
  return (_config ??= readBucketConfig());
}

function client(): S3Client {
  if (_client) return _client;
  const c = bucketConfig();
  _client = new S3Client({
    endpoint: c.endpoint,
    region: c.region,
    forcePathStyle: c.forcePathStyle,
    credentials: {
      accessKeyId: c.accessKeyId,
      secretAccessKey: c.secretAccessKey,
    },
  });
  return _client;
}

// --------------------------- types ------------------------------------------

export type UploadedImage = {
  /** Public-facing URL the browser will hit — proxied through /api/media. */
  url: string;
  /** Opaque object key in the bucket. Stored so we can delete later. */
  key: string;
};

// --------------------------- config -----------------------------------------

const ALLOWED_MIME = new Map<string, string>([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/gif", "gif"],
  ["image/avif", "avif"],
]);

const MAX_BYTES = 8 * 1024 * 1024;

const KEY_RE = /^lessons\/[a-z0-9][a-z0-9-]*\.(jpg|png|webp|gif|avif)$/;

// --------------------------- ops --------------------------------------------

export async function uploadLessonImage(input: {
  buffer: Buffer;
  mimeType: string;
  filename: string;
}): Promise<UploadedImage> {
  const mime = input.mimeType.toLowerCase();
  const ext = ALLOWED_MIME.get(mime);
  if (!ext) {
    throw new Error(
      `Unsupported image type ${input.mimeType}. Allowed: ${[...ALLOWED_MIME.keys()].join(", ")}`,
    );
  }
  if (input.buffer.byteLength > MAX_BYTES) {
    throw new Error(
      `Image is ${(input.buffer.byteLength / 1024 / 1024).toFixed(2)}MB, exceeds ${MAX_BYTES / 1024 / 1024}MB cap`,
    );
  }

  const key = `lessons/${randomUUID()}.${ext}`;

  await new Upload({
    client: client(),
    params: {
      Bucket: bucketConfig().bucket,
      Key: key,
      Body: input.buffer,
      ContentType: mime,
    },
  }).done();

  return {
    key,
    url: `/api/media/${key}`,
  };
}

/** Best-effort delete. Called when an admin removes an image lesson or slide. */
export async function deleteLessonImage(key: string): Promise<void> {
  if (!isValidLessonMediaKey(key)) return;
  try {
    await client().send(
      new DeleteObjectCommand({ Bucket: bucketConfig().bucket, Key: key }),
    );
  } catch (err) {
    console.warn(
      "deleteLessonImage failed (orphaned object may remain):",
      err instanceof Error ? err.message : String(err),
    );
  }
}

/** Stream a stored object back. Returns null if absent. */
export async function getLessonImage(key: string): Promise<{
  body: Readable;
  contentType: string;
  contentLength: number | undefined;
  etag: string | undefined;
} | null> {
  if (!isValidLessonMediaKey(key)) return null;
  try {
    const out = await client().send(
      new GetObjectCommand({ Bucket: bucketConfig().bucket, Key: key }),
    );
    if (!out.Body) return null;
    return {
      body: out.Body as Readable,
      contentType: out.ContentType ?? "application/octet-stream",
      contentLength: typeof out.ContentLength === "number" ? out.ContentLength : undefined,
      etag: out.ETag,
    };
  } catch (err) {
    const e = err as { name?: string; $metadata?: { httpStatusCode?: number } };
    if (
      e?.name === "NoSuchKey" ||
      e?.name === "NotFound" ||
      e?.$metadata?.httpStatusCode === 404
    ) {
      return null;
    }
    throw err;
  }
}

/** True if a string is a key we wrote — defends the proxy route from traversal. */
export function isValidLessonMediaKey(key: string): boolean {
  return KEY_RE.test(key);
}

/** Test seam. */
export function __resetMediaStorageForTests(): void {
  _config = null;
  _client = null;
}
