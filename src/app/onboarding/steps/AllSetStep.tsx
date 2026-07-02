"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import SuccessCard, { CheckRingIcon } from "@/components/SuccessCard";

const HOLD_MS = 1800;
const FADE_MS = 400;

export default function AllSetStep({ mode }: { mode: "first" | "reconfirm" }) {
  const router = useRouter();
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const fadeTimer = setTimeout(() => setFading(true), HOLD_MS);
    const pushTimer = setTimeout(() => {
      router.push("/");
      router.refresh();
    }, HOLD_MS + FADE_MS);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(pushTimer);
    };
  }, [router]);

  return (
    <>
      <div className="flex items-center justify-center">
        <SuccessCard
          icon={<CheckRingIcon />}
          title={
            mode === "reconfirm" ? (
              <>You&apos;re good to go.</>
            ) : (
              <>All set. Get ready to start learning!</>
            )
          }
        />
      </div>
      {/* Fade the whole viewport to black before router.push so the aurora
       *  WebGL canvas doesn't visibly cut out, and the /watch route's own
       *  bg-black meets us mid-fade with no seam. z-[60] sits above the
       *  SuccessAtmosphere and the SuccessCard. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-[60] bg-black transition-opacity ease-out"
        style={{
          opacity: fading ? 1 : 0,
          transitionDuration: `${FADE_MS}ms`,
        }}
      />
    </>
  );
}
