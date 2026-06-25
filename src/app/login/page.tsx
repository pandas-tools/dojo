import BrandAtmosphere from "@/components/BrandAtmosphere";
import DojoMark from "@/components/DojoMark";
import LoginForm from "./LoginForm";

export const metadata = { title: "Sign in · Dojo" };

export default function LoginPage() {
  return (
    <main className="relative isolate flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-near-black px-6 py-12 text-white">
      <BrandAtmosphere variant="full" showStars showDots animated />

      <div className="relative z-10 w-full max-w-md">
        <div className="mb-9 flex flex-col items-center text-center">
          <DojoMark variant="wordmark" className="h-9 w-auto text-white" />
          <h1 className="mt-7 text-balance text-3xl font-medium leading-tight tracking-tight text-white sm:text-4xl">
            Hi, welcome back!
          </h1>
          <p className="mt-3 max-w-xs text-sm text-white/65">
            Sign in to keep training on Pandas&nbsp;Vision&nbsp;AI.
          </p>
        </div>

        <div className="relative">
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
