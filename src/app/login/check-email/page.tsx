import { Check } from "lucide-react";
import AuthAtmosphere from "@/components/AuthAtmosphere";

export const metadata = { title: "Check your email · Dojo" };

export default function CheckEmailPage() {
  return (
    <main className="relative isolate min-h-dvh overflow-hidden bg-near-black text-white">
      <AuthAtmosphere />

      <div className="relative z-10 mx-auto h-dvh w-full max-w-[402px]">
        {/* HEADER — top 13.3% (matches Figma) */}
        <div className="absolute left-0 right-0 top-[13.3%] flex flex-col items-center gap-10 px-6">
          <div className="space-y-2 text-center">
            <h1 className="text-[24px] font-medium leading-[1.2] tracking-tight text-[#f9fdff]">
              Check your inbox
            </h1>
            <p className="text-[14px] font-medium leading-[22px] tracking-[0.07px] text-[#f9fdff]/85">
              We sent you a sign-in link. Click the link in the email to
              continue.
            </p>
          </div>
        </div>

        {/* Card — vertically centered, 327px wide */}
        <div className="absolute left-1/2 top-1/2 w-[327px] -translate-x-1/2 -translate-y-1/2">
          <div className="flex items-center gap-3 rounded-[24px] border border-arctic-haze/40 bg-[rgba(68,81,88,0.1)] px-5 py-4 text-sm text-[#f9fdff]">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-arctic-haze text-near-black">
              <Check className="h-4 w-4" strokeWidth={2.5} />
            </div>
            <p>
              <span className="font-medium">Sign-in link sent.</span>{" "}
              <span className="text-[#f9fdff]/70">
                Valid for 24 hours.
              </span>
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
