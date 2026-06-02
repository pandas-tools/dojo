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
  // ImageKit — used for single-image and carousel-slide lesson media.
  // Optional at the schema level because the shared Pandas ImageKit account
  // hadn't been provisioned at first ship time. When all three are unset,
  // the upload endpoint returns a clear error and admins can only create
  // video lessons. Once the operator sets all three on Railway, image +
  // carousel lessons start working with no code change.
  IMAGEKIT_PUBLIC_KEY: z.string().min(1).optional(),
  IMAGEKIT_PRIVATE_KEY: z.string().min(1).optional(),
  IMAGEKIT_URL_ENDPOINT: z.string().url().optional(),
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
  IMAGEKIT_PUBLIC_KEY: undefined,
  IMAGEKIT_PRIVATE_KEY: undefined,
  IMAGEKIT_URL_ENDPOINT: undefined,
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
