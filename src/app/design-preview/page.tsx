import Link from "next/link";
import AuthAtmosphere from "@/components/AuthAtmosphere";

export const metadata = { title: "Design preview · Dojo" };

const PREVIEWS = [
  {
    href: "/design-preview/login-intro",
    title: "Login intro (4s emblem → gradient → email)",
    desc: "Boot animation for /login. Pandas emblem draws in on black, dissolves into the gradient, wizard rises. Replay button included.",
  },
  {
    href: "/design-preview/all-set",
    title: "All set — onboarding complete",
    desc: "The glass card that closes the onboarding flow. Auto-routes to / after ~2s.",
  },
  {
    href: "/design-preview/success-three-lesson",
    title: "Success — first three lessons complete (confetti)",
    desc: "Shown after the user finishes their first three lessons. Replaces the prior 'chapter complete' frame.",
  },
  {
    href: "/design-preview/success-group",
    title: "Success — group complete (emoji rating + comment)",
    desc: "Shown after the user finishes a lesson group. Asks for a rating + optional comment.",
  },
  {
    href: "/design-preview/success-tier",
    title: "Success — tier unlocked (bigger confetti)",
    desc: "Shown when the user crosses into a new tier.",
  },
  {
    href: "/login",
    title: "Login",
    desc: "Restyled login surface with the new aurora-drift atmosphere.",
  },
  {
    href: "/onboarding",
    title: "Onboarding wizard (requires auth)",
    desc: "Language → Store → All set. Available to signed-in non-admin users.",
  },
];

export default function DesignPreviewIndex() {
  return (
    <main className="relative isolate min-h-dvh overflow-hidden bg-near-black px-6 py-16 text-white">
      <AuthAtmosphere />
      <div className="relative z-10 mx-auto max-w-2xl">
        <h1 className="text-balance text-3xl font-medium tracking-tight">Design preview</h1>
        <p className="mt-2 text-sm text-white/65">
          Static views of the onboarding + success surfaces for design review.
          Not behind auth — these are removed once trigger wiring lands in Phase 2.
        </p>
        <ul className="mt-8 space-y-2.5">
          {PREVIEWS.map((p) => (
            <li key={p.href}>
              <Link
                href={p.href}
                className="block rounded-2xl border border-white/12 bg-white/[0.04] p-5 transition-all duration-200 hover:border-arctic-haze/40 hover:bg-white/[0.07]"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-sm font-medium text-white">{p.title}</p>
                  <code className="font-mono text-[11px] text-arctic-haze/80">{p.href}</code>
                </div>
                <p className="mt-1 text-sm text-white/55">{p.desc}</p>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
