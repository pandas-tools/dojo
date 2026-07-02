import SuccessCard from "@/components/SuccessCard";
import ConfettiBurst from "@/components/ConfettiBurst";
import AnimatedEmoji from "@/components/AnimatedEmoji";
import SimulatedLessonBg from "../_shared/SimulatedLessonBg";

export const metadata = { title: "Three lessons complete · Preview" };

export default function SuccessThreeLessonPreviewPage() {
  return (
    <main className="relative isolate flex min-h-dvh items-center justify-center overflow-hidden bg-near-black px-6 py-12 text-white">
      <SimulatedLessonBg />
      <div
        aria-hidden
        className="absolute inset-0 bg-near-black/80 backdrop-blur-md"
      />
      <ConfettiBurst intensity="lesson" />
      <div className="relative z-10 flex w-full max-w-md items-center justify-center">
        <SuccessCard
          icon={<AnimatedEmoji emoji="🎉" play className="h-10 w-10" />}
          title={<>Congrats! You&apos;ve just completed your first three lessons.</>}
          subtitle="Keep going!"
        />
      </div>
    </main>
  );
}
