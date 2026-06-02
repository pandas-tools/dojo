// Edge-runtime middleware. Imports only the Edge-safe Auth.js config slice
// (auth.config.ts) — NOT the full auth.ts, which pulls in Drizzle + the
// postgres-js driver that don't run in Edge.
//
// JWT decoding happens in Edge here (Auth.js decrypts the cookie + runs
// the Edge-safe `session` callback). The Node-runtime API routes do their
// own auth() check for anything that needs DB-backed claims.
import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/lib/auth.config";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { nextUrl, auth: session } = req;
  const path = nextUrl.pathname;

  // Public routes
  const isPublic =
    path === "/" ||
    path.startsWith("/login") ||
    path.startsWith("/api/auth") ||
    path.startsWith("/api/webhooks") ||
    path.startsWith("/api/health") ||
    path.startsWith("/_next") ||
    path === "/favicon.ico";

  if (isPublic) return NextResponse.next();

  // Authenticated routes
  if (!session?.user) {
    const loginUrl = new URL("/login", nextUrl);
    return NextResponse.redirect(loginUrl);
  }

  const { role, onboardingCompleted, storeConfirmedAt } = session.user;

  // Admin gate
  if (path.startsWith("/admin") || path.startsWith("/api/admin")) {
    if (role !== "admin") {
      return NextResponse.redirect(new URL("/", nextUrl));
    }
    return NextResponse.next();
  }

  // Admin redirected away from employee routes
  if (role === "admin" && (path.startsWith("/browse") || path.startsWith("/watch"))) {
    return NextResponse.redirect(new URL("/admin", nextUrl));
  }

  // Employee gates: onboarding first, then 30-day store re-confirmation.
  // Both funnel to /onboarding; the page itself pre-fills the current
  // selection when it's a re-confirmation rather than a first-time setup.
  // storeConfirmedAt comes off the JWT as epoch ms (set by the full Node
  // auth.ts jwt callback after each DB refresh).
  if (role === "employee") {
    const needsOnboarding = !onboardingCompleted;
    const STORE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
    const needsReconfirm =
      onboardingCompleted &&
      (storeConfirmedAt === null ||
        Date.now() - storeConfirmedAt > STORE_TTL_MS);
    if ((needsOnboarding || needsReconfirm) && !path.startsWith("/onboarding")) {
      return NextResponse.redirect(new URL("/onboarding", nextUrl));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
