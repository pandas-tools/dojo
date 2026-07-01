import SuccessAtmosphere from "@/components/SuccessAtmosphere";
import SuccessCard from "@/components/SuccessCard";
import ConfettiBurst from "@/components/ConfettiBurst";

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
      <SuccessAtmosphere />
      <ConfettiBurst intensity="tier" />
      <div className="relative z-10 flex w-full max-w-md items-center justify-center">
        <SuccessCard
          icon={<span className="text-4xl leading-none">🏆</span>}
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
