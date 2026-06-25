"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import SuccessCard, { CheckRingIcon } from "@/components/SuccessCard";

const AUTO_ADVANCE_MS = 2200;

export default function AllSetStep({ mode }: { mode: "first" | "reconfirm" }) {
  const router = useRouter();

  useEffect(() => {
    const t = setTimeout(() => {
      router.push("/");
      router.refresh();
    }, AUTO_ADVANCE_MS);
    return () => clearTimeout(t);
  }, [router]);

  return (
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
  );
}
