import { Check } from "lucide-react";
import DojoMark from "@/components/DojoMark";

export const metadata = { title: "Check your email · Dojo" };

export default function CheckEmailPage() {
  return (
    <main className="relative isolate flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-near-black px-6 py-16 text-white">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-brand-gradient-dark opacity-50"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_20%_-10%,rgba(193,232,251,0.18),transparent_55%)]"
      />

      <div className="relative w-full max-w-sm text-center">
        <DojoMark variant="wordmark" className="mx-auto h-12 w-auto text-white sm:h-14" />

        <div className="mx-auto mt-10 flex h-12 w-12 items-center justify-center rounded-full bg-arctic-haze text-near-black">
          <Check className="h-5 w-5" strokeWidth={2.5} />
        </div>

        <h1 className="mt-5 text-xl font-medium">Check your inbox</h1>
        <p className="mt-2 text-sm text-white/65">
          We sent you a sign-in link. Click the link in the email to continue.
        </p>
      </div>
    </main>
  );
}
