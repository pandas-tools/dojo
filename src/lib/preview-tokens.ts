// Signed preview tokens for the admin "preview as <client>" surface (#6).
//
// An admin generates one of these tokens from the admin panel, the
// admin's browser hands them a URL like `/preview/<token>/browse` or
// `/preview/<token>/watch/<lessonId>`, and the admin can paste that URL
// onto their phone to feel the mobile rendering without signing in there.
//
// Tokens encode (clientId, optional lessonId, expiry) and are HMAC-SHA256
// signed with AUTH_SECRET so the server can verify without a DB round-trip.
// Default expiry is 24 hours — short enough that a copied URL doesn't
// linger if someone screenshots the admin panel; long enough that a
// quick QA pass across a few lessons stays inside one token's life.
//
// Preview tokens do NOT carry a userId. Anything that requires a user
// (the tracker, the rating widget) MUST refuse to write when running
// under preview mode — see /api/lessons/[id]/event for the role-based
// no-op and the preview pages for the UI gating.

import crypto from "node:crypto";

const TOKEN_VERSION = "p1";
const DEFAULT_TTL_SECONDS = 24 * 60 * 60;

export interface PreviewPayload {
  clientId: string;
  lessonId?: string;
  /** Epoch seconds. */
  exp: number;
}

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET is required to sign preview tokens");
  return s;
}

function b64urlEncode(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/=+$/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function b64urlDecode(s: string): Buffer {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

function sign(body: string): string {
  return b64urlEncode(
    crypto.createHmac("sha256", secret()).update(body).digest(),
  );
}

/** Build a token. lessonId is optional — omit for whole-client browse previews. */
export function createPreviewToken(input: {
  clientId: string;
  lessonId?: string;
  ttlSeconds?: number;
}): string {
  const exp =
    Math.floor(Date.now() / 1000) + (input.ttlSeconds ?? DEFAULT_TTL_SECONDS);
  const payload: PreviewPayload = {
    clientId: input.clientId,
    exp,
    ...(input.lessonId ? { lessonId: input.lessonId } : {}),
  };
  const body =
    TOKEN_VERSION + "." + b64urlEncode(Buffer.from(JSON.stringify(payload)));
  return body + "." + sign(body);
}

/**
 * Verify and decode a preview token. Returns null on any failure
 * (bad signature, wrong version, malformed, expired). Never throws —
 * callers can short-circuit to 404 / not-found on null.
 */
export function verifyPreviewToken(token: string): PreviewPayload | null {
  if (typeof token !== "string" || token.length === 0) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [version, payloadB64, sig] = parts;
  if (version !== TOKEN_VERSION) return null;

  const body = version + "." + payloadB64;
  const expected = sign(body);
  // Constant-time compare; length mismatch returns false safely.
  const expectedBuf = Buffer.from(expected);
  const sigBuf = Buffer.from(sig);
  if (
    expectedBuf.length !== sigBuf.length ||
    !crypto.timingSafeEqual(expectedBuf, sigBuf)
  ) {
    return null;
  }

  let payload: PreviewPayload;
  try {
    payload = JSON.parse(b64urlDecode(payloadB64).toString("utf8"));
  } catch {
    return null;
  }
  if (typeof payload.clientId !== "string" || typeof payload.exp !== "number") {
    return null;
  }
  if (payload.exp < Math.floor(Date.now() / 1000)) return null;
  if (payload.lessonId !== undefined && typeof payload.lessonId !== "string") {
    return null;
  }
  return payload;
}

/**
 * Build the public URL an admin pastes into their phone. Caller supplies
 * the base URL (NEXT_PUBLIC_SITE_URL on prod, http://localhost:3000 in
 * dev). The path embeds the token so the URL is fully self-describing —
 * no cookie required on the device opening it.
 */
export function previewUrl(input: {
  baseUrl: string;
  token: string;
  lessonId?: string;
}): string {
  const trimmedBase = input.baseUrl.replace(/\/+$/, "");
  if (input.lessonId) {
    return `${trimmedBase}/preview/${input.token}/watch/${input.lessonId}`;
  }
  return `${trimmedBase}/preview/${input.token}/browse`;
}
