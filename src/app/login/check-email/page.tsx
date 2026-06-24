import { Check } from "lucide-react";
import BrandAtmosphere from "@/components/BrandAtmosphere";
import DojoMark from "@/components/DojoMark";

export const metadata = { title: "Check your email · Dojo" };

export default function CheckEmailPage() {
  return (
    <main className="relative isolate flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-near-black px-6 py-16 text-white">
      <BrandAtmosphere variant="full" showStars showDots />

      <div className="relative z-10 w-full max-w-md text-center">
        <DojoMark variant="wordmark" className="mx-auto h-10 w-auto text-white sm:h-12" />

        <div className="relative mt-10">
          <div
            aria-hidden
            className="pointer-events-none absolute -inset-x-6 -top-8 h-24 bg-[radial-gradient(60%_100%_at_50%_100%,rgba(193,232,251,0.22),transparent_70%)]"
          />
          <div className="relative rounded-3xl border border-white/12 bg-white/[0.03] px-6 py-9 backdrop-blur-2xl shadow-[0_30px_80px_-20px_rgba(0,0,0,0.7)]">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-arctic-haze text-near-black shadow-[0_0_40px_-6px_rgba(193,232,251,0.45)]">
              <Check className="h-5 w-5" strokeWidth={2.5} />
            </div>
            <h1 className="mt-5 text-xl font-medium">Check your inbox</h1>
            <p className="mt-2 text-sm text-white/65">
              We sent you a sign-in link. Click the link in the email to
              continue.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
