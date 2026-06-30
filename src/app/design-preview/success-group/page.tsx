import SuccessAtmosphere from "@/components/SuccessAtmosphere";
import SuccessGroupCard from "@/components/SuccessGroupCard";
import ConfettiBurst from "@/components/ConfettiBurst";

export const metadata = { title: "Group complete · Preview" };

export default function SuccessGroupPreviewPage() {
  return (
    <main className="relative isolate flex min-h-dvh items-center justify-center overflow-hidden bg-near-black px-6 py-12 text-white">
      <SuccessAtmosphere />
      <ConfettiBurst intensity="lesson" />
      <div className="relative z-10 flex w-full max-w-md items-center justify-center">
        <SuccessGroupCard />
      </div>
    </main>
  );
}
