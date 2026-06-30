import AuthAtmosphere from "@/components/AuthAtmosphere";
import PreLoginWizard from "./PreLoginWizard";

export const metadata = { title: "Sign in · Dojo" };

export default function LoginPage() {
  return (
    <main className="relative isolate min-h-dvh overflow-hidden bg-near-black text-white">
      <AuthAtmosphere />
      <PreLoginWizard />
    </main>
  );
}
