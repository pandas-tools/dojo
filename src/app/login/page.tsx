import BrandAtmosphere from "@/components/BrandAtmosphere";
import DojoMark from "@/components/DojoMark";
import LoginForm from "./LoginForm";

export const metadata = { title: "Sign in · Dojo" };

export default function LoginPage() {
  return (
    <main className="relative isolate flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-near-black px-6 py-16 text-white">
      <BrandAtmosphere variant="full" showStars showDots />

      <div className="relative z-10 w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <DojoMark variant="wordmark" className="h-12 w-auto text-white sm:h-14" />
          <p className="mt-5 max-w-xs text-sm text-white/65">
            Training portal for Pandas Vision&nbsp;AI. Enter your work email to
            receive a sign-in link.
          </p>
        </div>

        <div className="relative">
          {/* Soft top-edge glow on the card — light bleeding in from above */}
          <div
            aria-hidden
            className="pointer-events-none absolute -inset-x-6 -top-8 h-24 bg-[radial-gradient(60%_100%_at_50%_100%,rgba(193,232,251,0.22),transparent_70%)]"
          />
          <div className="relative rounded-3xl border border-white/12 bg-white/[0.03] p-6 backdrop-blur-2xl shadow-[0_30px_80px_-20px_rgba(0,0,0,0.7)] sm:p-7">
            <LoginForm />
          </div>
        </div>
      </div>
    </main>
  );
}
