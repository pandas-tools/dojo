import AuthAtmosphere from "@/components/AuthAtmosphere";
import SuccessCard, { CheckRingIcon } from "@/components/SuccessCard";

export const metadata = { title: "All set · Preview" };

export default function AllSetPreviewPage() {
  return (
    <main className="relative isolate flex min-h-dvh items-center justify-center overflow-hidden bg-near-black px-6 py-12 text-white">
      <AuthAtmosphere />
      <div className="relative z-10 flex w-full max-w-md items-center justify-center">
        <SuccessCard
          icon={<CheckRingIcon />}
          title={<>All set. Get ready to start learning!</>}
        />
      </div>
    </main>
  );
}
