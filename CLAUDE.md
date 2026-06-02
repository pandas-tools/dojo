# dojo

**Dojo** — the internal training portal for retail employees on Pandas Vision AI + platform. Named after the training hall. Domain (eventually): `learn.pandas.io`.

Next.js 16 (App Router) + TypeScript + Tailwind v4 + Drizzle + Auth.js v5 + Mux. Deployed to Railway.

## Read these in order before touching code

1. [`docs/README.md`](docs/README.md) — TOC
2. [`docs/spec.md`](docs/spec.md) — canonical product spec (data model, auth flow, UX, MVP scope)
3. [`docs/architecture.md`](docs/architecture.md) — stack, `src/` layout, tenant scoping pattern
4. [`docs/decisions.md`](docs/decisions.md) — running ADR for this project
5. [`docs/deploy.md`](docs/deploy.md) — Railway project, env vars, webhook setup
6. The studio plan: `.claude/_studio/plans/2026-05-14-cubs-build.md` (phases, principles, what's in/out of scope)

## Hard rules

- **App-layer tenant scoping is non-negotiable.** Every employee-facing query goes through `src/lib/db/scoped.ts → scopedDb(user)`. Never construct a query in a route handler that touches a tenant table without this wrapper. There's an integration test (`src/tests/tenant-isolation.test.ts`) that fails the build if this is bypassed.
- **Admin write routes** check `session.user.role === 'admin'` server-side, not just via middleware. Middleware redirects; it does not authorize.
- **Never commit `.env`.** Secrets live there in mode 0600. `.env.example` (committed) lists every variable name with empty values.
- **Mux webhook** must verify the signature with `MUX_WEBHOOK_SECRET` before doing anything with the payload. There's a test that proves invalid signatures are rejected.
- **Never `--no-verify`, never `--force` to main.** If a hook fails, fix the underlying issue.
- **Don't add features outside the studio plan.** The plan is ground truth. If something feels missing, propose it as an addition first, then build.

## Conventions

- Routes are thin. Logic lives in `src/lib/`. If a route handler is >50 lines, extract it.
- Server Components by default. Client Components (`"use client"`) only when interactivity is needed (forms with state, the Mux player, the rating widget).
- One thing per file. No god-files.
- Plain Tailwind utility classes. No design system yet. Forms are hand-rolled HTML. Ugly is fine while we get to MVP.
- Tests: Vitest. Cover the seams — auth flow, tenant isolation, Mux webhook signature, domain-allowlist check. Skip unit tests on glue code.

## Workflow

Dojo is **pre-production**. Nothing real has shipped to actual client employees yet; the public Railway URL is internal-only. Optimise for speed of iteration.

- **Ship straight to `main`.** No `develop` branch. No PR review gate.
- **Direct commits to `main` are fine** for small/medium changes.
- **For larger work, a PR is OK only if it auto-merges** (`gh pr merge --auto --squash` after creating it). Don't leave a PR open waiting for human review.
- **Do not send Dimi the PR link or preview URL.** He doesn't want to be in the merge loop at this stage. Confirm the change shipped after it's merged.
- **Bundle work.** Prefer one bigger PR over many small ones for related changes.
- **Quality bar is unchanged.** Speed ≠ sloppiness. Every change still runs through `code-reviewer` on the diff and a `chrome-devtools` smoke pass on any new UI surface. Tests must pass. Never `--no-verify`, never `--force` to `main`.

This rule **lapses the moment dojo goes into real production** (real client employees actively training, or the `learn.pandas.io` cutover). At that point: revert to the standard Pandas flow — feature branches → `develop` → `main`, with Dimi-approved promotion to production.
