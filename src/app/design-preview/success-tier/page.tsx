import AuthAtmosphere from "@/components/AuthAtmosphere";
import SuccessCard from "@/components/SuccessCard";
import ConfettiBurst from "@/components/ConfettiBurst";

export const metadata = { title: "New tier · Preview" };

export default function SuccessTierPreviewPage() {
  return (
    <main className="relative isolate flex min-h-dvh items-center justify-center overflow-hidden bg-near-black px-6 py-12 text-white">
      <AuthAtmosphere />
      <ConfettiBurst intensity="tier" />
      <div className="relative z-10 flex w-full max-w-md items-center justify-center">
        <SuccessCard
          icon={<span className="text-4xl leading-none">🏆</span>}
          title={<>Congrats! You&apos;ve just unlocked a new tier.</>}
          subtitle="Keep going — new lessons just opened up."
        />
      </div>
    </main>
  );
}
