import DojoMark from "@/components/DojoMark";
import LoginForm from "./LoginForm";

export const metadata = { title: "Sign in · Dojo" };

export default function LoginPage() {
  return (
    <main className="relative isolate flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-near-black px-6 py-16 text-white">
      {/* Brand atmosphere — arctic-haze glow top-left → near-black bottom-right. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-brand-gradient-dark opacity-50"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_20%_-10%,rgba(193,232,251,0.18),transparent_55%)]"
      />

      <div className="relative w-full max-w-sm">
        <div className="mb-10 text-center">
          <DojoMark variant="wordmark" className="mx-auto h-14 w-auto text-white sm:h-16" />
          <p className="mt-4 text-sm text-white/65">
            Training portal for Pandas Vision AI.
            <br className="hidden sm:block" /> Enter your work email to receive a sign-in link.
          </p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
