import SuccessGroupCard from "@/components/SuccessGroupCard";
import ConfettiBurst from "@/components/ConfettiBurst";

export const metadata = { title: "Group complete · Preview" };

export default function SuccessGroupPreviewPage() {
  return (
    <main className="relative isolate flex min-h-dvh items-center justify-center overflow-hidden bg-near-black px-6 py-12 text-white">
      <div
        aria-hidden
        className="absolute inset-0 bg-near-black/60 backdrop-blur-2xl"
      />
      <ConfettiBurst intensity="lesson" />
      <div className="relative z-10 flex w-full max-w-md items-center justify-center">
        <SuccessGroupCard />
      </div>
    </main>
  );
}
