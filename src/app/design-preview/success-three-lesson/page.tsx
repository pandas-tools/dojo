import SuccessAtmosphere from "@/components/SuccessAtmosphere";
import SuccessCard from "@/components/SuccessCard";
import ConfettiBurst from "@/components/ConfettiBurst";

export const metadata = { title: "Three lessons complete · Preview" };

export default function SuccessThreeLessonPreviewPage() {
  return (
    <main className="relative isolate flex min-h-dvh items-center justify-center overflow-hidden bg-near-black px-6 py-12 text-white">
      <SuccessAtmosphere />
      <ConfettiBurst intensity="lesson" />
      <div className="relative z-10 flex w-full max-w-md items-center justify-center">
        <SuccessCard
          icon={<span className="text-4xl leading-none">🎉</span>}
          title={<>Congrats! You&apos;ve just completed your first three lessons.</>}
          subtitle="Keep going!"
        />
      </div>
    </main>
  );
}
