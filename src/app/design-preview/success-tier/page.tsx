import SuccessCard from "@/components/SuccessCard";
import ConfettiBurst from "@/components/ConfettiBurst";
import AnimatedEmoji from "@/components/AnimatedEmoji";
import SimulatedLessonBg from "../_shared/SimulatedLessonBg";

export const metadata = { title: "New tier · Preview" };

export default async function SuccessTierPreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ complete?: string }>;
}) {
  const { complete } = await searchParams;
  const trainingComplete = complete === "1";
  return (
    <main className="relative isolate flex min-h-dvh items-center justify-center overflow-hidden bg-near-black px-6 py-12 text-white">
      <SimulatedLessonBg />
      <div
        aria-hidden
        className="absolute inset-0 bg-near-black/60 backdrop-blur-md"
      />
      <ConfettiBurst intensity="tier" />
      <div className="relative z-10 flex w-full max-w-md items-center justify-center">
        <SuccessCard
          icon={<AnimatedEmoji emoji="🏆" play className="h-10 w-10" />}
          title={<>Congrats! You&apos;ve just unlocked a new tier.</>}
          subtitle={
            trainingComplete
              ? "That's every lesson done. Nice work."
              : "Keep going — new lessons just opened up."
          }
        />
      </div>
    </main>
  );
}
