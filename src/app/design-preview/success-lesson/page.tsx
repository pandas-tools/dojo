import AuthAtmosphere from "@/components/AuthAtmosphere";
import SuccessCard from "@/components/SuccessCard";
import ConfettiBurst from "@/components/ConfettiBurst";

export const metadata = { title: "Chapter complete · Preview" };

export default function SuccessLessonPreviewPage() {
  return (
    <main className="relative isolate flex min-h-dvh items-center justify-center overflow-hidden bg-near-black px-6 py-12 text-white">
      <AuthAtmosphere />
      <ConfettiBurst intensity="lesson" />
      <div className="relative z-10 flex w-full max-w-md items-center justify-center">
        <SuccessCard
          icon={<span className="text-4xl leading-none">🎉</span>}
          title={<>Congrats! You&apos;ve just completed this chapter.</>}
          subtitle="Swipe up to start the next."
        />
      </div>
    </main>
  );
}
