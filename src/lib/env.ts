import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  AUTH_SECRET: z.string().min(16),
  AUTH_URL: z.string().url(),
  AUTH_RESEND_KEY: z.string().min(1),
  AUTH_EMAIL_FROM: z.string().email(),
  MUX_TOKEN_ID: z.string().min(1),
  MUX_TOKEN_SECRET: z.string().min(1),
  MUX_WEBHOOK_SECRET: z.string().min(1),
  NEXT_PUBLIC_SITE_URL: z.string().url(),
  ADMIN_ALLOWLIST: z.string().default(""),
  // Railway Bucket (S3-compatible, Tigris-backed) for single-image and
  // carousel-slide lesson media. Wired in from the dojo-media bucket's
  // reference variables. URL style is read explicitly so we stay portable
  // if we ever swap the backend (R2, MinIO, etc.). Validated lazily — the
  // upload + serve routes hit readBucketConfig() and throw a single clear
  // error if anything's missing.
  ASSET_BUCKET_ENDPOINT: z.string().url().optional(),
  ASSET_BUCKET_NAME: z.string().min(1).optional(),
  ASSET_BUCKET_ACCESS_KEY_ID: z.string().min(1).optional(),
  ASSET_BUCKET_SECRET_ACCESS_KEY: z.string().min(1).optional(),
  ASSET_BUCKET_REGION: z.string().min(1).optional(),
  ASSET_BUCKET_URL_STYLE: z.enum(["virtual-host", "path-style"]).optional(),
});

type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

const BUILD_STUB: Env = {
  DATABASE_URL: "postgres://stub@localhost:5432/stub",
  AUTH_SECRET: "BUILD_STUB_DO_NOT_USE_REPLACE_ME_AT_RUNTIME",
  AUTH_URL: "http://localhost:3000",
  AUTH_RESEND_KEY: "re_stub",
  AUTH_EMAIL_FROM: "stub@example.com",
  MUX_TOKEN_ID: "stub",
  MUX_TOKEN_SECRET: "stub",
  MUX_WEBHOOK_SECRET: "stub",
  NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
  ADMIN_ALLOWLIST: "",
  ASSET_BUCKET_ENDPOINT: undefined,
  ASSET_BUCKET_NAME: undefined,
  ASSET_BUCKET_ACCESS_KEY_ID: undefined,
  ASSET_BUCKET_SECRET_ACCESS_KEY: undefined,
  ASSET_BUCKET_REGION: undefined,
  ASSET_BUCKET_URL_STYLE: undefined,
};

export function env(): Env {
  if (cached) return cached;
  // During `next build`, Railway reference variables (like DATABASE_URL)
  // may not be resolved. Return a stub so module-top calls don't blow up;
  // real validation happens at runtime on first env() in a handler.
  if (process.env.NEXT_PHASE === "phase-production-build") {
    return BUILD_STUB;
  }
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error("Invalid env:", parsed.error.flatten().fieldErrors);
    throw new Error("Environment variables failed validation. See logs.");
  }
  cached = parsed.data;
  return cached;
}

export function adminAllowlist(): string[] {
  return env()
    .ADMIN_ALLOWLIST.split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}
