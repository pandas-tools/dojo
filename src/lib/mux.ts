import Mux from "@mux/mux-node";
import crypto from "node:crypto";

type MuxLanguageCode =
  | "en"
  | "es"
  | "it"
  | "pt"
  | "de"
  | "fr"
  | "pl"
  | "ru"
  | "nl"
  | "ca"
  | "tr"
  | "sv"
  | "uk"
  | "no"
  | "fi"
  | "sk"
  | "el"
  | "cs"
  | "hr"
  | "da"
  | "ro"
  | "bg";

declare global {
  // eslint-disable-next-line no-var
  var __dojo_mux: Mux | undefined;
}

function getMux(): Mux {
  if (global.__dojo_mux) return global.__dojo_mux;
  const tokenId = process.env.MUX_TOKEN_ID;
  const tokenSecret = process.env.MUX_TOKEN_SECRET;
  if (!tokenId || !tokenSecret) {
    throw new Error("MUX_TOKEN_ID / MUX_TOKEN_SECRET not set");
  }
  const m = new Mux({ tokenId, tokenSecret });
  if (process.env.NODE_ENV !== "production") global.__dojo_mux = m;
  return m;
}

/**
 * Verify a Mux webhook signature.
 * Mux signs requests with HMAC-SHA256 over `${timestamp}.${rawBody}`.
 * Header: `mux-signature: t=<unix>,v1=<hex>`
 */
export function verifyMuxSignature(
  rawBody: string,
  signatureHeader: string | null,
  toleranceSeconds = 300,
): boolean {
  const secret = process.env.MUX_WEBHOOK_SECRET;
  if (!secret) {
    console.warn("MUX_WEBHOOK_SECRET not set — refusing webhook");
    return false;
  }
  if (!signatureHeader) return false;

  // Robust header parsing — split on the FIRST `=` so signature values
  // that contain `=` (e.g. base64 padding) aren't truncated.
  const parts: Record<string, string> = {};
  for (const part of signatureHeader.split(",")) {
    const trimmed = part.trim();
    const idx = trimmed.indexOf("=");
    if (idx <= 0) continue;
    parts[trimmed.slice(0, idx)] = trimmed.slice(idx + 1);
  }
  const ts = parts.t;
  const sig = parts.v1;
  if (!ts || !sig) return false;

  const tsNum = Number(ts);
  if (!Number.isFinite(tsNum)) return false;

  const ageSec = Math.abs(Date.now() / 1000 - tsNum);
  if (ageSec > toleranceSeconds) return false;

  // SHA-256 → 32 bytes / 64 hex chars. Reject malformed sigs explicitly
  // so timingSafeEqual never throws on length mismatch.
  if (!/^[0-9a-fA-F]{64}$/.test(sig)) return false;

  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${ts}.${rawBody}`)
    .digest("hex");

  return crypto.timingSafeEqual(
    Buffer.from(expected, "hex"),
    Buffer.from(sig, "hex"),
  );
}

/**
 * Create a direct upload URL for an admin to upload a video to.
 */
export async function createDirectUpload(opts: {
  corsOrigin: string;
  language?: MuxLanguageCode;
}) {
  const mux = getMux();
  const upload = await mux.video.uploads.create({
    cors_origin: opts.corsOrigin,
    new_asset_settings: {
      playback_policy: ["public"],
      video_quality: "basic",
      input: [
        {
          generated_subtitles: [
            {
              language_code: (opts.language ?? "en") as MuxLanguageCode,
              name:
                (opts.language ?? "en") === "en" ? "English (CC)" : "Subtitles",
            },
          ],
        },
      ],
    },
  });
  return upload;
}

export type MuxAssetState = {
  status: "preparing" | "ready" | "errored" | "unknown";
  playbackId: string | null;
  durationSeconds: number | null;
  thumbnailUrl: string | null;
  errorMessage: string | null;
  aspectRatio: number | null;
};

function parseMuxAspectRatio(s: string | null | undefined): number | null {
  if (!s) return null;
  const m = s.match(/^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)$/);
  if (!m) return null;
  const w = Number(m[1]);
  const h = Number(m[2]);
  if (!Number.isFinite(w) || !Number.isFinite(h) || h === 0) return null;
  return w / h;
}

/**
 * Fetch the current state of a Mux upload + its asset (if one's been
 * spawned yet). Used by the admin "resync stuck upload" recovery action
 * when a webhook was missed or fired with an error we want to surface.
 *
 * The Upload object carries asset_id once Mux has created an asset for
 * the bytes; the Asset object carries playback_ids + duration + status.
 * If either is in `errored` state we return its error message so the
 * admin can decide whether to clear and re-upload.
 */
export async function readMuxUploadState(
  uploadId: string,
): Promise<MuxAssetState> {
  const mux = getMux();
  const upload = await mux.video.uploads.retrieve(uploadId).catch(() => null);
  if (!upload) {
    return {
      status: "unknown",
      playbackId: null,
      durationSeconds: null,
      thumbnailUrl: null,
      errorMessage: "Upload not found on Mux",
      aspectRatio: null,
    };
  }
  if (upload.error?.message) {
    return {
      status: "errored",
      playbackId: null,
      durationSeconds: null,
      thumbnailUrl: null,
      errorMessage: upload.error.message,
      aspectRatio: null,
    };
  }
  if (!upload.asset_id) {
    return {
      status: "preparing",
      playbackId: null,
      durationSeconds: null,
      thumbnailUrl: null,
      errorMessage: null,
      aspectRatio: null,
    };
  }
  const asset = await mux.video.assets.retrieve(upload.asset_id).catch(() => null);
  if (!asset) {
    return {
      status: "unknown",
      playbackId: null,
      durationSeconds: null,
      thumbnailUrl: null,
      errorMessage: "Asset not found on Mux",
      aspectRatio: null,
    };
  }
  if (asset.status === "ready") {
    const playbackId = asset.playback_ids?.[0]?.id ?? null;
    return {
      status: "ready",
      playbackId,
      durationSeconds:
        typeof asset.duration === "number" ? Math.round(asset.duration) : null,
      thumbnailUrl: playbackId
        ? `https://image.mux.com/${playbackId}/thumbnail.jpg?time=1`
        : null,
      errorMessage: null,
      aspectRatio: parseMuxAspectRatio(asset.aspect_ratio),
    };
  }
  if (asset.status === "errored") {
    const errors = (asset.errors as { messages?: string[] } | undefined)?.messages;
    return {
      status: "errored",
      playbackId: null,
      durationSeconds: null,
      thumbnailUrl: null,
      errorMessage: errors?.join("; ") ?? "Mux reported an error processing this asset",
      aspectRatio: null,
    };
  }
  return {
    status: "preparing",
    playbackId: null,
    durationSeconds: null,
    thumbnailUrl: null,
    errorMessage: null,
    aspectRatio: null,
  };
}
